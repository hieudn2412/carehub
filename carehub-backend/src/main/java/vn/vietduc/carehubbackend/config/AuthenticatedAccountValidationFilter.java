package vn.vietduc.carehubbackend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import vn.vietduc.carehubbackend.auth.entity.UserPrincipal;
import vn.vietduc.carehubbackend.common.response.ErrorResponse;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.io.IOException;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class AuthenticatedAccountValidationFilter extends OncePerRequestFilter {
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.api-prefix}")
    private String apiPrefix;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (
                authentication == null
                        || !authentication.isAuthenticated()
                        || !(authentication.getPrincipal() instanceof UserPrincipal principal)
                        || !(authentication.getCredentials() instanceof Jwt jwt)
        ) {
            filterChain.doFilter(request, response);
            return;
        }

        User user = userRepository.findById(principal.getId()).orElse(null);
        if (user == null || user.isDeleted() || accountDisabled(user)) {
            writeError(
                    response,
                    HttpStatus.FORBIDDEN,
                    "AUTH_ACCOUNT_DISABLED",
                    "Tài khoản không còn hoạt động",
                    request
            );
            return;
        }

        if (claimAsLong(jwt, "auth_version") != user.getAuthVersion()) {
            writeError(
                    response,
                    HttpStatus.UNAUTHORIZED,
                    "AUTH_SESSION_INVALID",
                    "Phiên đăng nhập không còn hợp lệ",
                    request
            );
            return;
        }

        if (Boolean.TRUE.equals(jwt.getClaim("first_login_setup")) && !firstLoginPathAllowed(request)) {
            writeError(
                    response,
                    HttpStatus.FORBIDDEN,
                    "AUTH_ACCOUNT_DISABLED",
                    "Vui lòng hoàn tất thiết lập tài khoản lần đầu",
                    request
            );
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean accountDisabled(User user) {
        if (user.getStatus() == UserStatus.LOCKED) {
            return true;
        }
        return user.getStatus() != UserStatus.ACTIVE && !user.requiresFirstLoginSetup();
    }

    private boolean firstLoginPathAllowed(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith(apiPrefix + "/user/first-login/")
                || path.equals(apiPrefix + "/auth/logout");
    }

    private long claimAsLong(Jwt jwt, String claimName) {
        Object value = jwt.getClaim(claimName);
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value == null) {
            return -1L;
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (RuntimeException ex) {
            return -1L;
        }
    }

    private void writeError(
            HttpServletResponse response,
            HttpStatus status,
            String errorCode,
            String message,
            HttpServletRequest request
    ) throws IOException {
        String correlationId = request.getHeader("X-Correlation-ID");
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader("X-Correlation-ID", correlationId);
        objectMapper.writeValue(
                response.getWriter(),
                ErrorResponse.builder()
                        .errorCode(errorCode)
                        .message(message)
                        .correlationId(correlationId)
                        .build()
        );
    }
}
