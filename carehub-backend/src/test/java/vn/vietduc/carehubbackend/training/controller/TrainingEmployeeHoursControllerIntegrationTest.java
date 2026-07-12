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
import vn.vietduc.carehubbackend.training.entity.CmeScopeConfiguration;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.entity.TrainingRecordChangeLog;
import vn.vietduc.carehubbackend.training.entity.TrainingRequirement;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordChangeType;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.training.repository.CmeScopeConfigurationRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingEvidenceFileRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordChangeLogRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
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
import java.util.LinkedHashSet;
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
    private CmeScopeConfigurationRepository cmeScopeConfigurationRepository;

    @Autowired
    private TrainingRecordRepository recordRepository;

    @Autowired
    private TrainingEvidenceFileRepository evidenceFileRepository;

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
    private TrainingRecord submittedRecord1;
    private TrainingRecord draftRecord;
    private TrainingRecord cancelledRecord;

    @BeforeEach
    void setUp() {
        anesthesia = departmentRepository.save(Department.builder()
                .departmentCode("P9_AN")
                .name("Phase 9 Anesthesia")
                .build());
        surgery = departmentRepository.save(Department.builder()
                .departmentCode("P9_SU")
                .name("Phase 9 Surgery")
                .build());
        cmeScopeConfigurationRepository.saveAndFlush(CmeScopeConfiguration.builder()
                .scopeKey(CmeScopeConfiguration.CME_SCOPE_KEY)
                .departments(new LinkedHashSet<>(List.of(anesthesia)))
                .build());
        doctor = positionRepository.save(Position.builder().name("Phase 9 Doctor").build());
        nurse = positionRepository.save(Position.builder().name("Phase 9 Nurse").build());
        intensiveCare = professionalFieldRepository.save(ProfessionalField.builder()
                .code("P9_ICU")
                .name("Phase 9 ICU")
                .active(true)
                .build());
        admin = saveUser("P9_ADMIN", "p9-admin@example.com", "Phase 9 Admin", anesthesia, doctor);
        manager = saveUser("P9_MANAGER", "p9-manager@example.com", "Phase 9 Manager", anesthesia, doctor);
        doctorEmployee = saveUser("P9_EMP1", "p9-emp1@example.com", "Phase 9 Doctor Employee", anesthesia, doctor);
        nurseEmployee = saveUser("P9_NURSE", "p9-nurse@example.com", "Phase 9 Nurse Employee", anesthesia, nurse);
        otherDepartmentDoctor = saveUser("P9_OTHER", "p9-other@example.com", "Phase 9 Other Doctor", surgery, doctor);
        activityType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("P9_TYPE")
                .name("Phase 9 Type")
                .defaultDurationUnit(DurationUnit.HOUR)
                .requiresEvidence(false)
                .active(true)
                .build());

        saveRequirement("P9_DOCTOR_GLOBAL", "Doctor Global Requirement", BigDecimal.valueOf(100), doctor, null);
        saveRequirement("P9_AN_DOCTOR", "Anesthesia Doctor Requirement", BigDecimal.valueOf(120), doctor, anesthesia);

        submittedRecord1 = saveRecord(
                doctorEmployee,
                "Submitted Phase 9 Course",
                LocalDate.of(2024, 1, 1),
                TrainingRecordStatus.SUBMITTED,
                BigDecimal.valueOf(60)
        );
        draftRecord = saveRecord(
                doctorEmployee,
                "Draft Phase 9 Course",
                LocalDate.of(2025, 6, 1),
                TrainingRecordStatus.DRAFT,
                BigDecimal.valueOf(20)
        );
        cancelledRecord = saveRecord(
                doctorEmployee,
                "Cancelled Phase 9 Course",
                LocalDate.of(2025, 7, 1),
                TrainingRecordStatus.CANCELLED,
                BigDecimal.valueOf(5)
        );
        saveRecord(
                doctorEmployee,
                "Old Phase 9 Course",
                LocalDate.of(2020, 1, 1),
                TrainingRecordStatus.SUBMITTED,
                BigDecimal.valueOf(200)
        );
        saveRecord(
                doctorEmployee,
                "Draft Phase 9 Course 2",
                LocalDate.of(2026, 4, 1),
                TrainingRecordStatus.DRAFT,
                BigDecimal.valueOf(9)
        );
        saveRecord(
                nurseEmployee,
                "Unconfigured Nurse Course",
                LocalDate.of(2025, 3, 1),
                TrainingRecordStatus.SUBMITTED,
                BigDecimal.valueOf(10)
        );
        saveRecord(
                otherDepartmentDoctor,
                "Other Department Course",
                LocalDate.of(2025, 3, 1),
                TrainingRecordStatus.SUBMITTED,
                BigDecimal.valueOf(30)
        );
        saveEvidence(submittedRecord1, EvidenceModerationStatus.PASSED);
        saveEvidence(draftRecord, EvidenceModerationStatus.ERROR);
        saveChangeHistory(submittedRecord1);
    }

    @Test
    void employeeStatusListAggregatesScopesFiltersAndRequirementPriority() throws Exception {
        // Manager scoped to own department - should not see other department employees
        mockMvc.perform(get("/api/v1/training/employees/status")
                        .with(jwtFor(manager, "MANAGER"))
                        .param("asOf", "2026-06-20"))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("P9_OTHER"))));

        // Keyword filter finds specific employee with requirement
        mockMvc.perform(get("/api/v1/training/employees/status")
                        .with(jwtFor(manager, "MANAGER"))
                        .param("keyword", "P9_EMP1")
                        .param("asOf", "2026-06-20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].employeeCode").value("P9_EMP1"))
                .andExpect(jsonPath("$.data.content[0].requirementName").value("Anesthesia Doctor Requirement"))
                .andExpect(jsonPath("$.data.content[0].requiredHours").value(120))
                .andExpect(jsonPath("$.data.content[0].submittedHours").value(60.0))
                .andExpect(jsonPath("$.data.content[0].remainingHours").value(60.0))
                .andExpect(jsonPath("$.data.content[0].complianceStatus").value("NON_COMPLIANT"))
                .andExpect(jsonPath("$.data.content[0].lastTrainingDate").value("2026-04-01"));

        // NOT_CONFIGURED filter for nurse (no matching requirement)
        mockMvc.perform(get("/api/v1/training/employees/status")
                        .with(jwtFor(admin, "ADMIN"))
                        .param("keyword", "P9_NURSE")
                        .param("requirementConfigured", "false")
                        .param("asOf", "2026-06-20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].complianceStatus").value("NOT_CONFIGURED"));

        // Filter by submitted hours range + sort
        mockMvc.perform(get("/api/v1/training/employees/status")
                        .with(jwtFor(admin, "ADMIN"))
                        .param("submittedHoursMin", "50")
                        .param("submittedHoursMax", "70")
                        .param("asOf", "2026-06-20")
                        .param("sort", "submittedHours,desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content[0].employeeCode").value("P9_EMP1"));

        // Pagination
        mockMvc.perform(get("/api/v1/training/employees/status")
                        .with(jwtFor(admin, "ADMIN"))
                        .param("asOf", "2026-06-20")
                        .param("size", "1")
                        .param("page", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.size").value(1));

        // Regular USER cannot access
        mockMvc.perform(get("/api/v1/training/employees/status")
                        .with(jwtFor(doctorEmployee, "USER"))
                        .param("asOf", "2026-06-20"))
                .andExpect(status().isForbidden());
    }

    @Test
    void employeeDetailRecordsMatchStatusWindowAndScope() throws Exception {
        // Employee detail status
        mockMvc.perform(get("/api/v1/training/employees/{employeeId}/status", doctorEmployee.getId())
                        .with(jwtFor(manager, "MANAGER"))
                        .param("asOf", "2026-06-20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.submittedHours").value(60.0));

        // Employee ledger records - shows SUBMITTED, DRAFT, CANCELLED records in window
        // (4 records in window: 2024-01-01 SUBMITTED 60h, 2025-06-01 DRAFT 20h, 2025-07-01 CANCELLED 5h, 2026-04-01 DRAFT 9h)
        mockMvc.perform(get("/api/v1/training/employees/{employeeId}/records", doctorEmployee.getId())
                        .with(jwtFor(manager, "MANAGER"))
                        .param("asOf", "2026-06-20")
                        .param("sort", "startDate,asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(4))
                .andExpect(jsonPath("$.data.content[0].id").value(submittedRecord1.getId()))
                .andExpect(jsonPath("$.data.content[0].workflowStatus").value("SUBMITTED"))
                .andExpect(jsonPath("$.data.content[0].runningSubmittedHours").value(60.0))
                .andExpect(jsonPath("$.data.content[0].evidenceCount").value(1))
                .andExpect(jsonPath("$.data.content[0].passedEvidenceCount").value(1))
                .andExpect(jsonPath("$.data.content[0].changeLogCount").value(1))
                // DRAFT record: running stays at 60 (draft doesn't add)
                .andExpect(jsonPath("$.data.content[1].id").value(draftRecord.getId()))
                .andExpect(jsonPath("$.data.content[1].workflowStatus").value("DRAFT"))
                .andExpect(jsonPath("$.data.content[1].runningSubmittedHours").value(60.0))
                // CANCELLED record: running stays at 60 (cancelled doesn't add)
                .andExpect(jsonPath("$.data.content[2].id").value(cancelledRecord.getId()))
                .andExpect(jsonPath("$.data.content[2].workflowStatus").value("CANCELLED"))
                .andExpect(jsonPath("$.data.content[2].runningSubmittedHours").value(60.0));

        // Forbidden for out-of-scope employee
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
            BigDecimal declaredHours
    ) {
        return recordRepository.save(TrainingRecord.builder()
                .employee(employee)
                .employeeDepartmentSnapshot(employee.getDepartment())
                .activityType(activityType)
                .professionalField(intensiveCare)
                .title(title)
                .provider("Phase 9 Provider")
                .startDate(startDate)
                .endDate(startDate)
                .durationUnit(DurationUnit.HOUR)
                .declaredHours(declaredHours)
                .workflowStatus(status)
                .submittedAt(status == TrainingRecordStatus.SUBMITTED ? LocalDateTime.of(2026, 1, 10, 9, 0) : null)
                .createdByUser(employee)
                .updatedByUser(employee)
                .build());
    }

    private void saveEvidence(TrainingRecord record, EvidenceModerationStatus status) {
        evidenceFileRepository.save(TrainingEvidenceFile.builder()
                .trainingRecord(record)
                .originalFilename("phase9-certificate.jpg")
                .objectKey("phase9-secret-key")
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

    private void saveChangeHistory(TrainingRecord record) {
        changeLogRepository.save(TrainingRecordChangeLog.builder()
                .trainingRecord(record)
                .versionNo(record.getVersion())
                .changeType(TrainingRecordChangeType.SUBMITTED)
                .beforeData(Map.of("workflowStatus", "DRAFT"))
                .afterData(Map.of("workflowStatus", "SUBMITTED"))
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
