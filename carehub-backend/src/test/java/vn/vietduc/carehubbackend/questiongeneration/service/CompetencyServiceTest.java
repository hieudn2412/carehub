package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.repository.FormRepository;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmission;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionContext;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionResult;
import vn.vietduc.carehubbackend.form.submission.repository.FormSubmissionRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CompetencyLevel;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CompetencyServiceTest {
    private FormSubmissionRepository submissionRepository;
    private CompetencyClassificationService classificationService;
    private CompetencyService service;
    private Department department;

    @BeforeEach
    void setUp() {
        ExamAttemptRepository attemptRepository = mock(ExamAttemptRepository.class);
        submissionRepository = mock(FormSubmissionRepository.class);
        FormRepository formRepository = mock(FormRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        DepartmentRepository departmentRepository = mock(DepartmentRepository.class);
        QuestionCategoryRepository categoryRepository = mock(QuestionCategoryRepository.class);
        classificationService = mock(CompetencyClassificationService.class);
        service = new CompetencyService(
                attemptRepository,
                submissionRepository,
                formRepository,
                userRepository,
                departmentRepository,
                categoryRepository,
                classificationService
        );
        ReflectionTestUtils.setField(service, "defaultComplianceTarget", 80.0d);

        department = Department.builder().id(10L).name("Khoa Nội").build();
        when(departmentRepository.findById(10L)).thenReturn(Optional.of(department));
        when(classificationService.classifyOverall(any())).thenReturn(CompetencyLevel.PROFICIENT);
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
        when(submissionRepository.findScoredEvaluationsForDepartment(
                eq(10L), any(), any()
        )).thenReturn(List.of(selectedSubmission, otherSubmission));

        var response = service.getByTechnique(
                10L,
                50L,
                LocalDate.now().minusDays(30),
                LocalDate.now()
        );

        assertThat(response.forms()).extracting("id").containsExactly(60L, 50L);
        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).employeeId()).isEqualTo(subject.getId());
        assertThat(response.items().get(0).employeeName()).isEqualTo(subject.getName());
        assertThat(response.items().get(0).evaluationCount()).isEqualTo(1);
        assertThat(response.items().get(0).averageScore()).isEqualByComparingTo("85.00");
        assertThat(response.items().get(0).passRate()).isEqualTo(100.0d);
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
