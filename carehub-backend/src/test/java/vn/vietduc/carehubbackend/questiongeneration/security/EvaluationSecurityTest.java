package vn.vietduc.carehubbackend.questiongeneration.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.function.BiPredicate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * L1 unit tests — sheet {@code AccessPolicy &amp; EvaluationSecurity}, Test ID prefix {@code L1-SEC}
 * (IDs 15–26 live here, 01–14 in {@code training.service.TrainingAccessPolicyTest}).
 *
 * <p>Traces NAC-01-03 / NAC-03-03: a caller without the required evaluation permission must be
 * refused. Condition Coverage targets {@code hasAny}, whose result is
 * {@code isAdmin || (authenticated && (permission matched bare || matched with ROLE_ prefix))}.
 */
class EvaluationSecurityTest {
    private final EvaluationSecurity security = new EvaluationSecurity();

    // ── Block: isAdmin() short circuit ────────────────────────────────────────

    @ParameterizedTest(name = "authority={0}")
    @CsvSource({"ROLE_ADMIN", "ADMIN"})
    @DisplayName("L1-SEC-15 | CC: admin is recognised both with and without the ROLE_ prefix")
    void adminRecognisedWithAndWithoutPrefix(String authority) {
        Authentication authentication = authentication(authority);

        assertThat(security.canAccess(authentication)).isTrue();
        assertThat(security.canPublishExam(authentication)).isTrue();
        assertThat(security.canViewAudit(authentication)).isTrue();
    }

    @Test
    @DisplayName("L1-SEC-16 | EP-Valid: admin bypass covers every evaluation capability")
    void adminHasAllEvaluationPermissions() {
        Authentication admin = authentication("ROLE_ADMIN");

        assertThat(security.canAuthor(admin)).isTrue();
        assertThat(security.canReview(admin)).isTrue();
        assertThat(security.canManageQuestionSet(admin)).isTrue();
        assertThat(security.canManageExamConfig(admin)).isTrue();
        assertThat(security.canPublishExam(admin)).isTrue();
        assertThat(security.canManageAssignment(admin)).isTrue();
        assertThat(security.canViewResults(admin)).isTrue();
        assertThat(security.canViewAudit(admin)).isTrue();
    }

    // ── Block: hasAny() — unauthenticated partitions ──────────────────────────

    @Test
    @DisplayName("L1-SEC-17 | CC-TRUE: null Authentication → denied (first sub-condition)")
    void nullAuthenticationIsDenied() {
        assertThat(security.canAccess(null)).isFalse();
        assertThat(security.hasAny(null, EvaluationPermissions.QUESTION_AUTHOR)).isFalse();
    }

    @Test
    @DisplayName("L1-SEC-18 | CC-TRUE: authenticated=false → denied even though authorities exist")
    void unauthenticatedTokenIsDenied() {
        UsernamePasswordAuthenticationToken token = new UsernamePasswordAuthenticationToken(
                "user",
                "n/a",
                List.of(new SimpleGrantedAuthority(EvaluationPermissions.QUESTION_AUTHOR))
        );
        token.setAuthenticated(false);

        assertThat(security.hasAny(token, EvaluationPermissions.QUESTION_AUTHOR)).isFalse();
        assertThat(security.canAccess(token)).isFalse();
    }

    @Test
    @DisplayName("L1-SEC-19 | EP-Invalid: no authorities at all → denied")
    void emptyAuthoritiesAreDenied() {
        assertThat(security.canAccess(authentication())).isFalse();
    }

    // ── Block: hasAny() — permission matching ─────────────────────────────────

    @Test
    @DisplayName("L1-SEC-20 | EP-Valid: a bare permission authority grants exactly its own capability")
    void explicitPermissionAllowsMatchingActionOnly() {
        Authentication reviewer = authentication(EvaluationPermissions.QUESTION_REVIEWER);

        assertThat(security.canReview(reviewer)).isTrue();
        assertThat(security.canPublishExam(reviewer)).isFalse();
        assertThat(security.canAuthor(reviewer)).isFalse();
    }

