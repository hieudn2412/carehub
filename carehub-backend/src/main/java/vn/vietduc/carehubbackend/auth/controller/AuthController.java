package vn.vietduc.carehubbackend.auth.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.vietduc.carehubbackend.auth.dto.request.LoginRequest;
import vn.vietduc.carehubbackend.auth.dto.request.LogoutRequest;
import vn.vietduc.carehubbackend.auth.dto.request.RefreshTokenRequest;
import vn.vietduc.carehubbackend.auth.dto.response.AuthResponse;
import vn.vietduc.carehubbackend.auth.service.AuthService;
import vn.vietduc.carehubbackend.auth.service.PasswordResetService;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.auth.dto.request.ForgotPasswordRequest;
import vn.vietduc.carehubbackend.auth.dto.request.ResetPasswordRequest;
import vn.vietduc.carehubbackend.auth.dto.request.VerifyOtpRequest;

import java.time.Duration;

@RestController
@RequestMapping("${app.api-prefix}/auth")
@RequiredArgsConstructor
public class AuthController {
    private static final String REFRESH_COOKIE_NAME = "carehub_refresh";

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    @Value("${app.api-prefix}")
    private String apiPrefix;

    @Value("${app.jwt.refresh-cookie-secure:true}")
    private boolean refreshCookieSecure;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return withRefreshCookie(response, "Login Successfully");
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(
            @CookieValue(name = REFRESH_COOKIE_NAME, required = false) String cookieRefreshToken,
            @RequestBody(required = false) RefreshTokenRequest request
    ) {
        AuthResponse response = authService.refreshToken(refreshCredential(cookieRefreshToken, request));
        return withRefreshCookie(response, "Refresh Token successfully");
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Void>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.forgotPassword(request);
        return ResponseEntity.ok(ApiResponse.success("OTP sent", null));
    }

    @PostMapping("/verify-reset-otp")
    public ResponseEntity<ApiResponse<Void>> verifyResetOtp(@Valid @RequestBody VerifyOtpRequest request) {
        passwordResetService.verifyResetOtp(request);
        return ResponseEntity.ok(ApiResponse.success("OTP verified", null));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request);
        return ResponseEntity.ok(ApiResponse.success("Password changed successfully", null));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @CookieValue(name = REFRESH_COOKIE_NAME, required = false) String cookieRefreshToken,
            @RequestBody(required = false) LogoutRequest request
    ) {
        authService.logout(refreshCredential(cookieRefreshToken, request));
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, expiredRefreshCookie().toString())
                .body(ApiResponse.success("Logout successfully", null));
    }

    private ResponseEntity<ApiResponse<AuthResponse>> withRefreshCookie(AuthResponse response, String message) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(response).toString())
                .body(ApiResponse.success(message, response));
    }

    private ResponseCookie refreshCookie(AuthResponse response) {
        long maxAgeSeconds = response.getRefreshExpiresInSeconds() == null
                ? Duration.ofDays(60).toSeconds()
                : response.getRefreshExpiresInSeconds();
        return ResponseCookie.from(REFRESH_COOKIE_NAME, response.getRefreshToken())
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite("Strict")
                .path(apiPrefix + "/auth")
                .maxAge(Duration.ofSeconds(Math.max(0, maxAgeSeconds)))
                .build();
    }

    private ResponseCookie expiredRefreshCookie() {
        return ResponseCookie.from(REFRESH_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(refreshCookieSecure)
                .sameSite("Strict")
                .path(apiPrefix + "/auth")
                .maxAge(Duration.ZERO)
                .build();
    }

    private String refreshCredential(String cookieRefreshToken, RefreshTokenRequest request) {
        if (cookieRefreshToken != null && !cookieRefreshToken.isBlank()) {
            return cookieRefreshToken;
        }
        return request == null ? null : request.getRefreshToken();
    }

    private String refreshCredential(String cookieRefreshToken, LogoutRequest request) {
        if (cookieRefreshToken != null && !cookieRefreshToken.isBlank()) {
            return cookieRefreshToken;
        }
        return request == null ? null : request.getRefreshToken();
    }
}
