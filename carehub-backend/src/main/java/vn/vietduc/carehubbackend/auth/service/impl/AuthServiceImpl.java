package vn.vietduc.carehubbackend.auth.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.auth.dto.request.LoginRequest;
import vn.vietduc.carehubbackend.auth.dto.response.AccessTokenResult;
import vn.vietduc.carehubbackend.auth.dto.response.AuthResponse;
import vn.vietduc.carehubbackend.auth.entity.RefreshToken;
import vn.vietduc.carehubbackend.auth.service.AuthService;
import vn.vietduc.carehubbackend.auth.service.JwtTokenService;
import vn.vietduc.carehubbackend.auth.service.RefreshTokenService;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.UnauthorizedException;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.time.Duration;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private static final String INVALID_CREDENTIALS_MESSAGE = "Mã nhân viên hoặc mật khẩu không chính xác";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final RefreshTokenService refreshTokenService;

    @Override
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmployeeCodeAndIsDeletedFalse(request.getEmployeeCode())
                .orElseThrow(() -> new BadRequestException(INVALID_CREDENTIALS_MESSAGE));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BadRequestException(INVALID_CREDENTIALS_MESSAGE);
        }

        if (user.getStatus() == UserStatus.LOCKED) {
            throw new UnauthorizedException("Tài khoản đã bị khóa");
        }
        if (user.getStatus() != UserStatus.ACTIVE && !user.requiresFirstLoginSetup()) {
            throw new UnauthorizedException("Tài khoản chưa được kích hoạt");
        }

        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        AccessTokenResult accessToken = jwtTokenService.generateAccessToken(user);
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user);
        return buildResponse(user, accessToken, refreshToken);
    }

    @Override
    public AuthResponse refreshToken(String credential) {
        RefreshToken refreshToken = refreshTokenService.rotateRefreshToken(credential);
        User user = refreshToken.getUser();
        AccessTokenResult accessToken = jwtTokenService.generateAccessToken(user);
        return buildResponse(user, accessToken, refreshToken);
    }

    @Override
    public void logout(String credential) {
        refreshTokenService.revokeRefreshToken(credential);
    }

    private AuthResponse buildResponse(User user, AccessTokenResult accessToken, RefreshToken refreshToken) {
        return AuthResponse.builder()
                .accessToken(accessToken.token())
                .expiresIn(accessToken.expiresInSeconds())
                .refreshToken(refreshToken.getToken())
                .refreshExpiresInSeconds(refreshExpiresInSeconds(refreshToken))
                .tokenType("Bearer")
                .requiresFirstLoginSetup(user.requiresFirstLoginSetup())
                .build();
    }

    private Long refreshExpiresInSeconds(RefreshToken refreshToken) {
        return Math.max(
                0,
                Duration.between(LocalDateTime.now(), refreshToken.getExpiredAt()).getSeconds()
        );
    }
}
