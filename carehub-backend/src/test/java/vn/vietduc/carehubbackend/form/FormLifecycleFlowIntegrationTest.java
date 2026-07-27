package vn.vietduc.carehubbackend.form;

import com.jayway.jsonpath.JsonPath;
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
import vn.vietduc.carehubbackend.form.assignment.entity.FormAssignmentItem;
import vn.vietduc.carehubbackend.form.assignment.entity.FormAssignmentStatus;
import vn.vietduc.carehubbackend.form.assignment.repository.FormAssignmentItemRepository;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.form.repository.FormVersionRepository;
import vn.vietduc.carehubbackend.form.scoring.FormScoringRecalculationJob;
import vn.vietduc.carehubbackend.form.scoring.FormScoringRecalculationJobRepository;
import vn.vietduc.carehubbackend.form.scoring.FormScoringRecalculationJobService;
import vn.vietduc.carehubbackend.form.scoring.FormScoringRecalculationStatus;
import vn.vietduc.carehubbackend.notification.repository.NotificationRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * L2 integration tests — sheets {@code L2-FormBuilderScoring} (L2-QLT-08…10) and
 * {@code L2-FormSubmission} (L2-SCR-04…05).
 *
 * <p>Not {@code @Transactional}: the recalculation worker is an {@code @Async AFTER_COMMIT}
 * listener, the compliance-issue notification relies on committed dedup rows, and D28 needs the
 * request transaction to roll back independently of the test. Fixtures are built through the real
 * HTTP builder API (the {@code publishedAssignedForm} idiom) with unique codes per test.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Import(CapturingEmailProducerConfig.class)
class FormLifecycleFlowIntegrationTest {

    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private FormVersionRepository versionRepository;
    @Autowired
    private FormAssignmentItemRepository assignmentItemRepository;
    @Autowired
    private FormScoringRecalculationJobRepository jobRepository;
    @Autowired
    private FormScoringRecalculationJobService jobService;
    @Autowired
    private NotificationRepository notificationRepository;
    @Autowired
    private vn.vietduc.carehubbackend.notification.repository.NotificationConfigRepository notificationConfigRepository;

    private int seq;
    private User admin;
    private User manager;
    private User subject;
    private String questionKey;
    private String passOptionKey;
    private String failOptionKey;

    @BeforeEach
    void setUp() {
        seq = SEQ.incrementAndGet();
        admin = userRepository.save(user("QLTA"));
        manager = userRepository.save(user("QLTM"));
        subject = userRepository.save(user("QLTS"));
        questionKey = UUID.randomUUID().toString();
        passOptionKey = UUID.randomUUID().toString();
        failOptionKey = UUID.randomUUID().toString();
    }

    // ── publish: version retirement + assignment re-pointing ──────────────────

    @DisplayName("L2-QLT-08 | Transaction Boundary: publishing v2 retires v1 and re-points only ACTIVE assignment items")
    @Test
    void publishRepointsOnlyActiveItems() throws Exception {
        long formId = createForm();
        long v1 = createVersion(formId);
        publish(formId, v1);
        long activeItem = assign(v1, manager);
        long revokedItem = assign(v1, admin);
        FormAssignmentItem toRevoke = assignmentItemRepository.findById(revokedItem).orElseThrow();
        toRevoke.setStatus(FormAssignmentStatus.REVOKED);
        assignmentItemRepository.save(toRevoke);

        long v2 = createVersion(formId);
        publish(formId, v2);

        assertThat(versionRepository.findById(v1).orElseThrow().getStatus())
                .isEqualTo(FormVersionStatus.RETIRED);
        assertThat(versionRepository.findById(v2).orElseThrow().getStatus())
                .isEqualTo(FormVersionStatus.PUBLISHED);
        // The ACTIVE item silently follows the new published version…
        assertThat(assignmentItemRepository.findById(activeItem).orElseThrow().getFormVersion().getId())
                .isEqualTo(v2);
        // …while the REVOKED one keeps pointing at the retired v1.
        assertThat(assignmentItemRepository.findById(revokedItem).orElseThrow().getFormVersion().getId())
                .isEqualTo(v1);
    }

