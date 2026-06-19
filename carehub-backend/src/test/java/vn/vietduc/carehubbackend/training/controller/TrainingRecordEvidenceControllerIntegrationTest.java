package vn.vietduc.carehubbackend.training.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingEvidenceFileRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.service.EvidenceModerationService;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.net.URI;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.training.evidence.storage-dir=target/test-evidence-storage"
})
class TrainingRecordEvidenceControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private TrainingActivityTypeRepository activityTypeRepository;

    @Autowired
    private TrainingRecordRepository recordRepository;

    @Autowired
    private TrainingEvidenceFileRepository evidenceFileRepository;

    private Department anesthesia;
    private Department surgery;
    private User user;
    private User manager;
    private User otherEmployee;
    private TrainingActivityType evidenceRequiredType;
    private TrainingActivityType evidenceOptionalType;

    @BeforeEach
    void setUp() {
        anesthesia = departmentRepository.save(Department.builder()
                .departmentCode("AN")
                .name("Anesthesia")
                .build());
        surgery = departmentRepository.save(Department.builder()
                .departmentCode("SU")
                .name("Surgery")
                .build());
        user = saveUser("PHASE3_USER", "phase3-user@example.com", "Phase 3 User", anesthesia);
        manager = saveUser("PHASE3_MANAGER", "phase3-manager@example.com", "Phase 3 Manager", anesthesia);
        otherEmployee = saveUser("PHASE3_OTHER", "phase3-other@example.com", "Phase 3 Other", surgery);
        evidenceRequiredType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("REQ")
                .name("Required evidence")
                .defaultDurationUnit(DurationUnit.HOUR)
                .requiresEvidence(true)
                .active(true)
                .build());
        evidenceOptionalType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("OPT")
                .name("Optional evidence")
                .defaultDurationUnit(DurationUnit.HOUR)
                .requiresEvidence(false)
                .active(true)
                .build());
    }

    @Test
    void userCreatesDraftForSelfAndClientEmployeeIdIsIgnored() throws Exception {
        mockMvc.perform(post("/api/v1/training/records")
                        .with(jwtFor(user, "USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recordJson(otherEmployee.getId(), evidenceOptionalType.getId(), "Self course", "2", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.employeeId", is(user.getId().intValue())))
                .andExpect(jsonPath("$.data.workflowStatus", is("DRAFT")))
                .andExpect(jsonPath("$.data.duplicateWarning", is(false)));
    }

    @Test
    void managerCannotCreateForEmployeeInOtherDepartment() throws Exception {
        mockMvc.perform(post("/api/v1/training/records")
                        .with(jwtFor(manager, "MANAGER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recordJson(otherEmployee.getId(), evidenceOptionalType.getId(), "Out of scope", "2", null)))
                .andExpect(status().isForbidden());
    }

    @Test
    void uploadEvidenceAndSubmitValidRecord() throws Exception {
        Long recordId = createDraft(evidenceRequiredType, user, "Submit course", "2");

        mockMvc.perform(multipart("/api/v1/training/records/{id}/evidences", recordId)
                        .file(jpegFile("certificate.jpg", 1024))
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.moderationStatus", is("PASSED")))
                .andExpect(jsonPath("$.data.checksumSha256").exists());

        Long evidenceId = evidenceFileRepository.findByTrainingRecord_IdAndActiveTrue(recordId).get(0).getId();
        String downloadResponse = mockMvc.perform(post("/api/v1/training/records/{recordId}/evidences/{evidenceId}/download-url", recordId, evidenceId)
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.downloadUrl").exists())
                .andReturn()
                .getResponse()
                .getContentAsString();
        mockMvc.perform(get(URI.create(extractString(downloadResponse, "\"downloadUrl\":\"", "\""))))
                .andExpect(status().isOk());

        TrainingRecord record = recordRepository.findById(recordId).orElseThrow();
        mockMvc.perform(post("/api/v1/training/records/{id}/submit", recordId)
                        .with(jwtFor(user, "USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":" + record.getVersion() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.workflowStatus", is("PENDING_REVIEW")))
                .andExpect(jsonPath("$.data.submittedAt").exists());
    }

    @Test
    void recordOptionsAndDetailAreAvailableToAuthenticatedUser() throws Exception {
        Long recordId = createDraft(evidenceOptionalType, user, "Readable course", "2");

        mockMvc.perform(get("/api/v1/training/records/options")
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.activityTypes.length()", is(2)))
                .andExpect(jsonPath("$.data.activityTypes[0].id").exists());

        mockMvc.perform(get("/api/v1/training/records/{id}", recordId)
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title", is("Readable course")))
                .andExpect(jsonPath("$.data.workflowStatus", is("DRAFT")));
    }

    @Test
    void submitWithoutRequiredEvidenceReturnsValidationError() throws Exception {
        Long recordId = createDraft(evidenceRequiredType, user, "Missing evidence", "2");

        mockMvc.perform(post("/api/v1/training/records/{id}/submit", recordId)
                        .with(jwtFor(user, "USER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error_code", is("VAL_001")))
                .andExpect(jsonPath("$.details[0].field", is("evidence")));
    }

    @Test
    void validatesDateAndHourBoundaries() throws Exception {
        mockMvc.perform(post("/api/v1/training/records")
                        .with(jwtFor(user, "USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recordJson(null, evidenceOptionalType.getId(), "Bad date", "2", "\"endDate\":\"2026-01-31\",")))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/training/records")
                        .with(jwtFor(user, "USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recordJson(null, evidenceOptionalType.getId(), "Zero hours", "0", null)))
                .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(post("/api/v1/training/records")
                        .with(jwtFor(user, "USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recordJson(null, evidenceOptionalType.getId(), "Half hour", "0.5", null)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/training/records")
                        .with(jwtFor(user, "USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recordJson(null, evidenceOptionalType.getId(), "Day max", "24", null)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/training/records")
                        .with(jwtFor(user, "USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recordJson(null, evidenceOptionalType.getId(), "Too much", "24.01", null)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void duplicateCandidateReturnsWarning() throws Exception {
        createDraft(evidenceOptionalType, user, "Duplicate Course", "2");

        mockMvc.perform(post("/api/v1/training/records")
                        .with(jwtFor(user, "USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recordJson(null, evidenceOptionalType.getId(), " duplicate course ", "2", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.duplicateWarning", is(true)))
                .andExpect(jsonPath("$.data.duplicateCandidateCount", is(1)));
    }

    @Test
    void editLimitAndOptimisticLockingAreEnforced() throws Exception {
        TrainingRecord rejected = recordRepository.save(TrainingRecord.builder()
                .employee(user)
                .employeeDepartmentSnapshot(user.getDepartment())
                .activityType(evidenceOptionalType)
                .title("Rejected")
                .startDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 1, 1))
                .durationUnit(DurationUnit.HOUR)
                .declaredHours(BigDecimal.valueOf(2))
                .workflowStatus(TrainingRecordStatus.REJECTED)
                .editCount(2)
                .createdByUser(user)
                .build());

        mockMvc.perform(put("/api/v1/training/records/{id}", rejected.getId())
                        .with(jwtFor(user, "USER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(recordJson(null, evidenceOptionalType.getId(), "Rejected changed", "2", "\"version\":" + rejected.getVersion() + ",")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("edit limit")));

        TrainingRecord draft = recordRepository.save(TrainingRecord.builder()
                .employee(user)
                .employeeDepartmentSnapshot(user.getDepartment())
                .activityType(evidenceOptionalType)
                .title("Draft")
                .startDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 1, 1))
                .durationUnit(DurationUnit.HOUR)
                .declaredHours(BigDecimal.valueOf(2))
                .workflowStatus(TrainingRecordStatus.DRAFT)
                .createdByUser(user)
                .build());

        mockMvc.perform(put("/api/v1/training/records/{id}", draft.getId())
                        .with(jwtFor(user, "USER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(recordJson(null, evidenceOptionalType.getId(), "Draft changed", "2", "\"version\":99,")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("updated by another user")));
    }

    @Test
    void approvedRecordCannotBeEditedOrReceiveEvidence() throws Exception {
        TrainingRecord approved = recordRepository.save(TrainingRecord.builder()
                .employee(user)
                .employeeDepartmentSnapshot(user.getDepartment())
                .activityType(evidenceOptionalType)
                .title("Approved")
                .startDate(LocalDate.of(2026, 1, 1))
                .endDate(LocalDate.of(2026, 1, 1))
                .durationUnit(DurationUnit.HOUR)
                .declaredHours(BigDecimal.valueOf(2))
                .approvedHours(BigDecimal.valueOf(2))
                .workflowStatus(TrainingRecordStatus.APPROVED)
                .createdByUser(user)
                .build());

        mockMvc.perform(put("/api/v1/training/records/{id}", approved.getId())
                        .with(jwtFor(user, "USER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(recordJson(null, evidenceOptionalType.getId(), "Approved changed", "2", "\"version\":" + approved.getVersion() + ",")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("not editable")));

        mockMvc.perform(multipart("/api/v1/training/records/{id}/evidences", approved.getId())
                        .file(jpegFile("approved.jpg", 1024))
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("not editable")));
    }

    @Test
    void unauthorizedUserCannotAccessRecordEvidenceOrDownloadUrl() throws Exception {
        Long recordId = createDraft(evidenceOptionalType, user, "Private course", "2");
        mockMvc.perform(multipart("/api/v1/training/records/{id}/evidences", recordId)
                        .file(jpegFile("private.jpg", 1024))
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isOk());
        Long evidenceId = evidenceFileRepository.findByTrainingRecord_IdAndActiveTrue(recordId).get(0).getId();

        mockMvc.perform(get("/api/v1/training/records/{id}", recordId)
                        .with(jwtFor(otherEmployee, "USER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/training/records/{id}/evidences", recordId)
                        .with(jwtFor(otherEmployee, "USER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/training/records/{recordId}/evidences/{evidenceId}/download-url", recordId, evidenceId)
                        .with(jwtFor(otherEmployee, "USER")))
                .andExpect(status().isForbidden());
    }

    @Test
    void evidenceBoundaryMismatchDuplicateAndSoftDelete() throws Exception {
        Long recordId = createDraft(evidenceOptionalType, user, "Evidence checks", "2");

        mockMvc.perform(multipart("/api/v1/training/records/{id}/evidences", recordId)
                        .file(jpegFile("big.jpg", 5 * 1024 * 1024))
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fileSizeBytes", is(5 * 1024 * 1024)));

        mockMvc.perform(multipart("/api/v1/training/records/{id}/evidences", recordId)
                        .file(jpegFile("too-big.jpg", 5 * 1024 * 1024 + 1))
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(multipart("/api/v1/training/records/{id}/evidences", recordId)
                        .file(new MockMultipartFile("file", "fake.pdf", "application/pdf", jpegBytes(128)))
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isUnprocessableEntity());

        mockMvc.perform(multipart("/api/v1/training/records/{id}/evidences", recordId)
                        .file(jpegFile("copy.jpg", 5 * 1024 * 1024))
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isConflict());

        Long evidenceId = evidenceFileRepository.findByTrainingRecord_IdAndActiveTrue(recordId).get(0).getId();
        mockMvc.perform(delete("/api/v1/training/records/{recordId}/evidences/{evidenceId}", recordId, evidenceId)
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/training/records/{recordId}/evidences/{evidenceId}/download-url", recordId, evidenceId)
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isNotFound());
    }

    @Test
    void moderationFailedOrErrorDoesNotPersistEvidenceMetadata() throws Exception {
        Long failedRecordId = createDraft(evidenceOptionalType, user, "Moderation failed", "2");
        mockMvc.perform(multipart("/api/v1/training/records/{id}/evidences", failedRecordId)
                        .file(jpegFile("moderation-fail.jpg", 1024))
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isUnprocessableEntity());
        assertNoActiveEvidence(failedRecordId);

        Long errorRecordId = createDraft(evidenceOptionalType, user, "Moderation error", "2");
        mockMvc.perform(multipart("/api/v1/training/records/{id}/evidences", errorRecordId)
                        .file(jpegFile("moderation-error.jpg", 1024))
                        .with(jwtFor(user, "USER")))
                .andExpect(status().isConflict());
        assertNoActiveEvidence(errorRecordId);
    }

    @Test
    void activeTypeRequiredForCreate() throws Exception {
        evidenceOptionalType.setActive(false);
        activityTypeRepository.save(evidenceOptionalType);

        mockMvc.perform(post("/api/v1/training/records")
                        .with(jwtFor(user, "USER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(recordJson(null, evidenceOptionalType.getId(), "Inactive type", "2", null)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.details.length()", greaterThanOrEqualTo(1)));
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

    private Long createDraft(TrainingActivityType activityType, User actor, String title, String hours) throws Exception {
        String content = mockMvc.perform(post("/api/v1/training/records")
                        .with(jwtFor(actor, "USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recordJson(null, activityType.getId(), title, hours, null)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String marker = "\"id\":";
        int start = content.indexOf(marker) + marker.length();
        int end = content.indexOf(',', start);
        return Long.valueOf(content.substring(start, end));
    }

    private String recordJson(Long employeeId, Long activityTypeId, String title, String declaredHours, String extra) {
        return """
                {
                  "employeeId": %s,
                  "activityTypeId": %d,
                  "title": "%s",
                  "provider": "Hospital",
                  "description": "Description",
                  "startDate": "2026-02-01",
                  %s
                  "durationValue": %s,
                  "durationUnit": "HOUR",
                  "declaredHours": %s
                }
                """.formatted(
                employeeId == null ? "null" : employeeId,
                activityTypeId,
                title,
                extra == null ? "\"endDate\":\"2026-02-01\"," : extra,
                declaredHours,
                declaredHours
        );
    }

    private MockMultipartFile jpegFile(String filename, int size) {
        return new MockMultipartFile("file", filename, "image/jpeg", jpegBytes(size));
    }

    private byte[] jpegBytes(int size) {
        byte[] bytes = new byte[size];
        Arrays.fill(bytes, (byte) 1);
        bytes[0] = (byte) 0xFF;
        bytes[1] = (byte) 0xD8;
        bytes[2] = (byte) 0xFF;
        return bytes;
    }

    private void assertNoActiveEvidence(Long recordId) {
        if (!evidenceFileRepository.findByTrainingRecord_IdAndActiveTrue(recordId).isEmpty()) {
            throw new AssertionError("Expected no active evidence metadata for record " + recordId);
        }
    }

    private String extractString(String source, String prefix, String suffix) {
        int start = source.indexOf(prefix) + prefix.length();
        int end = source.indexOf(suffix, start);
        return source.substring(start, end);
    }

    private RequestPostProcessor jwtFor(User user, String role) {
        return jwt()
                .jwt(jwt -> jwt
                        .subject(user.getId().toString())
                        .claim("roles", List.of(role))
                        .claim("employeeCode", user.getEmployeeCode()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @TestConfiguration
    static class ModerationTestConfig {
        @Bean
        @Primary
        EvidenceModerationService evidenceModerationService() {
            return request -> {
                if (request.originalFilename().contains("moderation-fail")) {
                    return new EvidenceModerationService.EvidenceModerationResult(
                            EvidenceModerationStatus.FAILED,
                            "test-mock",
                            Map.of("reason", "forced_failure")
                    );
                }
                if (request.originalFilename().contains("moderation-error")) {
                    return new EvidenceModerationService.EvidenceModerationResult(
                            EvidenceModerationStatus.ERROR,
                            "test-mock",
                            Map.of("reason", "forced_error")
                    );
                }
                return new EvidenceModerationService.EvidenceModerationResult(
                        EvidenceModerationStatus.PASSED,
                        "test-mock",
                        Map.of("mock", true)
                );
            };
        }
    }
}
