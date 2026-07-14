package vn.vietduc.carehubbackend.questiongeneration.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CompetencySecurityTest {
    private final EvaluationSecurity security = new EvaluationSecurity();

    @Test
    void adminCanViewCompetencyResults() {
        var auth = authentication("ROLE_ADMIN");
        assertThat(security.canViewResults(auth)).isTrue();
    }

    @Test
    void resultViewerCanViewCompetencyResults() {
        var auth = authentication(EvaluationPermissions.RESULT_VIEWER);
        assertThat(security.canViewResults(auth)).isTrue();
    }

    @Test
    void questionAuthorCannotViewResults() {
        var auth = authentication(EvaluationPermissions.QUESTION_AUTHOR);
        assertThat(security.canViewResults(auth)).isFalse();
    }

    @Test
    void assignmentManagerCanManageAssignment() {
        var auth = authentication(EvaluationPermissions.ASSIGNMENT_MANAGER);
        assertThat(security.canManageAssignment(auth)).isTrue();
    }

    @Test
    void reviewerWithoutAssignmentPermissionCannotManage() {
        var auth = authentication(EvaluationPermissions.QUESTION_REVIEWER);
        assertThat(security.canManageAssignment(auth)).isFalse();
    }

    @Test
    void userWithoutEvaluationPermissionCannotAccess() {
        var auth = authentication("ROLE_USER");
        assertThat(security.canAccess(auth)).isFalse();
        assertThat(security.canViewResults(auth)).isFalse();
        assertThat(security.canManageAssignment(auth)).isFalse();
    }

    @Test
    void unauthenticatedCannotAccessEvaluation() {
        assertThat(security.canAccess(null)).isFalse();
        assertThat(security.canViewResults(null)).isFalse();
    }

    private UsernamePasswordAuthenticationToken authentication(String... authorities) {
        return new UsernamePasswordAuthenticationToken(
                "user", "n/a",
                List.of(authorities).stream().map(SimpleGrantedAuthority::new).toList()
        );
    }
}
