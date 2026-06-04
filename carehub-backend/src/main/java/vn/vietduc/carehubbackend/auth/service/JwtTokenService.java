package vn.vietduc.carehubbackend.auth.service;


import vn.vietduc.carehubbackend.auth.dto.response.AccessTokenResult;
import vn.vietduc.carehubbackend.user.entity.User;

public interface JwtTokenService {
    AccessTokenResult generateAccessToken(User user);
}
