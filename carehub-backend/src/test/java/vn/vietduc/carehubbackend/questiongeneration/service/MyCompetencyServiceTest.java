package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmission;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionResult;
import vn.vietduc.carehubbackend.form.submission.repository.FormSubmissionRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CompetencyLevel;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.projection.MyComplianceYearProjection;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.systemsettings.service.SystemSettingsService;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MyCompetencyServiceTest {
    private ExamAttemptRepository attemptRepository;
    private FormSubmissionRepository submissionRepository;
    private CompetencyClassificationService classificationService;
    private SystemSettingsService systemSettingsService;
    private MyCompetencyService service;
    private User user;

    @BeforeEach
    void setUp() {
        attemptRepository = mock(ExamAttemptRepository.class);
        submissionRepository = mock(FormSubmissionRepository.class);
        classificationService = mock(CompetencyClassificationService.class);
        systemSettingsService = mock(SystemSettingsService.class);
        service = new MyCompetencyService(
                attemptRepository, submissionRepository, classificationService, systemSettingsService);
        when(systemSettingsService.competencyTargetScore()).thenReturn(new BigDecimal("8.40"));

        Department department = Department.builder()
                .id(10L)
                .name("Khoa Nội")
                .competencyTargetScore(new BigDecimal("9.50"))
                .build();
        user = User.builder()
                .id(20L)
                .employeeCode("NV020")
                .name("Nguyễn An")
                .department(department)
                .build();

        ExamPaper paper = ExamPaper.builder().id(30L).name("Kiểm tra chuyên môn").build();
        ExamAttempt attempt = ExamAttempt.builder()
                .id(40L)
                .user(user)
                .examPaper(paper)
                .submittedAt(LocalDateTime.now())
                .score(new BigDecimal("8.00"))
                .correctCount(8)
                .totalQuestions(10)
                .passed(true)
                .build();

        Form form = Form.builder().id(50L).title("Bảng kiểm truyền dịch").build();
        FormVersion version = FormVersion.builder().id(51L).form(form).title(form.getTitle()).build();
        FormSubmission submission = FormSubmission.builder()
                .id(60L)
                .formVersion(version)
                .submittedBy(user)
                .submittedAt(Instant.now())
                .convertedScore(new BigDecimal("9.00"))
                .result(FormSubmissionResult.PASSED)
                .build();

        when(attemptRepository.findScoredAttemptsByUserAndDateRange(any(), any(), any()))
                .thenReturn(List.of(attempt));
        when(submissionRepository.findScoredEvaluationsForSubject(anyLong(), anyString(), any(), any()))
                .thenReturn(List.of(submission));
        when(classificationService.classifyOverall(any())).thenReturn(CompetencyLevel.PROFICIENT);
    }

    @Test
    void combinesExamAndChecklistAveragesAndReturnsAttemptDetails() {
        LocalDate from = LocalDate.now().minusMonths(1);
        LocalDate to = LocalDate.now();

        var knowledge = service.getKnowledgeCompetency(user, from, to);
        var skills = service.getSkillCompetency(user, from, to);
        var summary = service.getCompetencySummary(user, from, to);

        assertThat(knowledge.overallAverage()).isEqualByComparingTo("8.00");
        assertThat(knowledge.items().get(0).attempts()).hasSize(1);
        assertThat(skills.overallAverage()).isEqualByComparingTo("9.00");
        assertThat(skills.items().get(0).attempts()).hasSize(1);
        assertThat(summary.overallScore()).isEqualByComparingTo("8.50");
        assertThat(summary.targetScore()).isEqualByComparingTo("8.40");
        assertThat(summary.knowledgeAttemptCount()).isEqualTo(1);
        assertThat(summary.skillEvaluationCount()).isEqualTo(1);
        assertThat(summary.isPassed()).isTrue();
    }

    @Test
    void scoreEqualToHospitalTargetIsPassed() {
        when(systemSettingsService.competencyTargetScore()).thenReturn(new BigDecimal("8.50"));

        var summary = service.getCompetencySummary(user, LocalDate.now().minusMonths(1), LocalDate.now());

        assertThat(summary.overallScore()).isEqualByComparingTo("8.50");
        assertThat(summary.isPassed()).isTrue();
    }

    @Test
    void missingComponentIsTreatedAsZeroAndUsesHospitalTarget() {
        when(attemptRepository.findScoredAttemptsByUserAndDateRange(any(), any(), any()))
                .thenReturn(List.of());
        when(systemSettingsService.competencyTargetScore()).thenReturn(new BigDecimal("6.00"));

        var summary = service.getCompetencySummary(user, LocalDate.now().minusMonths(1), LocalDate.now());

        assertThat(summary.knowledgeAverage()).isEqualByComparingTo("0");
        assertThat(summary.skillAverage()).isEqualByComparingTo("9.00");
        assertThat(summary.overallScore()).isEqualByComparingTo("4.50");
        assertThat(summary.knowledgeAttemptCount()).isZero();
        assertThat(summary.skillEvaluationCount()).isEqualTo(1);
        assertThat(summary.targetScore()).isEqualByComparingTo("6.00");
        assertThat(summary.isPassed()).isFalse();
    }

    @Test
    void complianceOverviewAggregatesEvaluationAndUsesDefaultTarget() {
        var overview = service.getComplianceOverview(user, LocalDate.now().withDayOfYear(1), LocalDate.now());

        assertThat(overview.totalEvaluations()).isEqualTo(1);
        assertThat(overview.passCount()).isEqualTo(1);
        assertThat(overview.complianceRate()).isEqualByComparingTo("100.00");
        assertThat(overview.latest().targetPercent()).isEqualByComparingTo("80.0");
        assertThat(overview.latest().targetSource()).isEqualTo("DEFAULT");
    }

    @Test
    void complianceChartAddsCurrentYearAndMapsFormMetric() {
        MyComplianceYearProjection previous = mock(MyComplianceYearProjection.class);
        when(previous.getYear()).thenReturn(LocalDate.now().getYear() - 1);
        when(submissionRepository.findScoredEvaluationYearsForSubject(anyLong(), anyString()))
                .thenReturn(List.of(previous));

        var chart = service.getComplianceChart(user, LocalDate.now().getYear());

        assertThat(chart.availableYears()).containsExactly(LocalDate.now().getYear(), LocalDate.now().getYear() - 1);
        assertThat(chart.items()).hasSize(1);
        assertThat(chart.items().get(0).evaluationCount()).isEqualTo(1);
        assertThat(chart.items().get(0).complianceRate()).isEqualByComparingTo("100.0");
    }
}
