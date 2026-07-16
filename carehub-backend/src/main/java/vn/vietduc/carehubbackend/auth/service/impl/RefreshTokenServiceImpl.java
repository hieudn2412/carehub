package vn.vietduc.carehubbackend.auth.service.impl;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.auth.entity.RefreshToken;
import vn.vietduc.carehubbackend.auth.repository.RefreshTokenRepository;
import vn.vietduc.carehubbackend.auth.service.RefreshTokenService;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.user.entity.User;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RefreshTokenServiceImpl implements RefreshTokenService {
    private final RefreshTokenRepository refreshTokenRepository;

    @Value("${app.jwt.refresh-token-expiration-days}")
    private Long refreshTokenExpirationDays;

    @Override
    public RefreshToken createRefreshToken(User user) {
        RefreshToken refreshToken = RefreshToken.builder()
                .token(UUID.randomUUID().toString())
                .user(user)
                .revoked(false)
                .expiredAt(LocalDateTime.now().plusDays(refreshTokenExpirationDays))
                .build();

        return refreshTokenRepository.save(refreshToken);
    }

    @Override
    public RefreshToken findToken(String token) {
        return refreshTokenRepository.findByToken(token)
                .orElseThrow(() -> new BadRequestException("Refresh token không hợp lệ"));
    }

    @Override
    public void revokeAllUserTokens(User user) {
        List<RefreshToken> validTokens =
                refreshTokenRepository.findByUserAndRevokedFalse(user);

        validTokens.forEach(token -> token.setRevoked(true));

        refreshTokenRepository.saveAll(validTokens);
    }
}