    @Test
    @DisplayName("L1-SEC-21 | CC: a permission prefixed with ROLE_ is accepted as well")
    void rolePrefixedPermissionIsAccepted() {
        Authentication reviewer = authentication("ROLE_" + EvaluationPermissions.QUESTION_REVIEWER);

        assertThat(security.canReview(reviewer)).isTrue();
        assertThat(security.canPublishExam(reviewer)).isFalse();
    }

    @Test
    @DisplayName("L1-SEC-22 | BC-FALSE: a non-evaluation role cannot reach the evaluation module")
    void userWithoutEvaluationPermissionCannotAccessEvaluation() {
        assertThat(security.canAccess(authentication("ROLE_USER"))).isFalse();
        assertThat(security.canAccess(authentication("ROLE_MANAGER"))).isFalse();
    }

    @Test
    @DisplayName("L1-SEC-23 | EP-Valid: any single evaluation permission is enough for canAccess")
    void anySingleEvaluationPermissionGrantsAccess() {
        assertThat(EvaluationPermissions.ALL).isNotEmpty();
        EvaluationPermissions.ALL.forEach(permission ->
                assertThat(security.canAccess(authentication(permission)))
                        .as("canAccess with only %s", permission)
                        .isTrue());
    }

    @Test
    @DisplayName("L1-SEC-24 | EP: hasAny with several candidates matches on any one of them")
    void hasAnyMatchesAnyOfTheRequestedPermissions() {
        Authentication auditViewer = authentication(EvaluationPermissions.AUDIT_VIEWER);

        assertThat(security.hasAny(auditViewer,
                EvaluationPermissions.EXAM_PUBLISHER, EvaluationPermissions.AUDIT_VIEWER)).isTrue();
        assertThat(security.hasAny(auditViewer,
                EvaluationPermissions.EXAM_PUBLISHER, EvaluationPermissions.QUESTION_AUTHOR)).isFalse();
    }

    @Test
    @DisplayName("L1-SEC-25 | EP-Invalid: hasAny with an empty permission list → denied for a non-admin")
    void hasAnyWithNoRequestedPermissionsIsDenied() {
        assertThat(security.hasAny(authentication(EvaluationPermissions.AUDIT_VIEWER))).isFalse();
        // ...but the admin bypass is evaluated before the list is consulted.
        assertThat(security.hasAny(authentication("ROLE_ADMIN"))).isTrue();
    }

    @Test
    @DisplayName("L1-SEC-26 | EP: each capability accessor is bound to its own permission constant")
    void eachCapabilityIsBoundToItsOwnPermission() {
        record Capability(String permission, BiPredicate<EvaluationSecurity, Authentication> accessor) {
        }
        List<Capability> capabilities = List.of(
                new Capability(EvaluationPermissions.QUESTION_AUTHOR, EvaluationSecurity::canAuthor),
                new Capability(EvaluationPermissions.QUESTION_REVIEWER, EvaluationSecurity::canReview),
                new Capability(EvaluationPermissions.QUESTION_SET_MANAGER, EvaluationSecurity::canManageQuestionSet),
                new Capability(EvaluationPermissions.EXAM_CONFIG_MANAGER, EvaluationSecurity::canManageExamConfig),
                new Capability(EvaluationPermissions.EXAM_PUBLISHER, EvaluationSecurity::canPublishExam),
                new Capability(EvaluationPermissions.ASSIGNMENT_MANAGER, EvaluationSecurity::canManageAssignment),
                new Capability(EvaluationPermissions.RESULT_VIEWER, EvaluationSecurity::canViewResults),
                new Capability(EvaluationPermissions.AUDIT_VIEWER, EvaluationSecurity::canViewAudit)
        );

        for (Capability granted : capabilities) {
            Authentication authentication = authentication(granted.permission());
            for (Capability probed : capabilities) {
                assertThat(probed.accessor().test(security, authentication))
                        .as("holder of %s probing %s", granted.permission(), probed.permission())
                        .isEqualTo(granted.permission().equals(probed.permission()));
            }
        }
    }

    private UsernamePasswordAuthenticationToken authentication(String... authorities) {
        return new UsernamePasswordAuthenticationToken(
                "user",
                "n/a",
                List.of(authorities).stream().map(SimpleGrantedAuthority::new).toList()
        );
    }
}
