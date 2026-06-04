package vn.vietduc.carehubbackend.auth.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.vietduc.carehubbackend.auth.dto.request.LoginRequest;
import vn.vietduc.carehubbackend.auth.dto.request.LogoutRequest;
import vn.vietduc.carehubbackend.auth.dto.request.RefreshTokenRequest;
import vn.vietduc.carehubbackend.auth.dto.request.RegisterRequest;
import vn.vietduc.carehubbackend.auth.dto.response.AuthResponse;
import vn.vietduc.carehubbackend.auth.service.AuthService;
import vn.vietduc.carehubbackend.common.response.ApiResponse;

@RestController
@RequestMapping("${app.api-prefix}/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request){
        AuthResponse response = authService.register(request);
        return ResponseEntity.ok(
                ApiResponse.success("Register Successfully", response)
        );
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request){
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(
                ApiResponse.success("Login Successfully", response)
        );
    }

    @PostMapping("/refreshToken")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(@Valid @RequestBody RefreshTokenRequest request){
        AuthResponse response = authService.refreshToken(request);
        return ResponseEntity.ok(
                ApiResponse.success("Refresh Token successfully", response)
        );
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<AuthResponse>> logout(@Valid @RequestBody LogoutRequest request){
        authService.logout(request);
        return ResponseEntity.ok(
                ApiResponse.success("Logout successfully", null)
        );
    }

    @GetMapping("/test")
    public ResponseEntity<ApiResponse<String>> test(){
        return ResponseEntity.ok(
                ApiResponse.success("Get test successfully", "test")
        );
    }
}
