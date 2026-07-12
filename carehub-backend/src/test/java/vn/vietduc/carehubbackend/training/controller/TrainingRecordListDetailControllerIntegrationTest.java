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
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.entity.TrainingRecordChangeLog;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordChangeType;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingSourceType;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingEvidenceFileRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordChangeLogRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
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
class TrainingRecordListDetailControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TrainingActivityTypeRepository activityTypeRepository;

    @Autowired
    private TrainingRecordRepository recordRepository;

    @Autowired
    private TrainingEvidenceFileRepository evidenceFileRepository;

    @Autowired
    private TrainingRecordChangeLogRepository changeLogRepository;

    private Department anesthesia;
    private Department surgery;
    private User user;
    private User manager;
    private User sameDepartmentEmployee;
    private User otherDepartmentEmployee;
    private TrainingActivityType activityType;
    private TrainingRecord ownDraft;
    private TrainingRecord ownSubmittedWithEvidence;
    private TrainingRecord sameDepartmentSubmitted;
    private TrainingRecord otherDepartmentRecord;

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
        user = saveUser("P9_USER", "p9-user@example.com", "Phase 9 User", anesthesia);
        manager = saveUser("P9_MANAGER", "p9-manager@example.com", "Phase 9 Manager", anesthesia);
        sameDepartmentEmployee = saveUser("P9_SAME", "p9-same@example.com", "Same Department", anesthesia);
        otherDepartmentEmployee = saveUser("P9_OTHER", "p9-other@example.com", "Other Department", surgery);
        activityType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("P9_TYPE")
                .name("Phase 9 Type")
                .defaultDurationUnit(DurationUnit.HOUR)
                .requiresEvidence(false)
                .active(true)
                .build());

        ownDraft = saveRecord(user, "Own Draft Course", "Internal", LocalDate.of(2026, 3, 1), TrainingRecordStatus.DRAFT);
        ownSubmittedWithEvidence = saveRecord(user, "Submitted Ultrasound", "Hospital Provider", LocalDate.of(2026, 3, 10), TrainingRecordStatus.SUBMITTED);
        saveEvidence(ownSubmittedWithEvidence, EvidenceModerationStatus.PASSED, true);
        saveChangeHistory(ownSubmittedWithEvidence);

        sameDepartmentSubmitted = saveRecord(sameDepartmentEmployee, "Same Dept Submitted", "Hospital Provider", LocalDate.of(2026, 3, 12), TrainingRecordStatus.SUBMITTED);
        saveEvidence(sameDepartmentSubmitted, EvidenceModerationStatus.ERROR, true);
        otherDepartmentRecord = saveRecord(otherDepartmentEmployee, "Other Dept Course", "External", LocalDate.of(2026, 3, 15), TrainingRecordStatus.DRAFT);
    }

    @Test
    void userListIsScopedToCurrentUserAndCannotUseEmployeeFilterToSeeOthers() throws Exception {
        mockMvc.perform(get("/api/v1/training/records")
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.content[0].employeeId").value(user.getId()));

        mockMvc.perform(get("/api/v1/training/records")
                        .queryParam("employeeId", otherDepartmentEmployee.getId().toString())
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0));
    }

    @Test
    void managerListIsScopedToOwnDepartment() throws Exception {
        mockMvc.perform(get("/api/v1/training/records")
                        .with(jwtFor(manager, "MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(3))
                .andExpect(content().string(not(containsString("Other Dept Course"))));

        mockMvc.perform(get("/api/v1/training/records")
                        .queryParam("employeeId", otherDepartmentEmployee.getId().toString())
                        .with(jwtFor(manager, "MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(0));
    }

    @Test
    void adminListSupportsCombinationFiltersPaginationAndSort() throws Exception {
        mockMvc.perform(get("/api/v1/training/records")
                        .queryParam("keyword", "ultrasound")
                        .queryParam("dateFrom", "2026-03-01")
                        .queryParam("dateTo", "2026-03-31")
                        .queryParam("activityTypeId", activityType.getId().toString())
                        .queryParam("workflowStatus", "SUBMITTED")
                        .queryParam("hasEvidence", "true")
                        .queryParam("moderationStatus", "PASSED")
                        .queryParam("sourceType", "MANUAL")
                        .queryParam("page", "0")
                        .queryParam("size", "1")
                        .queryParam("sort", "startDate,asc")
                        .with(jwtFor(manager, "ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].id").value(ownSubmittedWithEvidence.getId()))
                .andExpect(jsonPath("$.data.content[0].evidenceCount").value(1))
                .andExpect(jsonPath("$.data.content[0].passedEvidenceCount").value(1))
                .andExpect(jsonPath("$.data.sort[0]").value("startDate,asc"));
    }

    @Test
    void listRejectsInvalidDateRangeAndUnsupportedSort() throws Exception {
        mockMvc.perform(get("/api/v1/training/records")
                        .queryParam("dateFrom", "2026-04-01")
                        .queryParam("dateTo", "2026-03-01")
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/v1/training/records")
                        .queryParam("sort", "employee.name,asc")
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void detailIncludesEvidenceChangeHistoryAndDuplicateWarningWithoutInternalObjectKey() throws Exception {
        mockMvc.perform(get("/api/v1/training/records/{id}", ownSubmittedWithEvidence.getId())
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(ownSubmittedWithEvidence.getId()))
                .andExpect(jsonPath("$.data.evidences.length()").value(1))
                .andExpect(jsonPath("$.data.changeHistory.length()").value(1))
                .andExpect(content().string(not(containsString("object-key-secret"))));
    }

    @Test
    void detailReturnsForbiddenOutsideScopeAndNotFoundWhenMissing() throws Exception {
        mockMvc.perform(get("/api/v1/training/records/{id}", otherDepartmentRecord.getId())
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/training/records/{id}", 999999L)
                        .with(jwtFor(manager, "ADMIN")))
                .andExpect(status().isNotFound());
    }

    private User saveUser(String employeeCode, String email, String name, Department department) {
        return userRepository.save(User.builder()
                .employeeCode(employeeCode)
                .email(email)
                .name(name)
                .password("encoded")
                .department(department)
                .build());
    }

    private TrainingRecord saveRecord(User employee, String title, String provider, LocalDate startDate, TrainingRecordStatus status) {
        return recordRepository.save(TrainingRecord.builder()
                .employee(employee)
                .employeeDepartmentSnapshot(employee.getDepartment())
                .activityType(activityType)
                .title(title)
                .provider(provider)
                .startDate(startDate)
                .endDate(startDate)
                .durationUnit(DurationUnit.HOUR)
                .declaredHours(BigDecimal.valueOf(4))
                .workflowStatus(status)
                .submittedAt(status == TrainingRecordStatus.SUBMITTED ? LocalDateTime.of(2026, 3, 20, 9, 0) : null)
                .sourceType(TrainingSourceType.MANUAL)
                .createdByUser(employee)
                .updatedByUser(employee)
                .build());
    }

    private void saveEvidence(TrainingRecord record, EvidenceModerationStatus status, boolean active) {
        evidenceFileRepository.save(TrainingEvidenceFile.builder()
                .trainingRecord(record)
                .originalFilename("certificate.jpg")
                .objectKey("object-key-secret")
                .mimeType(MediaType.IMAGE_JPEG_VALUE)
                .fileSizeBytes(1024L)
                .checksumSha256("a".repeat(64))
                .moderationStatus(status)
                .moderationProvider("test")
                .moderationResult(Map.of("mock", true))
                .moderationCheckedAt(LocalDateTime.of(2026, 3, 20, 10, 0))
                .uploadedByUser(record.getEmployee())
                .uploadedAt(LocalDateTime.of(2026, 3, 20, 10, 0))
                .active(active)
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
                .changedAt(LocalDateTime.of(2026, 3, 21, 9, 0))
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
