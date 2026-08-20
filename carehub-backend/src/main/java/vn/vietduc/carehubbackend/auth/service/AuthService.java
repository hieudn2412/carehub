package vn.vietduc.carehubbackend.auth.service;

import vn.vietduc.carehubbackend.auth.dto.request.LoginRequest;
import vn.vietduc.carehubbackend.auth.dto.response.AuthResponse;

public interface AuthService {
    AuthResponse login(LoginRequest request);
    AuthResponse refreshToken(String refreshToken);
    void logout(String refreshToken);
}
