package vn.vietduc.carehubbackend.auth.service.impl;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.OctetSequenceKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.auth.entity.RefreshToken;
import vn.vietduc.carehubbackend.auth.repository.RefreshTokenRepository;
import vn.vietduc.carehubbackend.auth.service.RefreshTokenService;
import vn.vietduc.carehubbackend.exception.TokenException;
import vn.vietduc.carehubbackend.exception.UnauthorizedException;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RefreshTokenServiceImpl implements RefreshTokenService {
    private static final Duration ROTATION_GRACE_PERIOD = Duration.ofSeconds(30);
    private static final Duration REVOKED_SESSION_RETENTION = Duration.ofDays(30);
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final RefreshTokenRepository refreshTokenRepository;

    @Value("${app.jwt.refresh-token-expiration-days:60}")
    private Long refreshTokenExpirationDays;

    @Value("${app.jwt.first-login-refresh-token-expiration-hours:24}")
    private Long firstLoginRefreshTokenExpirationHours;

    @Value("${app.jwt.refresh-secret:${app.jwt.secret}}")
    private String refreshSecret;

    @Override
    @Transactional
    public RefreshToken createRefreshToken(User user) {
        LocalDateTime now = LocalDateTime.now();
        boolean firstLoginSession = user.requiresFirstLoginSetup();
        RefreshToken refreshToken = RefreshToken.builder()
                .sessionId(UUID.randomUUID().toString())
                .generation(0)
                .user(user)
                .revoked(false)
                .expiredAt(expiryFrom(now, firstLoginSession))
                .firstLoginSession(firstLoginSession)
                .build();

        RefreshToken saved = refreshTokenRepository.save(refreshToken);
        saved.setIssuedToken(issueToken(saved));
        return saved;
    }

    @Override
    @Transactional
    public RefreshToken rotateRefreshToken(String credential) {
        if (credential == null || credential.isBlank()) {
            throw new TokenException("Phiên đăng nhập không hợp lệ");
        }

        Optional<Jwt> jwt = decodeRefreshJwt(credential);
        if (jwt.isPresent()) {
            return rotateSignedToken(jwt.get());
        }
        return migrateLegacyToken(credential);
    }

    @Override
    @Transactional
    public void revokeRefreshToken(String credential) {
        if (credential == null || credential.isBlank()) {
            return;
        }

        try {
            Optional<Jwt> jwt = decodeRefreshJwt(credential);
            if (jwt.isPresent()) {
                jwt.flatMap(token -> refreshTokenRepository.findBySessionId(claimAsString(token, "sid")))
                        .ifPresent(this::revoke);
                return;
            }

            refreshTokenRepository.findByToken(credential)
                    .ifPresent(this::revoke);
        } catch (RuntimeException ignored) {
            // Logout is idempotent: invalid credentials still let the browser clear its cookie.
        }
    }

    @Override
    @Transactional
    public void revokeAllUserTokens(User user) {
        refreshTokenRepository.revokeActiveTokensByUser(user, LocalDateTime.now());
    }

    @Override
    @Transactional
    public int cleanupExpiredSessions() {
        LocalDateTime now = LocalDateTime.now();
        return refreshTokenRepository.deleteExpiredOrOldRevoked(
                now,
                now.minus(REVOKED_SESSION_RETENTION)
        );
    }

    @Scheduled(cron = "${app.jwt.refresh-token-cleanup-cron:0 20 3 * * *}", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void cleanupExpiredSessionsDaily() {
        cleanupExpiredSessions();
    }

    private RefreshToken rotateSignedToken(Jwt jwt) {
        String sessionId = claimAsString(jwt, "sid");
        long presentedGeneration = claimAsLong(jwt, "gen");

        if (sessionId == null || sessionId.isBlank()) {
            throw new TokenException("Phiên đăng nhập không hợp lệ");
        }

        RefreshToken session = refreshTokenRepository.findBySessionIdForUpdate(sessionId)
                .orElseThrow(() -> new TokenException("Phiên đăng nhập không hợp lệ"));

        if (!session.getUser().getId().equals(Long.valueOf(jwt.getSubject()))) {
            revoke(session);
            throw new TokenException("Phiên đăng nhập không hợp lệ");
        }

        requireUsableSession(session);
        requireRefreshAllowed(session.getUser());

        LocalDateTime now = LocalDateTime.now();
        int currentGeneration = session.getGeneration() == null ? 0 : session.getGeneration();

        if (presentedGeneration == currentGeneration) {
            session.setGeneration(currentGeneration + 1);
            session.setLastUsedAt(now);
            session.setExpiredAt(expiryFrom(now, session.getFirstLoginSession()));
            refreshTokenRepository.save(session);
            session.setIssuedToken(issueToken(session));
            return session;
        }

        if (
                presentedGeneration == currentGeneration - 1L
                        && session.getLastUsedAt() != null
                        && !session.getLastUsedAt().isBefore(now.minus(ROTATION_GRACE_PERIOD))
        ) {
            session.setIssuedToken(issueToken(session));
            return session;
        }

        revoke(session);
        throw new TokenException("Phiên đăng nhập không hợp lệ");
    }

    private RefreshToken migrateLegacyToken(String credential) {
        RefreshToken session = refreshTokenRepository.findByToken(credential)
                .orElseThrow(() -> new TokenException("Refresh token không hợp lệ"));

        requireUsableSession(session);
        requireRefreshAllowed(session.getUser());

        LocalDateTime now = LocalDateTime.now();
        session.setSessionId(UUID.randomUUID().toString());
        session.setToken(null);
        session.setGeneration(1);
        session.setLastUsedAt(now);
        session.setFirstLoginSession(session.getUser().requiresFirstLoginSetup());
        session.setExpiredAt(expiryFrom(now, session.getFirstLoginSession()));
        refreshTokenRepository.save(session);
        session.setIssuedToken(issueToken(session));
        return session;
    }

    private void requireUsableSession(RefreshToken session) {
        if (Boolean.TRUE.equals(session.getRevoked())) {
            throw new TokenException("Token đã bị thu hồi");
        }
        if (session.getExpiredAt().isBefore(LocalDateTime.now())) {
            throw new TokenException("Token đã hết hạn");
        }
    }

    private void requireRefreshAllowed(User user) {
        if (user.isDeleted()) {
            throw new UnauthorizedException("Tài khoản không còn hoạt động");
        }
        if (user.getStatus() == UserStatus.LOCKED) {
            throw new UnauthorizedException("Tài khoản đã bị khóa");
        }
        if (user.getStatus() != UserStatus.ACTIVE && !user.requiresFirstLoginSetup()) {
            throw new UnauthorizedException("Tài khoản chưa được kích hoạt");
        }
    }

    private void revoke(RefreshToken session) {
        session.revoke(LocalDateTime.now());
        refreshTokenRepository.save(session);
    }

    private LocalDateTime expiryFrom(LocalDateTime now, Boolean firstLoginSession) {
        if (Boolean.TRUE.equals(firstLoginSession)) {
            return now.plusHours(firstLoginRefreshTokenExpirationHours);
        }
        return now.plusDays(refreshTokenExpirationDays);
    }

    private String issueToken(RefreshToken session) {
        Instant now = Instant.now();
        Instant expiresAt = session.getExpiredAt()
                .atZone(BUSINESS_ZONE)
                .toInstant();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .subject(String.valueOf(session.getUser().getId()))
                .claim("typ", "refresh")
                .claim("sid", session.getSessionId())
                .claim("gen", session.getGeneration())
                .claim("first_login_session", Boolean.TRUE.equals(session.getFirstLoginSession()))
                .issuedAt(now)
                .expiresAt(expiresAt.truncatedTo(ChronoUnit.SECONDS))
                .build();

        return refreshJwtEncoder().encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    private Optional<Jwt> decodeRefreshJwt(String credential) {
        if (credential.chars().filter(ch -> ch == '.').count() != 2) {
            return Optional.empty();
        }

        try {
            Jwt jwt = refreshJwtDecoder().decode(credential);
            if (!"refresh".equals(jwt.getClaimAsString("typ"))) {
                throw new TokenException("Phiên đăng nhập không hợp lệ");
            }
            return Optional.of(jwt);
        } catch (JwtException ex) {
            throw new TokenException("Phiên đăng nhập không hợp lệ");
        }
    }

    private JwtEncoder refreshJwtEncoder() {
        SecretKey key = refreshSecretKey();
        OctetSequenceKey jwk = new OctetSequenceKey.Builder(key)
                .algorithm(JWSAlgorithm.HS256)
                .build();
        JWKSource<SecurityContext> jwkSource = new ImmutableJWKSet<>(new JWKSet(jwk));
        return new NimbusJwtEncoder(jwkSource);
    }

    private JwtDecoder refreshJwtDecoder() {
        return NimbusJwtDecoder
                .withSecretKey(refreshSecretKey())
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }

    private SecretKey refreshSecretKey() {
        return new SecretKeySpec(refreshSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    private String claimAsString(Jwt jwt, String claimName) {
        Object value = jwt.getClaim(claimName);
        return value == null ? null : String.valueOf(value);
    }

    private long claimAsLong(Jwt jwt, String claimName) {
        Object value = jwt.getClaim(claimName);
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (RuntimeException ex) {
            throw new TokenException("Phiên đăng nhập không hợp lệ");
        }
    }
}
