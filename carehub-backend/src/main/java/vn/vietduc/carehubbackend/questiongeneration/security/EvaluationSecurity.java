package vn.vietduc.carehubbackend.questiongeneration.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@Component("evaluationSecurity")
public class EvaluationSecurity {

    public boolean canAccess(Authentication authentication) {
        return isAdmin(authentication) || hasAny(authentication, EvaluationPermissions.ALL.toArray(String[]::new));
    }

    public boolean canAuthor(Authentication authentication) {
        return hasAny(authentication, EvaluationPermissions.QUESTION_AUTHOR);
    }

    public boolean canReview(Authentication authentication) {
        return hasAny(authentication, EvaluationPermissions.QUESTION_REVIEWER);
    }

    public boolean canManageQuestionSet(Authentication authentication) {
        return hasAny(authentication, EvaluationPermissions.QUESTION_SET_MANAGER);
    }

    public boolean canManageExamConfig(Authentication authentication) {
        return hasAny(authentication, EvaluationPermissions.EXAM_CONFIG_MANAGER);
    }

    public boolean canPublishExam(Authentication authentication) {
        return hasAny(authentication, EvaluationPermissions.EXAM_PUBLISHER);
    }

    public boolean canManageAssignment(Authentication authentication) {
        return hasAny(authentication, EvaluationPermissions.ASSIGNMENT_MANAGER);
    }

    public boolean canViewResults(Authentication authentication) {
        return hasAny(authentication, EvaluationPermissions.RESULT_VIEWER);
    }

    public boolean canViewAudit(Authentication authentication) {
        return hasAny(authentication, EvaluationPermissions.AUDIT_VIEWER);
    }

    public boolean hasAny(Authentication authentication, String... permissions) {
        if (isAdmin(authentication)) {
            return true;
        }
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        Set<String> authorities = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
        return Arrays.stream(permissions)
                .anyMatch(permission -> authorities.contains(permission) || authorities.contains("ROLE_" + permission));
    }

    private boolean isAdmin(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority) || "ADMIN".equals(authority));
    }
}
