package vn.vietduc.carehubbackend.training.repository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.entity.TrainingRequirement;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Position;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.PositionRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class TrainingRepositoryIntegrationTest {
    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private PositionRepository positionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TrainingActivityTypeRepository activityTypeRepository;

    @Autowired
    private TrainingRequirementRepository requirementRepository;

    @Autowired
    private TrainingRecordRepository recordRepository;

    @Test
    void repositoriesPersistAndQueryTrainingFoundation() {
        Department department = departmentRepository.save(Department.builder()
                .name("Gây mê hồi sức")
                .departmentCode("GMHS")
                .build());
        Position position = positionRepository.save(Position.builder()
                .name("Bác sĩ")
                .build());
        User employee = userRepository.save(User.builder()
                .employeeCode("VD001")
                .name("Nguyễn Văn A")
                .password("encoded")
                .department(department)
                .position(position)
                .build());
        TrainingActivityType activityType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("CME")
                .name("Đào tạo liên tục")
                .defaultDurationUnit(DurationUnit.HOUR)
                .requiresEvidence(true)
                .build());
        TrainingRequirement requirement = requirementRepository.save(TrainingRequirement.builder()
                .code("REQ-GMHS-DR")
                .name("Yêu cầu CME bác sĩ GMHS")
                .department(department)
                .jobPosition(position)
                .requiredHours(BigDecimal.valueOf(120))
                .cycleYears(5)
                .effectiveFrom(LocalDate.of(2025, 1, 1))
                .build());
        recordRepository.save(TrainingRecord.builder()
                .employee(employee)
                .employeeDepartmentSnapshot(department)
                .activityType(activityType)
                .title("Khóa an toàn gây mê")
                .startDate(LocalDate.of(2026, 3, 10))
                .declaredHours(BigDecimal.valueOf(8))
                .workflowStatus(TrainingRecordStatus.SUBMITTED)
                .createdByUser(employee)
                .build());
        recordRepository.save(TrainingRecord.builder()
                .employee(employee)
                .employeeDepartmentSnapshot(department)
                .activityType(activityType)
                .title("Khóa nháp")
                .startDate(LocalDate.of(2026, 4, 10))
                .declaredHours(BigDecimal.valueOf(20))
                .workflowStatus(TrainingRecordStatus.DRAFT)
                .createdByUser(employee)
                .build());

        BigDecimal submittedHours = recordRepository.sumApprovedHoursForEmployee(
                employee.getId(),
                LocalDate.of(2021, 6, 16),
                LocalDate.of(2026, 6, 16)
        );
        var candidates = requirementRepository.findActiveCandidates(
                department.getId(),
                position.getId(),
                null,
                LocalDate.of(2026, 6, 16)
        );

        assertThat(activityTypeRepository.findByCode("CME")).contains(activityType);
        assertThat(submittedHours).isEqualByComparingTo("8");
        assertThat(candidates).contains(requirement);
    }
}
