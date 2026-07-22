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
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;

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
    private MyCompetencyService service;
    private User user;

    @BeforeEach
    void setUp() {
        attemptRepository = mock(ExamAttemptRepository.class);
        submissionRepository = mock(FormSubmissionRepository.class);
        classificationService = mock(CompetencyClassificationService.class);
        service = new MyCompetencyService(attemptRepository, submissionRepository, classificationService);

        Department department = Department.builder()
                .id(10L)
                .name("Khoa Nội")
                .competencyTargetScore(new BigDecimal("84.00"))
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
                .score(new BigDecimal("80.00"))
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

        assertThat(knowledge.overallAverage()).isEqualByComparingTo("80.00");
        assertThat(knowledge.items().get(0).attempts()).hasSize(1);
        assertThat(skills.overallAverage()).isEqualByComparingTo("90.00");
        assertThat(skills.items().get(0).attempts()).hasSize(1);
        assertThat(summary.overallScore()).isEqualByComparingTo("85.00");
        assertThat(summary.targetScore()).isEqualByComparingTo("84.00");
        assertThat(summary.isPassed()).isTrue();
    }

    @Test
    void totalMustBeStrictlyGreaterThanDepartmentTarget() {
        user.getDepartment().setCompetencyTargetScore(new BigDecimal("85.00"));

        var summary = service.getCompetencySummary(user, LocalDate.now().minusMonths(1), LocalDate.now());

        assertThat(summary.overallScore()).isEqualByComparingTo("85.00");
        assertThat(summary.isPassed()).isFalse();
    }
}
