package vn.vietduc.carehubbackend.auth.service;


import vn.vietduc.carehubbackend.auth.entity.RefreshToken;
import vn.vietduc.carehubbackend.user.entity.User;

public interface RefreshTokenService {
    RefreshToken createRefreshToken(User user);
    RefreshToken rotateRefreshToken(String credential);
    void revokeRefreshToken(String credential);
    void revokeAllUserTokens(User user);
    int cleanupExpiredSessions();
}
