package vn.vietduc.carehubbackend.auth.service;


import vn.vietduc.carehubbackend.auth.entity.RefreshToken;
import vn.vietduc.carehubbackend.user.entity.User;

public interface RefreshTokenService {
    RefreshToken createRefreshToken(User user);
    RefreshToken findToken(String token);
    void revokeAllUserTokens(User user);
}
