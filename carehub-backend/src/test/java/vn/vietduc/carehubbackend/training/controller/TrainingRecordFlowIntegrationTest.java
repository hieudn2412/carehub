package vn.vietduc.carehubbackend.training.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import vn.vietduc.carehubbackend.config.CapturingEmailProducerConfig;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.entity.TrainingRecordChangeLog;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordChangeType;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingEvidenceFileRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordChangeLogRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.service.EvidenceStorageService;
import vn.vietduc.carehubbackend.training.service.impl.EvidenceObjectDeletionService;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * L2 integration tests — sheet {@code L2-TrainingRecords}, ids L2-TRN-15…18 (01–14 live in the
 * evidence/legacy-import ITs).
 *
 * <p>Not {@code @Transactional}: L2-TRN-17 asserts the AFTER_COMMIT storage cleanup, which only
 * fires on a real commit. Fixtures use unique codes; assertions are id-scoped.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Import(CapturingEmailProducerConfig.class)
class TrainingRecordFlowIntegrationTest {

    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private TrainingActivityTypeRepository activityTypeRepository;
    @Autowired
    private TrainingRecordRepository recordRepository;
    @Autowired
    private TrainingRecordChangeLogRepository changeLogRepository;
    @Autowired
    private TrainingEvidenceFileRepository evidenceFileRepository;
    @Autowired
    private EvidenceStorageService storageService;
    @Autowired
    private EvidenceObjectDeletionService deletionService;

    private int seq;
    private User owner;
    private User admin;
    private TrainingActivityType activityType;

