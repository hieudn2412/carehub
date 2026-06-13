package vn.vietduc.carehubbackend.auth.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.auth.dto.request.LoginRequest;
import vn.vietduc.carehubbackend.auth.dto.request.LogoutRequest;
import vn.vietduc.carehubbackend.auth.dto.request.RefreshTokenRequest;
import vn.vietduc.carehubbackend.auth.dto.response.AccessTokenResult;
import vn.vietduc.carehubbackend.auth.dto.response.AuthResponse;
import vn.vietduc.carehubbackend.auth.entity.RefreshToken;
import vn.vietduc.carehubbackend.auth.repository.RefreshTokenRepository;
import vn.vietduc.carehubbackend.auth.service.AuthService;
import vn.vietduc.carehubbackend.auth.service.JwtTokenService;
import vn.vietduc.carehubbackend.auth.service.RefreshTokenService;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.UnauthorizedException;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private static final String INVALID_CREDENTIALS_MESSAGE = "Invalid code or password";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final RefreshTokenService refreshTokenService;
    private final RefreshTokenRepository refreshTokenRepository;

    @Override
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmployeeCodeAndIsDeletedFalse(request.getEmployeeCode())
                .orElseThrow(() -> new BadRequestException(INVALID_CREDENTIALS_MESSAGE));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BadRequestException(INVALID_CREDENTIALS_MESSAGE);
        }

        if (user.getStatus() == UserStatus.LOCKED) {
            throw new UnauthorizedException("Account is locked");
        }

        refreshTokenService.revokeAllUserTokens(user);

        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        AccessTokenResult accessToken = jwtTokenService.generateAccessToken(user);
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user);
        return AuthResponse.builder()
                .accessToken(accessToken.token())
                .expiresIn(accessToken.expiresInSeconds())
                .refreshToken(refreshToken.getToken())
                .tokenType("Bearer")
                .requiresFirstLoginSetup(user.requiresFirstLoginSetup())
                .build();
    }

    @Override
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        RefreshToken refreshToken = refreshTokenService.findToken(request.getRefreshToken());
        if (refreshToken.getRevoked()) {
            throw new BadRequestException("Token is revoked");
        }
        if (refreshToken.getExpiredAt().isBefore(LocalDateTime.now())) {
            throw new BadRequestException("Token has expired");
        }

        User user = refreshToken.getUser();
        if (user.getStatus() == UserStatus.LOCKED) {
            throw new UnauthorizedException("Account is locked");
        }
        if (user.getStatus() != UserStatus.ACTIVE && !user.requiresFirstLoginSetup()) {
            throw new UnauthorizedException("Account is not active");
        }

        AccessTokenResult accessToken = jwtTokenService.generateAccessToken(user);

        return AuthResponse.builder()
                .accessToken(accessToken.token())
                .expiresIn(accessToken.expiresInSeconds())
                .refreshToken(refreshToken.getToken())
                .tokenType("Bearer")
                .requiresFirstLoginSetup(user.requiresFirstLoginSetup())
                .build();
    }

    @Override
    public void logout(LogoutRequest request) {
        RefreshToken refreshToken = refreshTokenService.findToken(request.getRefreshToken());
        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);
    }
}
