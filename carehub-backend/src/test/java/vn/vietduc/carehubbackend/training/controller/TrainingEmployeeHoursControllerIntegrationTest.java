package vn.vietduc.carehubbackend.training.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.entity.TrainingRecordChangeLog;
import vn.vietduc.carehubbackend.training.entity.TrainingRecordReview;
import vn.vietduc.carehubbackend.training.entity.TrainingRequirement;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;
import vn.vietduc.carehubbackend.training.enums.ReviewDecision;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordChangeType;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingEvidenceFileRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordChangeLogRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordReviewRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRequirementRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Position;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.PositionRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class TrainingEmployeeHoursControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private PositionRepository positionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProfessionalFieldRepository professionalFieldRepository;

    @Autowired
    private TrainingActivityTypeRepository activityTypeRepository;

    @Autowired
    private TrainingRequirementRepository requirementRepository;

    @Autowired
    private TrainingRecordRepository recordRepository;

    @Autowired
    private TrainingEvidenceFileRepository evidenceFileRepository;

    @Autowired
    private TrainingRecordReviewRepository reviewRepository;

    @Autowired
    private TrainingRecordChangeLogRepository changeLogRepository;

    private Department anesthesia;
    private Department surgery;
    private Position doctor;
    private Position nurse;
    private ProfessionalField intensiveCare;
    private User admin;
    private User manager;
    private User doctorEmployee;
    private User nurseEmployee;
    private User otherDepartmentDoctor;
    private TrainingActivityType activityType;
    private TrainingRecord approvedRecord;
    private TrainingRecord pendingRecord;
    private TrainingRecord rejectedRecord;

    @BeforeEach
    void setUp() {
        anesthesia = departmentRepository.save(Department.builder()
                .departmentCode("P6_AN")
                .name("Phase 6 Anesthesia")
                .build());
        surgery = departmentRepository.save(Department.builder()
                .departmentCode("P6_SU")
                .name("Phase 6 Surgery")
                .build());
        doctor = positionRepository.save(Position.builder().name("Phase 6 Doctor").build());
        nurse = positionRepository.save(Position.builder().name("Phase 6 Nurse").build());
        intensiveCare = professionalFieldRepository.save(ProfessionalField.builder()
                .code("P6_ICU")
                .name("Phase 6 ICU")
                .active(true)
                .build());
        admin = saveUser("P6_ADMIN", "p6-admin@example.com", "Phase 6 Admin", anesthesia, doctor);
        manager = saveUser("P6_MANAGER", "p6-manager@example.com", "Phase 6 Manager", anesthesia, doctor);
        doctorEmployee = saveUser("P6_EMP1", "p6-emp1@example.com", "Phase 6 Doctor Employee", anesthesia, doctor);
        nurseEmployee = saveUser("P6_NURSE", "p6-nurse@example.com", "Phase 6 Nurse Employee", anesthesia, nurse);
        otherDepartmentDoctor = saveUser("P6_OTHER", "p6-other@example.com", "Phase 6 Other Doctor", surgery, doctor);
        activityType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("P6_TYPE")
                .name("Phase 6 Type")
                .defaultDurationUnit(DurationUnit.HOUR)
                .requiresEvidence(false)
                .active(true)
                .build());

        saveRequirement("P6_DOCTOR_GLOBAL", "Doctor Global Requirement", BigDecimal.valueOf(100), doctor, null);
        saveRequirement("P6_AN_DOCTOR", "Anesthesia Doctor Requirement", BigDecimal.valueOf(120), doctor, anesthesia);

        approvedRecord = saveRecord(
                doctorEmployee,
                "Approved Phase 6 Course",
                LocalDate.of(2024, 1, 1),
                TrainingRecordStatus.APPROVED,
                BigDecimal.valueOf(60),
                BigDecimal.valueOf(60)
        );
        pendingRecord = saveRecord(
                doctorEmployee,
                "Pending Phase 6 Course",
                LocalDate.of(2025, 6, 1),
                TrainingRecordStatus.PENDING_REVIEW,
                BigDecimal.valueOf(20),
                null
        );
        rejectedRecord = saveRecord(
                doctorEmployee,
                "Rejected Phase 6 Course",
                LocalDate.of(2025, 7, 1),
                TrainingRecordStatus.REJECTED,
                BigDecimal.valueOf(5),
                null
        );
        saveRecord(
                doctorEmployee,
                "Old Phase 6 Course",
                LocalDate.of(2020, 1, 1),
                TrainingRecordStatus.APPROVED,
                BigDecimal.valueOf(200),
                BigDecimal.valueOf(200)
        );
        saveRecord(
                doctorEmployee,
                "Draft Phase 6 Course",
                LocalDate.of(2026, 4, 1),
                TrainingRecordStatus.DRAFT,
                BigDecimal.valueOf(9),
                null
        );
        saveRecord(
                nurseEmployee,
                "Unconfigured Nurse Course",
                LocalDate.of(2025, 3, 1),
                TrainingRecordStatus.APPROVED,
                BigDecimal.valueOf(10),
                BigDecimal.valueOf(10)
        );
        saveRecord(
                otherDepartmentDoctor,
                "Other Department Course",
                LocalDate.of(2025, 3, 1),
                TrainingRecordStatus.APPROVED,
                BigDecimal.valueOf(30),
                BigDecimal.valueOf(30)
        );
        saveEvidence(approvedRecord, EvidenceModerationStatus.PASSED);
        saveEvidence(pendingRecord, EvidenceModerationStatus.ERROR);
        saveReviewAndChangeHistory(approvedRecord);
    }

    @Test
    void employeeStatusListAggregatesScopesFiltersAndRequirementPriority() throws Exception {
        mockMvc.perform(get("/api/v1/training/employees/status")
                        .with(jwtFor(manager, "MANAGER"))
                        .param("asOf", "2026-06-20"))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("P6_OTHER"))));

        mockMvc.perform(get("/api/v1/training/employees/status")
                        .with(jwtFor(manager, "MANAGER"))
                        .param("keyword", "P6_EMP1")
                        .param("asOf", "2026-06-20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].employeeCode").value("P6_EMP1"))
                .andExpect(jsonPath("$.data.content[0].requirementName").value("Anesthesia Doctor Requirement"))
                .andExpect(jsonPath("$.data.content[0].requiredHours").value(120))
                .andExpect(jsonPath("$.data.content[0].approvedHours").value(60.0))
                .andExpect(jsonPath("$.data.content[0].pendingHours").value(20))
                .andExpect(jsonPath("$.data.content[0].rejectedHours").value(5))
                .andExpect(jsonPath("$.data.content[0].remainingHours").value(60.0))
                .andExpect(jsonPath("$.data.content[0].complianceStatus").value("NON_COMPLIANT"))
                .andExpect(jsonPath("$.data.content[0].lastTrainingDate").value("2025-07-01"))
                .andExpect(jsonPath("$.data.content[0].pendingReviewCount").value(1));

        mockMvc.perform(get("/api/v1/training/employees/status")
                        .with(jwtFor(admin, "ADMIN"))
                        .param("keyword", "P6_NURSE")
                        .param("requirementConfigured", "false")
                        .param("asOf", "2026-06-20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].complianceStatus").value("NOT_CONFIGURED"));

        mockMvc.perform(get("/api/v1/training/employees/status")
                        .with(jwtFor(admin, "ADMIN"))
                        .param("hasPendingReview", "true")
                        .param("approvedHoursMin", "50")
                        .param("approvedHoursMax", "70")
                        .param("asOf", "2026-06-20")
                        .param("sort", "approvedHours,desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].employeeCode").value("P6_EMP1"));

        mockMvc.perform(get("/api/v1/training/employees/status")
                        .with(jwtFor(admin, "ADMIN"))
                        .param("asOf", "2026-06-20")
                        .param("size", "1")
                        .param("page", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.size").value(1));

        mockMvc.perform(get("/api/v1/training/employees/status")
                        .with(jwtFor(doctorEmployee, "USER"))
                        .param("asOf", "2026-06-20"))
                .andExpect(status().isForbidden());
    }

    @Test
    void employeeDetailRecordsMatchStatusWindowAndScope() throws Exception {
        mockMvc.perform(get("/api/v1/training/employees/{employeeId}/status", doctorEmployee.getId())
                        .with(jwtFor(manager, "MANAGER"))
                        .param("asOf", "2026-06-20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.approvedHours").value(60.0))
                .andExpect(jsonPath("$.data.pendingHours").value(20))
                .andExpect(jsonPath("$.data.rejectedHours").value(5));

        mockMvc.perform(get("/api/v1/training/employees/{employeeId}/records", doctorEmployee.getId())
                        .with(jwtFor(manager, "MANAGER"))
                        .param("asOf", "2026-06-20")
                        .param("sort", "startDate,asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(3))
                .andExpect(jsonPath("$.data.content[0].id").value(approvedRecord.getId()))
                .andExpect(jsonPath("$.data.content[0].workflowStatus").value("APPROVED"))
                .andExpect(jsonPath("$.data.content[0].runningApprovedHours").value(60.0))
                .andExpect(jsonPath("$.data.content[0].evidenceCount").value(1))
                .andExpect(jsonPath("$.data.content[0].passedEvidenceCount").value(1))
                .andExpect(jsonPath("$.data.content[0].reviewCount").value(1))
                .andExpect(jsonPath("$.data.content[0].changeLogCount").value(1))
                .andExpect(jsonPath("$.data.content[1].id").value(pendingRecord.getId()))
                .andExpect(jsonPath("$.data.content[1].workflowStatus").value("PENDING_REVIEW"))
                .andExpect(jsonPath("$.data.content[1].runningApprovedHours").value(60.0))
                .andExpect(jsonPath("$.data.content[2].id").value(rejectedRecord.getId()))
                .andExpect(jsonPath("$.data.content[2].workflowStatus").value("REJECTED"))
                .andExpect(jsonPath("$.data.content[2].runningApprovedHours").value(60.0));

        mockMvc.perform(get("/api/v1/training/employees/{employeeId}/records", otherDepartmentDoctor.getId())
                        .with(jwtFor(manager, "MANAGER"))
                        .param("asOf", "2026-06-20"))
                .andExpect(status().isForbidden());
    }

    private User saveUser(String employeeCode, String email, String name, Department department, Position position) {
        return userRepository.save(User.builder()
                .employeeCode(employeeCode)
                .email(email)
                .name(name)
                .password("encoded")
                .department(department)
                .position(position)
                .build());
    }

    private void saveRequirement(
            String code,
            String name,
            BigDecimal requiredHours,
            Position position,
            Department department
    ) {
        requirementRepository.save(TrainingRequirement.builder()
                .code(code)
                .name(name)
                .requiredHours(requiredHours)
                .cycleYears(5)
                .jobPosition(position)
                .department(department)
                .effectiveFrom(LocalDate.of(2021, 1, 1))
                .active(true)
                .createdByUser(admin)
                .updatedByUser(admin)
                .build());
    }

    private TrainingRecord saveRecord(
            User employee,
            String title,
            LocalDate startDate,
            TrainingRecordStatus status,
            BigDecimal declaredHours,
            BigDecimal approvedHours
    ) {
        return recordRepository.save(TrainingRecord.builder()
                .employee(employee)
                .employeeDepartmentSnapshot(employee.getDepartment())
                .activityType(activityType)
                .professionalField(intensiveCare)
                .title(title)
                .provider("Phase 6 Provider")
                .startDate(startDate)
                .endDate(startDate)
                .durationUnit(DurationUnit.HOUR)
                .declaredHours(declaredHours)
                .approvedHours(approvedHours)
                .workflowStatus(status)
                .submittedAt(status == TrainingRecordStatus.DRAFT ? null : LocalDateTime.of(2026, 1, 10, 9, 0))
                .createdByUser(employee)
                .updatedByUser(employee)
                .build());
    }

    private void saveEvidence(TrainingRecord record, EvidenceModerationStatus status) {
        evidenceFileRepository.save(TrainingEvidenceFile.builder()
                .trainingRecord(record)
                .originalFilename("phase6-certificate.jpg")
                .objectKey("phase6-secret-key")
                .mimeType(MediaType.IMAGE_JPEG_VALUE)
                .fileSizeBytes(1024L)
                .checksumSha256("b".repeat(64))
                .moderationStatus(status)
                .moderationProvider("test")
                .moderationResult(Map.of("status", status.name()))
                .moderationCheckedAt(LocalDateTime.of(2026, 1, 10, 10, 0))
                .uploadedByUser(record.getEmployee())
                .uploadedAt(LocalDateTime.of(2026, 1, 10, 10, 0))
                .active(true)
                .build());
    }

    private void saveReviewAndChangeHistory(TrainingRecord record) {
        reviewRepository.save(TrainingRecordReview.builder()
                .trainingRecord(record)
                .decision(ReviewDecision.APPROVED)
                .declaredHoursSnapshot(record.getDeclaredHours())
                .approvedHours(record.getApprovedHours())
                .reason("Approved")
                .reviewedByUser(manager)
                .reviewedAt(LocalDateTime.of(2026, 1, 11, 9, 0))
                .build());
        changeLogRepository.save(TrainingRecordChangeLog.builder()
                .trainingRecord(record)
                .versionNo(record.getVersion())
                .changeType(TrainingRecordChangeType.UPDATED)
                .beforeData(Map.of("title", "Before"))
                .afterData(Map.of("title", record.getTitle()))
                .changedByUser(record.getEmployee())
                .changedAt(LocalDateTime.of(2026, 1, 9, 9, 0))
                .build());
    }

    private RequestPostProcessor jwtFor(User user, String role) {
        return jwt()
                .jwt(jwt -> jwt
                        .subject(user.getId().toString())
                        .claim("roles", List.of(role))
                        .claim("employeeCode", user.getEmployeeCode()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }
}