    @BeforeEach
    void setUp() {
        seq = SEQ.incrementAndGet();
        owner = userRepository.save(User.builder()
                .employeeCode("TRNF%03d".formatted(seq))
                .email("trnf%03d@example.com".formatted(seq))
                .name("Record Owner " + seq)
                .password("secret")
                .status(UserStatus.ACTIVE)
                .build());
        admin = userRepository.save(User.builder()
                .employeeCode("TRNFA%03d".formatted(seq))
                .email("trnfa%03d@example.com".formatted(seq))
                .name("Record Admin " + seq)
                .password("secret")
                .status(UserStatus.ACTIVE)
                .build());
        activityType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("TRNF_TYPE_%03d".formatted(seq))
                .name("Flow Type " + seq)
                .defaultDurationUnit(DurationUnit.HOUR)
                .requiresEvidence(false)
                .active(true)
                .build());
    }

    @DisplayName("L2-TRN-15 | Transaction Boundary: submit flips DRAFT→SUBMITTED and writes exactly one SUBMITTED change-log row atomically")
    @Test
    void submitWritesRecordAndAuditLogTogether() throws Exception {
        TrainingRecord record = seedDraft();

        mockMvc.perform(post("/api/v1/training/records/{id}/submit", record.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\": %d}".formatted(record.getVersion()))
                        .with(jwtFor(owner, "USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.workflowStatus", containsString("SUBMITTED")));

        TrainingRecord reloaded = recordRepository.findById(record.getId()).orElseThrow();
        assertThat(reloaded.getWorkflowStatus()).isEqualTo(TrainingRecordStatus.SUBMITTED);
        assertThat(reloaded.getSubmittedAt()).isNotNull();

        List<TrainingRecordChangeLog> logs =
                changeLogRepository.findByTrainingRecord_IdOrderByChangedAtDesc(record.getId());
        assertThat(logs).hasSize(1);
        assertThat(logs.get(0).getChangeType()).isEqualTo(TrainingRecordChangeType.SUBMITTED);
    }

    @DisplayName("L2-TRN-16 | Negative: return-to-draft is admin-only after the merge — the owner is refused, the admin succeeds (D15)")
    @Test
    void returnToDraftIsAdminOnly() throws Exception {
        TrainingRecord record = seedSubmitted();

        // Pins D15: the owner passes the service's ownership check but the state machine now
        // requires adminActor for SUBMITTED→DRAFT, so the owner branch is dead code and the user
        // receives a 400 state-machine error instead of a 403.
        mockMvc.perform(post("/api/v1/training/records/{id}/return-to-draft", record.getId())
                        .with(jwtFor(owner, "USER")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message",
                        containsString("Không thể chuyển trạng thái hồ sơ đào tạo")));

        mockMvc.perform(post("/api/v1/training/records/{id}/return-to-draft", record.getId())
                        .with(jwtFor(admin, "ADMIN")))
                .andExpect(status().isOk());

        TrainingRecord reloaded = recordRepository.findById(record.getId()).orElseThrow();
        assertThat(reloaded.getWorkflowStatus()).isEqualTo(TrainingRecordStatus.DRAFT);
        assertThat(reloaded.getSubmittedAt()).isNull();
        assertThat(changeLogRepository.findByTrainingRecord_IdOrderByChangedAtDesc(record.getId()))
                .anySatisfy(log -> assertThat(log.getChangeType())
                        .isEqualTo(TrainingRecordChangeType.RETURNED_TO_DRAFT));
    }

    @DisplayName("L2-TRN-17 | Event Published: evidence delete must remove the stored object AND stamp storage_deleted_at after commit (D34)")
    @Test
    void evidenceDeleteCleansStorageAfterCommit() throws Exception {
        // EXPECTED TO FAIL until D34 is resolved. EvidenceObjectDeletionService.deleteAfterCommit
        // (AFTER_COMMIT, no transaction of its own) deletes the storage object, then
        // markStorageDeleted — a @Modifying JPQL update — throws
        // "InvalidDataAccessApiUsageException: No active transaction for update or delete query",
        // which deleteAndMark catches and logs. The stamp is only ever written by the 10-minute
        // retry sweep, which re-issues the (idempotent) storage delete first. Same root cause
        // family as D33: an AFTER_COMMIT listener doing writes without REQUIRES_NEW.
        TrainingRecord record = seedDraft();
        byte[] content = "evidence-bytes".getBytes(StandardCharsets.UTF_8);
        EvidenceStorageService.StoredEvidenceObject stored = storageService.store(
                new EvidenceStorageService.EvidenceObjectRequest(
                        record.getId(), "evidence.jpg", "image/jpeg", content.length, "chk-" + seq),
                content);
        TrainingEvidenceFile evidence = evidenceFileRepository.save(TrainingEvidenceFile.builder()
                .trainingRecord(record)
                .originalFilename("evidence.jpg")
                .objectKey(stored.objectKey())
                .mimeType("image/jpeg")
                .fileSizeBytes((long) content.length)
                .checksumSha256("chk-" + seq)
                .moderationStatus(EvidenceModerationStatus.PASSED)
                .uploadedByUser(owner)
                .active(true)
                .build());

        mockMvc.perform(delete("/api/v1/training/records/{recordId}/evidences/{evidenceId}",
                        record.getId(), evidence.getId())
                        .with(jwtFor(owner, "USER")))
                .andExpect(status().isOk());

        // This class is not @Transactional, so the delete transaction really committed and the
        // AFTER_COMMIT listener (EvidenceObjectDeletionService.deleteAfterCommit) already ran.
        TrainingEvidenceFile reloaded = evidenceFileRepository.findById(evidence.getId()).orElseThrow();
        assertThat(reloaded.isActive()).isFalse();
        assertThat(reloaded.getDeletedAt()).isNotNull();
        assertThat(reloaded.getStorageDeletedAt())
                .as("AFTER_COMMIT listener must remove the object and stamp storage_deleted_at")
                .isNotNull();
    }

    @DisplayName("L2-TRN-18 | Idempotency: the delete-retry job picks up rows whose storage cleanup never ran and stamps them")
    @Test
    void deleteRetryJobSweepsPendingRows() {
        TrainingRecord record = seedDraft();
        // A soft-deleted row whose AFTER_COMMIT cleanup was missed (storageDeletedAt == null):
        TrainingEvidenceFile orphan = evidenceFileRepository.save(TrainingEvidenceFile.builder()
                .trainingRecord(record)
                .originalFilename("orphan.jpg")
                .objectKey("training-records/%d/evidences/orphan-%d.jpg".formatted(record.getId(), seq))
                .mimeType("image/jpeg")
                .fileSizeBytes(10L)
                .checksumSha256("orphan-" + seq)
                .moderationStatus(EvidenceModerationStatus.PASSED)
                .uploadedByUser(owner)
                .active(false)
                .deletedAt(LocalDateTime.now().minusHours(1))
                .build());

        deletionService.retryPendingDeletes();

        TrainingEvidenceFile swept = evidenceFileRepository.findById(orphan.getId()).orElseThrow();
        assertThat(swept.getStorageDeletedAt())
                .as("the scheduled sweep must stamp rows it cleaned up")
                .isNotNull();

        // Second run is a no-op for this row (already stamped) — the sweep is idempotent.
        LocalDateTime firstStamp = swept.getStorageDeletedAt();
        deletionService.retryPendingDeletes();
        assertThat(evidenceFileRepository.findById(orphan.getId()).orElseThrow().getStorageDeletedAt())
                .isEqualTo(firstStamp);
    }

    // ── fixtures ──────────────────────────────────────────────────────────────

    private TrainingRecord seedDraft() {
        return recordRepository.save(baseRecord().workflowStatus(TrainingRecordStatus.DRAFT).build());
    }

    private TrainingRecord seedSubmitted() {
        return recordRepository.save(baseRecord()
                .workflowStatus(TrainingRecordStatus.SUBMITTED)
                .submittedAt(LocalDateTime.now().minusDays(1))
                .build());
    }

    private TrainingRecord.TrainingRecordBuilder baseRecord() {
        return TrainingRecord.builder()
                .employee(owner)
                .activityType(activityType)
                .title("Flow record " + seq)
                .startDate(LocalDate.of(2026, 6, 1))
                .endDate(LocalDate.of(2026, 6, 1))
                .durationUnit(DurationUnit.HOUR)
                .declaredHours(BigDecimal.valueOf(2))
                .editCount(0)
                .createdByUser(owner);
    }

    private RequestPostProcessor jwtFor(User user, String role) {
        return jwt()
                .jwt(token -> token
                        .subject(user.getId().toString())
                        .claim("roles", List.of(role))
                        .claim("employeeCode", user.getEmployeeCode()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }
}
