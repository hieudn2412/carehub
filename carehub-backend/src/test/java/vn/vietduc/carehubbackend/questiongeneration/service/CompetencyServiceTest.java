package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.repository.FormRepository;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmission;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionContext;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionResult;
import vn.vietduc.carehubbackend.form.submission.repository.FormSubmissionRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CompetencyLevel;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.systemsettings.service.SystemSettingsService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CompetencyServiceTest {
    private ExamAttemptRepository attemptRepository;
    private FormSubmissionRepository submissionRepository;
    private UserRepository userRepository;
    private DepartmentRepository departmentRepository;
    private CompetencyClassificationService classificationService;
    private SystemSettingsService systemSettingsService;
    private CompetencyService service;
    private Department department;

    @BeforeEach
    void setUp() {
        attemptRepository = mock(ExamAttemptRepository.class);
        submissionRepository = mock(FormSubmissionRepository.class);
        FormRepository formRepository = mock(FormRepository.class);
        userRepository = mock(UserRepository.class);
        departmentRepository = mock(DepartmentRepository.class);
        QuestionCategoryRepository categoryRepository = mock(QuestionCategoryRepository.class);
        classificationService = mock(CompetencyClassificationService.class);
        systemSettingsService = mock(SystemSettingsService.class);
        service = new CompetencyService(
                attemptRepository,
                submissionRepository,
                formRepository,
                userRepository,
                departmentRepository,
                categoryRepository,
                classificationService,
                systemSettingsService
        );
        when(systemSettingsService.competencyTargetScore()).thenReturn(new BigDecimal("6.00"));
        ReflectionTestUtils.setField(service, "defaultComplianceTarget", 80.0d);

        department = Department.builder().id(10L).name("Khoa Nội").build();
        when(departmentRepository.findById(10L)).thenReturn(Optional.of(department));
        when(classificationService.classifyOverall(any())).thenReturn(CompetencyLevel.PROFICIENT);
    }

    @Test
    void summaryWithoutDepartmentReturnsEmployeesAcrossAllDepartments() {
        Department surgery = Department.builder().id(11L).name("Khoa Ngoại").build();
        User internalEmployee = User.builder()
                .id(20L)
                .employeeCode("NV020")
                .name("Nguyễn An")
                .department(department)
                .build();
        User surgeryEmployee = User.builder()
                .id(21L)
                .employeeCode("NV021")
                .name("Trần Bình")
                .department(surgery)
                .build();
        when(userRepository.findCompetencySummaryCandidates(isNull(), isNull(), any()))
                .thenReturn(new PageImpl<>(
                        List.of(internalEmployee, surgeryEmployee),
                        PageRequest.of(0, 10),
                        2
                ));

        var response = service.getSummary(
                null,
                LocalDate.now().minusDays(30),
                LocalDate.now(),
                null,
                PageRequest.of(0, 10)
        );

        assertThat(response.departmentId()).isNull();
        assertThat(response.departmentName()).isEqualTo("Toàn viện");
        assertThat(response.targetScore()).isEqualByComparingTo("6.00");
        assertThat(response.items())
                .extracting("employeeName", "departmentName")
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("Nguyễn An", "Khoa Nội"),
                        org.assertj.core.groups.Tuple.tuple("Trần Bình", "Khoa Ngoại")
                );
        assertThat(response.page()).isZero();
        assertThat(response.size()).isEqualTo(10);
        assertThat(response.totalElements()).isEqualTo(2);
        assertThat(response.totalPages()).isEqualTo(1);
        verify(userRepository).findCompetencySummaryCandidates(isNull(), isNull(), any());
        verify(departmentRepository, never()).findById(any());
        verify(attemptRepository).findScoredAttemptsByUserIdsAndDateRange(any(), any(), any());
        verify(attemptRepository, never()).findScoredAttemptsByUserAndDateRange(any(), any(), any());
        verify(submissionRepository).findScoredEvaluationsForCandidateUsers(any(), any(), any(), any());
        verify(submissionRepository, never()).findScoredEvaluationsForSubject(any(), any(), any(), any());
    }

    @Test
    void summaryLoadsOnlyEmployeesFromRequestedPage() {
        User employee = User.builder()
                .id(21L)
                .employeeCode("NV021")
                .name("Trần Bình")
                .department(department)
                .build();
        when(userRepository.findCompetencySummaryCandidates(
                isNull(), isNull(), any()
        )).thenReturn(new PageImpl<>(
                List.of(employee),
                PageRequest.of(1, 1),
                2
        ));

        var response = service.getSummary(
                null,
                LocalDate.now().minusDays(30),
                LocalDate.now(),
                null,
                PageRequest.of(1, 1)
        );

        assertThat(response.page()).isEqualTo(1);
        assertThat(response.size()).isEqualTo(1);
        assertThat(response.totalPages()).isEqualTo(2);
        assertThat(response.items()).extracting("employeeId").containsExactly(21L);
        verify(attemptRepository).findScoredAttemptsByUserIdsAndDateRange(
                argThat(ids -> ids.size() == 1 && ids.contains(21L)),
                any(),
                any()
        );
        verify(submissionRepository).findScoredEvaluationsForCandidateUsers(
                argThat(ids -> ids.size() == 1 && ids.contains(21L)),
                any(),
                any(),
                any()
        );
    }

    @Test
    void summaryUsesHospitalTargetInsteadOfDepartmentTarget() {
        department.setCompetencyTargetScore(new BigDecimal("9.00"));
        when(systemSettingsService.competencyTargetScore()).thenReturn(new BigDecimal("7.00"));
        User employee = User.builder()
                .id(20L)
                .employeeCode("NV020")
                .name("Nguyễn An")
                .department(department)
                .build();
        when(userRepository.findCompetencySummaryCandidates(eq(10L), isNull(), any()))
                .thenReturn(new PageImpl<>(List.of(employee), PageRequest.of(0, 10), 1));
        when(attemptRepository.findScoredAttemptsByUserIdsAndDateRange(any(), any(), any()))
                .thenReturn(List.of(ExamAttempt.builder()
                        .id(30L)
                        .user(employee)
                        .status(ExamAttemptStatus.GRADED)
                        .score(new BigDecimal("7.00"))
                        .build()));
        Form form = Form.builder().id(50L).title("Bảng kiểm truyền dịch").build();
        FormSubmission skillSubmission = submission(
                100L, employee, employee, form, "7.00", FormSubmissionResult.PASSED);
        skillSubmission.setConvertedScore(new BigDecimal("7.00"));
        when(submissionRepository.findScoredEvaluationsForCandidateUsers(any(), any(), any(), any()))
                .thenReturn(List.of(skillSubmission));

        var response = service.getSummary(
                10L,
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 8, 10),
                null,
                PageRequest.of(0, 10)
        );

        assertThat(response.items()).singleElement().satisfies(item -> {
            assertThat(item.examScore()).isEqualByComparingTo("7.00");
            assertThat(item.examAttemptCount()).isEqualTo(1);
            assertThat(item.overallScore()).isEqualByComparingTo("7.00");
            assertThat(item.isPassed()).isTrue();
        });
    }

    @Test
    void summaryUsesHospitalTargetWhenDepartmentHasNoStoredTarget() {
        department.setCompetencyTargetScore(null);
        when(userRepository.findCompetencySummaryCandidates(eq(10L), isNull(), any()))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));

        var response = service.getSummary(
                10L,
                LocalDate.of(2026, 1, 1),
                LocalDate.of(2026, 8, 10),
                null,
                PageRequest.of(0, 10)
        );

        assertThat(response.targetScore()).isEqualByComparingTo("6.00");
    }

    @Test
    void groupsTechniqueResultsBySubjectAndAppliesFormFilter() {
        User evaluator = User.builder()
                .id(90L)
                .employeeCode("QL090")
                .name("Trưởng khoa")
                .department(department)
                .build();
        User subject = User.builder()
                .id(20L)
                .employeeCode("NV020")
                .name("Nguyễn An")
                .department(department)
                .build();
        Form selectedForm = Form.builder().id(50L).title("Bảng kiểm truyền dịch").build();
        Form otherForm = Form.builder().id(60L).title("Bảng kiểm thay băng").build();

        FormSubmission selectedSubmission = submission(
                100L, evaluator, subject, selectedForm, "85.00", FormSubmissionResult.PASSED);
        FormSubmission otherSubmission = submission(
                101L, evaluator, subject, otherForm, "70.00", FormSubmissionResult.FAILED_SCORE);
        when(submissionRepository.findCompetencyTechniqueCandidates(
                eq(10L), eq(50L), isNull(), any(), any(), any()
        )).thenReturn(new PageImpl<>(List.of(subject), PageRequest.of(0, 10), 1));
        when(submissionRepository.findCompetencyTechniqueOptions(eq(10L), any(), any()))
                .thenReturn(List.of(
                        new vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyTechniqueOptionResponse(
                                60L, otherForm.getTitle()
                        ),
                        new vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyTechniqueOptionResponse(
                                50L, selectedForm.getTitle()
                        )
                ));
        when(submissionRepository.findScoredEvaluationsForTechniqueCandidates(
                any(), eq(50L), any(), any()
        )).thenReturn(List.of(selectedSubmission));

        var response = service.getByTechnique(
                10L,
                50L,
                LocalDate.now().minusDays(30),
                LocalDate.now(),
                null,
                PageRequest.of(0, 10)
        );

        assertThat(response.forms()).extracting("id").containsExactly(60L, 50L);
        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).employeeId()).isEqualTo(subject.getId());
        assertThat(response.items().get(0).employeeName()).isEqualTo(subject.getName());
        assertThat(response.items().get(0).evaluationCount()).isEqualTo(1);
        assertThat(response.items().get(0).averageScore()).isEqualByComparingTo("85.00");
        assertThat(response.items().get(0).passRate()).isEqualTo(100.0d);
    }

    @Test
    void techniqueWithoutDepartmentUsesAllDepartmentSubmissions() {
        Department surgery = Department.builder().id(11L).name("Khoa Ngoại").build();
        User evaluator = User.builder()
                .id(90L)
                .employeeCode("QL090")
                .name("Trưởng khoa")
                .department(department)
                .build();
        User subject = User.builder()
                .id(21L)
                .employeeCode("NV021")
                .name("Trần Bình")
                .department(surgery)
                .build();
        Form form = Form.builder().id(50L).title("Bảng kiểm truyền dịch").build();
        when(submissionRepository.findCompetencyTechniqueCandidates(
                isNull(), isNull(), isNull(), any(), any(), any()
        )).thenReturn(new PageImpl<>(List.of(subject), PageRequest.of(0, 10), 1));
        when(submissionRepository.findCompetencyTechniqueOptions(isNull(), any(), any()))
                .thenReturn(List.of(new vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyTechniqueOptionResponse(
                        form.getId(), form.getTitle()
                )));
        when(submissionRepository.findScoredEvaluationsForTechniqueCandidates(
                any(), isNull(), any(), any()
        )).thenReturn(List.of(submission(
                        100L, evaluator, subject, form, "85.00", FormSubmissionResult.PASSED
                )));

        var response = service.getByTechnique(
                null,
                null,
                LocalDate.now().minusDays(30),
                LocalDate.now(),
                null,
                PageRequest.of(0, 10)
        );

        assertThat(response.departmentId()).isNull();
        assertThat(response.departmentName()).isEqualTo("Toàn viện");
        assertThat(response.items()).singleElement()
                .extracting("employeeName", "departmentName")
                .containsExactly("Trần Bình", "Khoa Ngoại");
        verify(submissionRepository).findCompetencyTechniqueCandidates(
                isNull(), isNull(), isNull(), any(), any(), any()
        );
        verify(submissionRepository).findScoredEvaluationsForTechniqueCandidates(
                any(), isNull(), any(), any()
        );
    }

    @Test
    void techniqueUsesConvertedTenPointScoreForAverageAndClassification() {
        User evaluator = User.builder()
                .id(90L)
                .employeeCode("QL090")
                .name("Trưởng khoa")
                .department(department)
                .build();
        User subject = User.builder()
                .id(20L)
                .employeeCode("NV020")
                .name("Chu Văn Long")
                .department(department)
                .build();
        Form form = Form.builder().id(50L).title("THỤT THÁO").build();
        FormSubmission first = submission(100L, evaluator, subject, form, "1.50", FormSubmissionResult.PASSED);
        first.setMaxScore(new BigDecimal("1.50"));
        first.setConvertedScore(new BigDecimal("10.00"));
        FormSubmission second = submission(101L, evaluator, subject, form, "1.35555556", FormSubmissionResult.PASSED);
        second.setMaxScore(new BigDecimal("1.50"));
        second.setConvertedScore(new BigDecimal("9.04"));

        when(submissionRepository.findCompetencyTechniqueCandidates(
                eq(10L), eq(50L), isNull(), any(), any(), any()
        )).thenReturn(new PageImpl<>(List.of(subject), PageRequest.of(0, 10), 1));
        when(submissionRepository.findCompetencyTechniqueOptions(eq(10L), any(), any()))
                .thenReturn(List.of());
        when(submissionRepository.findScoredEvaluationsForTechniqueCandidates(
                any(), eq(50L), any(), any()
        )).thenReturn(List.of(first, second));

        var response = service.getByTechnique(
                10L,
                50L,
                LocalDate.now().minusDays(30),
                LocalDate.now(),
                null,
                PageRequest.of(0, 10)
        );

        assertThat(response.items()).singleElement().satisfies(item -> {
            assertThat(item.averageScore()).isEqualByComparingTo("9.52");
            assertThat(item.passRate()).isEqualTo(100.0d);
        });
        verify(classificationService).classifyOverall(new BigDecimal("9.52"));
    }

    @Test
    void employeeTechniqueUsesConvertedScoresForRowsAverageAndClassification() {
        User evaluator = User.builder()
                .id(90L)
                .employeeCode("QL090")
                .name("Trưởng khoa")
                .department(department)
                .build();
        User subject = User.builder()
                .id(338L)
                .employeeCode("VD01011")
                .name("Chu Văn Long")
                .department(department)
                .build();
        Form form = Form.builder().id(50L).title("THỤT THÁO").build();
        FormSubmission first = submission(100L, evaluator, subject, form, "1.50", FormSubmissionResult.PASSED);
        first.setMaxScore(new BigDecimal("1.50"));
        first.setConvertedScore(new BigDecimal("10.00"));
        FormSubmission second = submission(101L, evaluator, subject, form, "1.50", FormSubmissionResult.PASSED);
        second.setMaxScore(new BigDecimal("1.50"));
        second.setConvertedScore(new BigDecimal("10.00"));
        FormSubmission third = submission(102L, evaluator, subject, form, "1.35555556", FormSubmissionResult.PASSED);
        third.setMaxScore(new BigDecimal("1.50"));
        third.setConvertedScore(new BigDecimal("9.04"));

        when(userRepository.findById(338L)).thenReturn(Optional.of(subject));
        when(submissionRepository.findScoredEvaluationsForSubject(eq(338L), eq("VD01011"), any(), any()))
                .thenReturn(List.of(first, second, third));

        var response = service.getEmployeeByTechnique(
                338L,
                LocalDate.now().minusDays(30),
                LocalDate.now()
        );

        assertThat(response.overallAverageScore()).isEqualByComparingTo("9.68");
        assertThat(response.items()).singleElement().satisfies(item -> {
            assertThat(item.averageScore()).isEqualByComparingTo("9.68");
            assertThat(item.passCount()).isEqualTo(3);
            assertThat(item.passRate()).isEqualTo(100.0d);
            assertThat(item.attempts()).extracting("score")
                    .containsExactlyInAnyOrder(
                            new BigDecimal("10.00"),
                            new BigDecimal("10.00"),
                            new BigDecimal("9.04")
                    );
        });
        verify(classificationService).classifyOverall(new BigDecimal("9.68"));
        verify(classificationService, never()).classifyOverall(new BigDecimal("1.45"));
    }

    private FormSubmission submission(
            Long id,
            User evaluator,
            User subject,
            Form form,
            String score,
            FormSubmissionResult result
    ) {
        FormVersion version = FormVersion.builder()
                .id(form.getId() + 1)
                .form(form)
                .title(form.getTitle())
                .build();
        FormSubmission submission = FormSubmission.builder()
                .id(id)
                .formVersion(version)
                .submittedBy(evaluator)
                .totalScore(new BigDecimal(score))
                .result(result)
                .build();
        FormSubmissionContext context = FormSubmissionContext.builder()
                .id(id + 1000)
                .submission(submission)
                .subjectUser(subject)
                .employeeCode(subject.getEmployeeCode())
                .fullName(subject.getName())
                .build();
        submission.setSubjectContext(context);
        return submission;
    }
}
