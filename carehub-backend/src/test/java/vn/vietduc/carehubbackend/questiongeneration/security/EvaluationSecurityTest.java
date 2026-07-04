package vn.vietduc.carehubbackend.questiongeneration.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class EvaluationSecurityTest {
    private final EvaluationSecurity security = new EvaluationSecurity();

    @Test
    void adminHasAllEvaluationPermissions() {
        var authentication = authentication("ROLE_ADMIN");

        assertThat(security.canPublishExam(authentication)).isTrue();
        assertThat(security.canViewAudit(authentication)).isTrue();
    }

    @Test
    void explicitPermissionAllowsMatchingActionOnly() {
        var authentication = authentication(EvaluationPermissions.QUESTION_REVIEWER);

        assertThat(security.canReview(authentication)).isTrue();
        assertThat(security.canPublishExam(authentication)).isFalse();
    }

    @Test
    void userWithoutEvaluationPermissionCannotAccessEvaluation() {
        var authentication = authentication("ROLE_USER");

        assertThat(security.canAccess(authentication)).isFalse();
    }

    private UsernamePasswordAuthenticationToken authentication(String... authorities) {
        return new UsernamePasswordAuthenticationToken(
                "user",
                "n/a",
                List.of(authorities).stream().map(SimpleGrantedAuthority::new).toList()
        );
    }
}