    // ── scoring recalculation job ─────────────────────────────────────────────

    @DisplayName("L2-QLT-09 | Event Published: a passing-score change on a PUBLISHED version schedules a recalculation job that completes")
    @Test
    void passingScoreChangeOnPublishedVersionSchedulesAndCompletesJob() throws Exception {
        long formId = createForm();
        long versionId = createVersion(formId);
        publish(formId, versionId);
        long lockVersion = scoringLockVersion(formId, versionId);

        mockMvc.perform(patch("/api/v1/forms/{f}/versions/{v}/scoring-configuration", formId, versionId)
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"passingScore\":{\"mode\":\"CUSTOM\",\"value\":7.5},\"lockVersion\":" + lockVersion + "}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.recalculationScheduled", is(true)));

        FormScoringRecalculationJob job = awaitLatestJob(versionId);
        assertThat(job.getStatus())
                .as("the AFTER_COMMIT async worker must pick the job up and complete it")
                .isEqualTo(FormScoringRecalculationStatus.COMPLETED);
        assertThat(versionRepository.findById(versionId).orElseThrow().getPassingScoreOverride())
                .isEqualByComparingTo("7.5");
    }

    @DisplayName("L2-QLT-10 | Idempotency: a stale RUNNING job is recovered to PENDING, and start() wins exactly once")
    @Test
    void staleRunningJobIsRecoveredAndStartIsCas() throws Exception {
        long formId = createForm();
        long versionId = createVersion(formId);
        publish(formId, versionId);
        // Seed a job that a crashed worker left RUNNING 10 minutes ago.
        FormScoringRecalculationJob stale = jobRepository.findAll().stream()
                .filter(j -> j.getFormVersion().getId().equals(versionId))
                .findFirst()
                .orElseGet(() -> {
                    var version = versionRepository.findById(versionId).orElseThrow();
                    return jobRepository.save(FormScoringRecalculationJob.builder()
                            .formVersion(version)
                            .status(FormScoringRecalculationStatus.RUNNING)
                            .targetMode(vn.vietduc.carehubbackend.form.scoring.PassingScoreMode.CUSTOM)
                            .previousMode(vn.vietduc.carehubbackend.form.scoring.PassingScoreMode.DEFAULT)
                            .startedAt(Instant.now().minusSeconds(600))
                            .build());
                });
        stale.setStatus(FormScoringRecalculationStatus.RUNNING);
        stale.setStartedAt(Instant.now().minusSeconds(600));
        jobRepository.save(stale);

        List<Long> pending = jobService.recoverAndFindPending();

        assertThat(pending).contains(stale.getId());
        assertThat(jobRepository.findById(stale.getId()).orElseThrow().getStatus())
                .isEqualTo(FormScoringRecalculationStatus.PENDING);

        // CAS: the first start() claims the job, the second returns false instead of double-running.
        assertThat(jobService.start(stale.getId())).isTrue();
        assertThat(jobService.start(stale.getId())).isFalse();
    }

    // ── submission: the direct-evaluation NPE and the compliance notification ─

    @DisplayName("L2-SCR-04 | Negative: a FAILED direct evaluation must persist, not roll back with an NPE-driven 500 (D28)")
    @Test
    void failedDirectEvaluationMustNotExplode() throws Exception {
        long formId = createForm();
        long versionId = createVersion(formId);
        publish(formId, versionId);

        String createResponse = mockMvc.perform(post("/api/v1/form-submissions")
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"formVersionId\": %d, \"subject\": {\"type\": \"USER\", \"employeeCode\": \"%s\"}}"
                                .formatted(versionId, subject.getEmployeeCode())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long submissionId = ((Number) JsonPath.read(createResponse, "$.data.id")).longValue();
        long lockVersion = ((Number) JsonPath.read(createResponse, "$.data.lockVersion")).longValue();

        String updateResponse = mockMvc.perform(put("/api/v1/form-submissions/{id}", submissionId)
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lockVersion\": %d, \"answers\": [{\"questionKey\": \"%s\", \"optionKey\": \"%s\"}]}"
                                .formatted(lockVersion, questionKey, failOptionKey)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long updatedLock = ((Number) JsonPath.read(updateResponse, "$.data.lockVersion")).longValue();

        mockMvc.perform(post("/api/v1/form-submissions/{id}/submission", submissionId)
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lockVersion\": %d}".formatted(updatedLock)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("SUBMITTED")))
                .andExpect(jsonPath("$.data.result", is("FAILED_SCORE")));
    }

    @DisplayName("L2-SCR-05 | Event Published: a FAILED assigned submission must raise one PERSONAL_COMPLIANCE_ISSUE notification (D35)")
    @Test
    void failedAssignedSubmissionNotifiesOnce() throws Exception {
        // EXPECTED TO FAIL until D35 is resolved. Proven by isolation probes: the identical event
        // dispatched with NO active transaction creates the row; published inside a real committed
        // transaction (exactly what submit() does) it vanishes without a row OR an error log.
        // Mechanism: NotificationEventListener runs AFTER_COMMIT and its downstream
        // @Transactional(REQUIRED) work JOINS the already-committed transaction, whose commit will
        // never happen again — the insert is silently discarded. Same root-cause family as
        // D33/D34; blast radius: EXAM_ASSIGNED, EXAM_PASSED and PERSONAL_COMPLIANCE_ISSUE
        // notifications all silently no-op whenever triggered from a transactional flow.
        // Fix: @Transactional(propagation = REQUIRES_NEW) (or @Async) on the listener chain.
        long formId = createForm();
        long versionId = createVersion(formId);
        publish(formId, versionId);
        enablePersonalCompliancePolicy();
        assign(versionId, manager);
        long itemId = assignmentItemRepository.findAll().stream()
                .filter(item -> item.getFormVersion().getId().equals(versionId))
                .findFirst().orElseThrow().getId();

        String createResponse = mockMvc.perform(post("/api/v1/form-submissions")
                        .with(jwtFor(manager, "MANAGER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assignmentItemId\": %d, \"subject\": {\"type\": \"USER\", \"employeeCode\": \"%s\"}}"
                                .formatted(itemId, subject.getEmployeeCode())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long submissionId = ((Number) JsonPath.read(createResponse, "$.data.id")).longValue();
        long lockVersion = ((Number) JsonPath.read(createResponse, "$.data.lockVersion")).longValue();

        String updateResponse = mockMvc.perform(put("/api/v1/form-submissions/{id}", submissionId)
                        .with(jwtFor(manager, "MANAGER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lockVersion\": %d, \"answers\": [{\"questionKey\": \"%s\", \"optionKey\": \"%s\"}]}"
                                .formatted(lockVersion, questionKey, failOptionKey)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        long updatedLock = ((Number) JsonPath.read(updateResponse, "$.data.lockVersion")).longValue();

        mockMvc.perform(post("/api/v1/form-submissions/{id}/submission", submissionId)
                        .with(jwtFor(manager, "MANAGER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lockVersion\": %d}".formatted(updatedLock)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.result", is("FAILED_SCORE")));

        assertThat(notificationRepository.findAll().stream()
                .filter(n -> n.getUser().getId().equals(subject.getId()))
                .filter(n -> n.getDedupKey() != null
                        && n.getDedupKey().endsWith("PERSONAL_COMPLIANCE:" + submissionId))
                .toList())
                .as("one FAILED submission → exactly one compliance notification")
                .hasSize(1);
    }

    // ── fixtures ──────────────────────────────────────────────────────────────

    /** PERSONAL_COMPLIANCE_ISSUE ships defaultEnabled=false — the flow only runs when an admin
     *  turns the policy on, so the test does the same through the config repository. */
    private void enablePersonalCompliancePolicy() {
        var config = notificationConfigRepository
                .findByEventType(vn.vietduc.carehubbackend.notification.entity.NotificationEventType.PERSONAL_COMPLIANCE_ISSUE)
                .orElseGet(() -> vn.vietduc.carehubbackend.notification.entity.NotificationConfig.builder()
                        .eventType(vn.vietduc.carehubbackend.notification.entity.NotificationEventType.PERSONAL_COMPLIANCE_ISSUE)
                        .build());
        config.setEnabled(true);
        config.setInAppEnabled(true);
        config.setEmailEnabled(false);
        config.setCadence(vn.vietduc.carehubbackend.notification.entity.NotificationCadence.IMMEDIATE);
        notificationConfigRepository.save(config);
    }

    private User user(String prefix) {
        return User.builder()
                .employeeCode("%s%03d".formatted(prefix, seq))
                .email("%s%03d@example.com".formatted(prefix.toLowerCase(), seq))
                .name(prefix + " " + seq)
                .password("secret")
                .status(UserStatus.ACTIVE)
                .build();
    }

    private long createForm() throws Exception {
        String response = mockMvc.perform(post("/api/v1/forms")
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"QLT_FLOW_%03d\",\"title\":\"Flow form %03d\",\"subjectType\":\"USER\"}"
                                .formatted(seq, seq)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(response, "$.data.id")).longValue();
    }

    private long createVersion(long formId) throws Exception {
        String body = """
                {
                  "title": "Flow form v",
                  "sections": [{
                    "sectionKey": "%s",
                    "title": "Checklist",
                    "displayOrder": 0,
                    "items": [{
                      "itemKey": "%s",
                      "itemType": "QUESTION",
                      "displayOrder": 0,
                      "question": {
                        "questionKey": "%s",
                        "code": "PASS_CHECK",
                        "title": "Pass check",
                        "fieldType": "SINGLE_CHOICE",
                        "required": true,
                        "weight": 1,
                        "options": [
                          {"optionKey": "%s", "value": "FAIL", "label": "Fail", "scoreValue": 0, "displayOrder": 0},
                          {"optionKey": "%s", "value": "PASS", "label": "Pass", "scoreValue": 1, "displayOrder": 1}
                        ]
                      }
                    }]
                  }]
                }
                """.formatted(UUID.randomUUID(), UUID.randomUUID(), questionKey, failOptionKey, passOptionKey);
        String response = mockMvc.perform(post("/api/v1/forms/{formId}/versions", formId)
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(response, "$.data.id")).longValue();
    }

    private void publish(long formId, long versionId) throws Exception {
        mockMvc.perform(post("/api/v1/forms/{f}/versions/{v}/publication", formId, versionId)
                        .with(jwtFor(admin, "ADMIN")))
                .andExpect(status().isOk());
    }

    private long assign(long versionId, User managerUser) throws Exception {
        String response = mockMvc.perform(post("/api/v1/form-assignments")
                        .with(jwtFor(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"managerId\": %d, \"formVersionIds\": [%d]}"
                                .formatted(managerUser.getId(), versionId)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return ((Number) JsonPath.read(response, "$.data.items[0].assignmentItemId")).longValue();
    }

    private long scoringLockVersion(long formId, long versionId) {
        Long lock = versionRepository.findById(versionId).orElseThrow().getLockVersion();
        return lock == null ? 0L : lock;
    }

    private FormScoringRecalculationJob awaitLatestJob(long versionId) throws InterruptedException {
        for (int i = 0; i < 50; i++) {
            var job = jobRepository.findAll().stream()
                    .filter(j -> j.getFormVersion().getId().equals(versionId))
                    .findFirst();
            if (job.isPresent() && job.get().getStatus() != FormScoringRecalculationStatus.PENDING
                    && job.get().getStatus() != FormScoringRecalculationStatus.RUNNING) {
                return job.get();
            }
            Thread.sleep(100);
        }
        return jobRepository.findAll().stream()
                .filter(j -> j.getFormVersion().getId().equals(versionId))
                .findFirst()
                .orElseThrow(() -> new AssertionError("no recalculation job was created for version " + versionId));
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
