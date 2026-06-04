package vn.vietduc.carehubbackend.auth.dto.response;

public record AccessTokenResult(String token, long expiresInSeconds) {
}
