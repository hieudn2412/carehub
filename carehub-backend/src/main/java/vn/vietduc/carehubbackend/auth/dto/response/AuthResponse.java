package vn.vietduc.carehubbackend.auth.dto.response;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import vn.vietduc.carehubbackend.user.entity.UserStatus;

@Getter
@Setter
@Builder
public class AuthResponse {
    private String accessToken;
    /**
     * Deprecated transition field. New clients receive the refresh credential
     * through the HttpOnly carehub_refresh cookie.
     */
    private String refreshToken;
    private String tokenType;
    private boolean requiresFirstLoginSetup;
    private Long expiresIn;
    private Long refreshExpiresInSeconds;
}
