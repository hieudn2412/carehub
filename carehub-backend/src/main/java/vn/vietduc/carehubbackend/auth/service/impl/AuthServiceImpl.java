package vn.vietduc.carehubbackend.auth.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.auth.dto.request.LoginRequest;
import vn.vietduc.carehubbackend.auth.dto.request.LogoutRequest;
import vn.vietduc.carehubbackend.auth.dto.request.RefreshTokenRequest;
import vn.vietduc.carehubbackend.auth.dto.request.RegisterRequest;
import vn.vietduc.carehubbackend.auth.dto.response.AccessTokenResult;
import vn.vietduc.carehubbackend.auth.dto.response.AuthResponse;
import vn.vietduc.carehubbackend.auth.entity.RefreshToken;
import vn.vietduc.carehubbackend.auth.entity.Role;
import vn.vietduc.carehubbackend.auth.repository.RefreshTokenRepository;
import vn.vietduc.carehubbackend.auth.repository.UserRepository;
import vn.vietduc.carehubbackend.auth.service.AuthService;
import vn.vietduc.carehubbackend.auth.service.JwtTokenService;
import vn.vietduc.carehubbackend.auth.service.RefreshTokenService;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.user.entity.User;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final RefreshTokenService refreshTokenService;
    private final RefreshTokenRepository refreshTokenRepository;

    @Override
    public AuthResponse register(RegisterRequest request) {
        if(userRepository.existsByEmployeeCode(request.getEmployeeCode())){
            throw new BadRequestException("Employee Code already exists");
        }
        if(userRepository.existsByEmail(request.getEmail())){
            throw new BadRequestException("Email already exists");
        }
        if(!request.getPassword().equals(request.getConfirmPassword())){
            throw new BadRequestException("Passwords don't match");
        }
        String encodedPassword = passwordEncoder.encode(request.getPassword());
        User user = User.builder()
                .employeeCode(request.getEmployeeCode())
                .email(request.getEmail())
                .password(encodedPassword)
                .name(request.getFullName())
                .active(true)
                .createdAt(LocalDateTime.now())
                .role(Role.USER)
                .build();
        userRepository.save(user);

        AccessTokenResult accessToken = jwtTokenService.generateAccessToken(user);

        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user);

        return AuthResponse.builder()
                .accessToken(accessToken.token())
                .expiresIn(accessToken.expiresInSeconds())
                .refreshToken(refreshToken.getToken())
                .tokenType("Bearer")
                .build();
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadRequestException("Email not found"));
        if(!passwordEncoder.matches(request.getPassword(), user.getPassword())){
            throw new BadRequestException("Invalid Password");
        }
        refreshTokenService.revokeAllUserTokens(user);

        AccessTokenResult accessToken = jwtTokenService.generateAccessToken(user);
        RefreshToken refreshToken = refreshTokenService.createRefreshToken(user);
        return AuthResponse.builder()
                .accessToken(accessToken.token())
                .expiresIn(accessToken.expiresInSeconds())
                .refreshToken(refreshToken.getToken())
                .tokenType("Bearer")
                .build();
    }

    @Override
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        RefreshToken refreshToken = refreshTokenService.findToken(request.getRefreshToken());
        if(refreshToken.getRevoked()){
            throw new BadRequestException("Token is revoked");
        }
        if(refreshToken.getExpiredAt().isBefore(LocalDateTime.now())){
            throw new BadRequestException("Token has expired");
        }
        AccessTokenResult accessToken = jwtTokenService.generateAccessToken(refreshToken.getUser());

        return AuthResponse.builder()
                .accessToken(accessToken.token())
                .expiresIn(accessToken.expiresInSeconds())
                .refreshToken(refreshToken.getToken())
                .tokenType("Bearer")
                .build();
    }

    @Override
    public void logout(LogoutRequest request) {
        RefreshToken refreshToken = refreshTokenService.findToken(request.getRefreshToken());
        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);
    }
}
