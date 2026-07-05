package vn.vietduc.carehubbackend.questiongeneration.service;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateExamAssignmentRequest;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignmentTarget;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentTargetRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ExamAssignmentServiceTest {
    private final ExamAssignmentRepository assignmentRepository = mock(ExamAssignmentRepository.class);
    private final ExamAssignmentTargetRepository targetRepository = mock(ExamAssignmentTargetRepository.class);
    private final ExamAttemptRepository attemptRepository = mock(ExamAttemptRepository.class);
    private final ExamPaperRepository examPaperRepository = mock(ExamPaperRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final DepartmentRepository departmentRepository = mock(DepartmentRepository.class);
    private ExamAssignmentService service;

    @BeforeEach
    void setUp() {
        service = new ExamAssignmentService(
                assignmentRepository,
                targetRepository,
                attemptRepository,
                examPaperRepository,
                userRepository,
                departmentRepository
        );
    }

    @Test
    void resultsAndExportIncludeTargetsWithoutAttempts() throws Exception {
        ExamPaper paper = ExamPaper.builder()
                .id(10L)
                .code("EP-10")
                .name("Đề kiểm tra an toàn")
                .status(ExamPaperStatus.PUBLISHED)
                .totalQuestions(10)
                .timeLimitMinutes(30)
                .passingScore(70)
                .version(1)
                .randomSeed(1L)
                .build();
        ExamAssignment assignment = ExamAssignment.builder()
                .id(20L)
                .name("Đợt kiểm tra tháng 7")
                .examPaper(paper)
                .status(ExamAssignmentStatus.OPEN)
                .maxAttempts(2)
                .build();
        Department department = Department.builder()
                .id(30L)
                .name("Khoa Nội")
                .build();
        User gradedUser = user(40L, "NV001", "Nguyễn Văn A", department);
        User notStartedUser = user(41L, "NV002", "Trần Thị B", department);
        ExamAttempt gradedAttempt = ExamAttempt.builder()
                .id(50L)
                .assignment(assignment)
                .examPaper(paper)
                .user(gradedUser)
                .attemptNumber(1)
                .status(ExamAttemptStatus.GRADED)
                .startedAt(LocalDateTime.of(2026, 7, 3, 9, 0))
                .submittedAt(LocalDateTime.of(2026, 7, 3, 9, 20))
                .score(BigDecimal.valueOf(80))
                .correctCount(8)
                .totalQuestions(10)
                .passed(true)
                .timeSpentSeconds(1200)
                .build();
        when(assignmentRepository.findById(assignment.getId())).thenReturn(Optional.of(assignment));
        when(targetRepository.findByAssignmentOrderByUserEmployeeCodeAsc(assignment)).thenReturn(List.of(
                target(assignment, gradedUser),
                target(assignment, notStartedUser)
        ));
        when(attemptRepository.findByAssignmentOrderByStartedAtDesc(assignment)).thenReturn(List.of(gradedAttempt));

        var results = service.results(assignment.getId());

        assertThat(results.targetCount()).isEqualTo(2);
        assertThat(results.gradedCount()).isEqualTo(1);
        assertThat(results.notStartedCount()).isEqualTo(1);
        assertThat(results.averageScore()).isEqualByComparingTo("80.00");
        assertThat(results.rows()).extracting("userName").containsExactly("Nguyễn Văn A", "Trần Thị B");
        assertThat(results.rows().get(1).latestStatusText()).isEqualTo("Chưa làm");

        byte[] export = service.exportResultsXlsx(assignment.getId());
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(export))) {
            assertThat(workbook.getSheetAt(0).getRow(0).getCell(1).getStringCellValue())
                    .isEqualTo("Đợt kiểm tra tháng 7");
            assertThat(workbook.getSheetAt(0).getRow(6).getCell(1).getStringCellValue())
                    .isEqualTo("Nguyễn Văn A");
            assertThat(workbook.getSheetAt(0).getRow(7).getCell(4).getStringCellValue())
                    .isEqualTo("Chưa làm");
        }
    }

    @Test
    void createExpandsDepartmentTargetsAndDeduplicatesUsers() {
        ExamPaper paper = ExamPaper.builder()
                .id(10L)
                .code("EP-10")
                .name("Đề kiểm tra an toàn")
                .status(ExamPaperStatus.PUBLISHED)
                .totalQuestions(10)
                .timeLimitMinutes(30)
                .passingScore(70)
                .version(1)
                .randomSeed(1L)
                .build();
        Department department = Department.builder()
                .id(30L)
                .name("Khoa Nội")
                .build();
        User explicitUser = user(40L, "NV001", "Nguyễn Văn A", department);
        User departmentUser = user(41L, "NV002", "Trần Thị B", department);
        List<ExamAssignmentTarget> savedTargets = new ArrayList<>();

        when(examPaperRepository.findById(paper.getId())).thenReturn(Optional.of(paper));
        when(departmentRepository.findAllById(any())).thenReturn(List.of(department));
        when(userRepository.findByDepartment_IdInAndIsDeletedFalse(any())).thenReturn(List.of(explicitUser, departmentUser));
        when(userRepository.findAllById(any())).thenReturn(List.of(explicitUser, departmentUser));
        when(assignmentRepository.save(any(ExamAssignment.class))).thenAnswer(invocation -> {
            ExamAssignment assignment = invocation.getArgument(0);
            assignment.setId(20L);
            return assignment;
        });
        when(targetRepository.save(any(ExamAssignmentTarget.class))).thenAnswer(invocation -> {
            ExamAssignmentTarget target = invocation.getArgument(0);
            savedTargets.add(target);
            return target;
        });
        when(targetRepository.findByAssignmentOrderByUserEmployeeCodeAsc(any())).thenAnswer(invocation -> savedTargets);
        when(targetRepository.countByAssignment(any())).thenAnswer(invocation -> (long) savedTargets.size());
        when(attemptRepository.findByAssignmentOrderByStartedAtDesc(any())).thenReturn(List.of());

        var response = service.create(new CreateExamAssignmentRequest(
                "Đợt kiểm tra tháng 7",
                null,
                paper.getId(),
                List.of(explicitUser.getId()),
                List.of(department.getId()),
                null,
                2,
                "SCORE_AND_ANSWERS",
                "OPEN"
        ), "admin");

        assertThat(response.targetCount()).isEqualTo(2);
        assertThat(response.resultVisibility()).isEqualTo("SCORE_AND_ANSWERS");
        assertThat(savedTargets)
                .extracting(target -> target.getUser().getId())
                .containsExactly(explicitUser.getId(), departmentUser.getId());
    }

    private ExamAssignmentTarget target(ExamAssignment assignment, User user) {
        return ExamAssignmentTarget.builder()
                .assignment(assignment)
                .user(user)
                .build();
    }

    private User user(Long id, String employeeCode, String name, Department department) {
        return User.builder()
                .id(id)
                .employeeCode(employeeCode)
                .name(name)
                .password("secret")
                .department(department)
                .build();
    }
}
