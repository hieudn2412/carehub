package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.questiongeneration.repository.EvaluationAudienceRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptFieldResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.EvaluationAudience;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.EvaluationAudienceStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptFieldResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.training.repository.TrainingGroupRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EvaluationAudienceServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final TrainingGroupRepository groups = mock(TrainingGroupRepository.class);
    private final ExamAttemptRepository attempts = mock(ExamAttemptRepository.class);
    private final ExamAttemptFieldResultRepository fieldResults = mock(ExamAttemptFieldResultRepository.class);
    private final EvaluationAudienceRepository audiences = mock(EvaluationAudienceRepository.class);
    private EvaluationAudienceService service;

    @BeforeEach
    void setUp() {
        service = new EvaluationAudienceService(new ObjectMapper(), users, groups, attempts, fieldResults, audiences);
    }

    @Test
    void allEmployeesUsesActiveAndNotDeletedPolicy() {
        when(users.findByIsDeletedFalseAndStatus(UserStatus.ACTIVE)).thenReturn(List.of(user(1, false), user(2, false), user(3, false)));
        var result = service.preview("{\"version\":1,\"all\":[{\"type\":\"ALL_EMPLOYEES\"}]}");
        assertThat(result.count()).isEqualTo(3);
        assertThat(result.sample()).extracting("id").containsExactly(1L, 2L, 3L);
    }

    @Test
    void excludeRemovesUsersWithoutChangingEligibility() {
        when(users.findByIsDeletedFalseAndStatus(UserStatus.ACTIVE)).thenReturn(List.of(user(1, false), user(2, false), user(3, false)));
        var result = service.preview("{\"version\":1,\"all\":[{\"type\":\"ALL_EMPLOYEES\"}],\"exclude\":[{\"type\":\"USER_IN\",\"ids\":[2,2]}]}");
        assertThat(result.count()).isEqualTo(2);
        assertThat(result.excludedCount()).isEqualTo(1);
        assertThat(result.valid()).isTrue();
        assertThat(result.missingData()).isEmpty();
    }

    @Test
    void missingDataFromNestedAnyRuleIsNotDropped() {
        when(users.findByIsDeletedFalseAndStatus(UserStatus.ACTIVE)).thenReturn(List.of(user(1, false)));
        when(groups.findByIdInAndActiveTrue(Set.of(999L))).thenReturn(List.of());

        var result = service.preview("{\"version\":1,\"any\":[{\"type\":\"ALL_EMPLOYEES\"},{\"type\":\"GROUP_IN\",\"ids\":[999]}]}");

        assertThat(result.count()).isEqualTo(1);
        assertThat(result.valid()).isFalse();
        assertThat(result.missingData()).anyMatch(value -> value.contains("nhóm đào tạo"));
    }

    @Test
    void tenureMissingDateIsReportedAndBoundaryUsesMonths() {
        User under = user(1, false); under.setEmploymentStartDate(LocalDate.now().minusMonths(35));
        User exact = user(2, false); exact.setEmploymentStartDate(LocalDate.now().minusMonths(36));
        User missing = user(3, false);
        when(users.findByIsDeletedFalseAndStatus(UserStatus.ACTIVE)).thenReturn(List.of(under, exact, missing));
        var result = service.preview("{\"version\":1,\"all\":[{\"type\":\"SENIORITY_MONTHS_LT\",\"value\":36}]}");
        assertThat(result.count()).isEqualTo(1);
        assertThat(result.valid()).isFalse();
        assertThat(result.missingData()).anyMatch(value -> value.contains("NV003"));
    }

    @Test
    void emptyAudiencePreviewIsInvalidInsteadOfActivatable() {
        when(users.findByIsDeletedFalseAndStatus(UserStatus.ACTIVE)).thenReturn(List.of());

        var result = service.preview("{\"version\":1,\"all\":[{\"type\":\"ALL_EMPLOYEES\"}]}");

        assertThat(result.valid()).isFalse();
        assertThat(result.count()).isZero();
    }

    @Test
    void activationRejectsAudienceWithNoEligibleUsers() {
        EvaluationAudience audience = EvaluationAudience.builder()
                .id(7L).name("Trống").ruleVersion(1).version(1)
                .ruleJson("{\"version\":1,\"all\":[{\"type\":\"ALL_EMPLOYEES\"}]}")
                .status(EvaluationAudienceStatus.DRAFT).build();
        when(audiences.findById(7L)).thenReturn(Optional.of(audience));
        when(users.findByIsDeletedFalseAndStatus(UserStatus.ACTIVE)).thenReturn(List.of());

        assertThatThrownBy(() -> service.activate(7L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Tiêu chí đối tượng không hợp lệ");
    }

    @Test
    void assignmentResolutionRejectsDraftAudienceEvenWhenPreviewHasUsers() {
        EvaluationAudience audience = EvaluationAudience.builder()
                .id(8L).name("Bản nháp").ruleVersion(1).version(1)
                .ruleJson("{\"version\":1,\"all\":[{\"type\":\"ALL_EMPLOYEES\"}]}")
                .status(EvaluationAudienceStatus.DRAFT).build();
        when(audiences.findById(8L)).thenReturn(Optional.of(audience));
        when(users.findByIsDeletedFalseAndStatus(UserStatus.ACTIVE)).thenReturn(List.of(user(1, false)));

        assertThatThrownBy(() -> service.resolveForAssignment(8L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("đang hoạt động");
    }

    @Test
    void unknownOperatorAndDeepRuleAreRejected() {
        assertThatThrownBy(() -> service.preview("{\"version\":1,\"all\":[{\"type\":\"NOPE\"}] }"))
                .isInstanceOf(BadRequestException.class);
        String deep = "{\"version\":1,\"all\":[{\"all\":[{\"all\":[{\"all\":[{\"all\":[{\"all\":[{\"all\":[{\"all\":[{\"type\":\"ALL_EMPLOYEES\"}]}]}]}]}]}]}]}]}";
        assertThatThrownBy(() -> service.preview(deep)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void malformedCompositeRulesCannotDefaultToAllEmployees() {
        assertThatThrownBy(() -> service.preview("{\"version\":1}"))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.preview("{\"version\":1,\"all\":{\"type\":\"ALL_EMPLOYEES\"}}"))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.preview("{\"version\":1,\"all\":[{\"all\":[{\"type\":\"ALL_EMPLOYEES\"}],\"unknown\":true}]}"))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.preview("{\"version\":1,\"asOfDate\":\"not-a-date\",\"all\":[{\"type\":\"ALL_EMPLOYEES\"}]}"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void fieldScoreRuleUsesSnapshotResultsAndSelectionPolicyInsteadOfPaperField() {
        User employee = user(1, false);
        when(users.findByIsDeletedFalseAndStatus(UserStatus.ACTIVE)).thenReturn(List.of(employee));
        when(fieldResults.findGradedByProfessionalFieldIdIn(Set.of(88L))).thenReturn(List.of(
                fieldResult(10L, employee, LocalDateTime.of(2026, 1, 10, 9, 0), "4.00"),
                fieldResult(11L, employee, LocalDateTime.of(2026, 2, 10, 9, 0), "8.00")
        ));

        var latest = service.preview("{\"version\":1,\"all\":[{\"type\":\"FIELD_SCORE_LT\",\"professionalFieldId\":88,\"value\":6}]}" );
        var first = service.preview("{\"version\":1,\"all\":[{\"type\":\"FIELD_SCORE_LT\",\"professionalFieldId\":88,\"value\":6,\"attemptSelection\":\"FIRST\"}]}" );
        var best = service.preview("{\"version\":1,\"all\":[{\"type\":\"FIELD_SCORE_LT\",\"professionalFieldId\":88,\"value\":6,\"attemptSelection\":\"BEST\"}]}" );

        assertThat(latest.count()).isZero();
        assertThat(latest.valid()).isFalse();
        assertThat(first.count()).isEqualTo(1);
        assertThat(first.fieldScoreMatches()).singleElement().satisfies(match -> {
            assertThat(match.score()).isEqualByComparingTo("4.00");
            assertThat(match.professionalFieldName()).isEqualTo("Hồi sức");
            assertThat(match.reason()).contains("thấp hơn ngưỡng");
        });
        assertThat(best.count()).isZero();
    }

    private ExamAttemptFieldResult fieldResult(Long attemptId, User user, LocalDateTime submittedAt, String score) {
        ExamAssignment assignment = ExamAssignment.builder().id(700L).build();
        ExamAttempt attempt = ExamAttempt.builder().id(attemptId).user(user).assignment(assignment)
                .status(ExamAttemptStatus.GRADED).submittedAt(submittedAt).startedAt(submittedAt.minusMinutes(20)).build();
        return ExamAttemptFieldResult.builder().attempt(attempt).professionalFieldId(88L).professionalFieldCode("CC")
                .professionalFieldName("Hồi sức").score(new BigDecimal(score)).passingThreshold(new BigDecimal("6.00"))
                .correctCount(1).totalQuestions(2).passed(false).build();
    }

    private User user(long id, boolean deleted) {
        return User.builder().id(id).employeeCode("NV00" + id).name("User " + id).isDeleted(deleted).status(UserStatus.ACTIVE).build();
    }
}
