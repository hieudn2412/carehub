package vn.vietduc.carehubbackend.utils;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.auth.entity.UserPrincipal;

@Component
public class SecurityUtils {

    public Long getCurrentUserId() {
        Authentication authentication =
                SecurityContextHolder.getContext()
                        .getAuthentication();

        Object principal = authentication.getPrincipal();
        if (principal instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getId();
        }
        if (principal instanceof Jwt jwt) {
            return Long.valueOf(jwt.getSubject());
        }
        if (authentication.getName() != null && authentication.getName().matches("\\d+")) {
            return Long.valueOf(authentication.getName());
        }
        throw new IllegalStateException("Missing authenticated user id");
    }
}
