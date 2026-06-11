package vn.vietduc.carehubbackend.utils;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.auth.entity.UserPrincipal;

@Component
public class SecurityUtils {

    public Long getCurrentUserId() {
        Authentication authentication =
                SecurityContextHolder.getContext()
                        .getAuthentication();

        UserPrincipal principal =
                (UserPrincipal) authentication.getPrincipal();

        return principal.getId();
    }
}
