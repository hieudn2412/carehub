package vn.vietduc.carehubbackend.api;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.user.entity.User;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * L3 system/API tests — sheet {@code L3-TrainingAPI}, ids L3-TRN-01…18.
 *
 * <p>Covers the CME training-record contract over HTTP: the {@code PageResponse} envelope and its
 * sort whitelist, bean validation vs domain validation (422 vs 400), the DRAFT→SUBMITTED state gate,
 * the evidence upload pipeline (magic-byte/mime agreement, moderation, presigned download URL) and
 * the role gate on the employee-status list.
 */
class TrainingApiSystemTest extends AbstractApiSystemTest {

    @Autowired
    private TrainingActivityTypeRepository activityTypeRepository;

    private TrainingActivityType activityType;
    private User owner;
    private User other;
    private User admin;
    private String ownerToken;
    private String otherToken;
    private String adminToken;

    @BeforeEach
    void createFixtures() {
        int n = nextSeq();
        activityType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("L3TRN%04d".formatted(n))
                .name("L3 activity " + n)
                .defaultDurationUnit(DurationUnit.HOUR)
                .requiresEvidence(false)
                .active(true)
                .build());
        owner = newUser("L3TOWN", "USER");
        other = newUser("L3TOTH", "USER");
        admin = newUser("L3TADM", "ADMIN");
        ownerToken = tokenFor(owner);
        otherToken = tokenFor(other);
        adminToken = tokenFor(admin);
    }

    @DisplayName("L3-TRN-01 | Pagination: GET /training/records?page=0&size=20 → 200 with the full PageResponse envelope and sort 'updatedAt,desc'")
    @Test
    void listRecordsUsesThePageResponseEnvelope() {
        createRecord(ownerToken, "Paging probe " + nextSeq());

        ResponseEntity<String> response = get(API + "/training/records?page=0&size=20", ownerToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode page = data(response);
        assertThat(page.get("content").isArray()).isTrue();
        assertThat(page.get("page").asInt()).isZero();
        assertThat(page.get("size").asInt()).isEqualTo(20);
        assertThat(page.has("totalElements")).isTrue();
        assertThat(page.has("totalPages")).isTrue();
        assertThat(page.get("sort").toString()).contains("updatedAt,desc");
    }

    @DisplayName("L3-TRN-02 | Input-Domain-Invalid: an unsupported sort property → 400 REQ_001 naming the rejected property")
    @Test
    void unsupportedSortPropertyIsRejected() {
        ResponseEntity<String> response = get(API + "/training/records?sort=secretColumn,desc", ownerToken);

        assertError(response, HttpStatus.BAD_REQUEST, "REQ_001");
        assertThat(json(response).get("message").asText()).contains("secretColumn");
    }

    @DisplayName("L3-TRN-03 | Input-Domain-Happy: POST /training/records → 200 (not 201) with workflowStatus DRAFT, sourceType MANUAL, editCount 0, version 0")
    @Test
    void createRecordStartsAsADraft() {
        ResponseEntity<String> response = post(API + "/training/records", ownerToken,
                recordBody("Khóa đào tạo " + nextSeq(), "2.0", "2026-06-01", "2026-06-01"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = data(response);
        assertThat(body.get("workflowStatus").asText()).isEqualTo("DRAFT");
        assertThat(body.get("sourceType").asText()).isEqualTo("MANUAL");
        assertThat(body.get("editCount").asInt()).isZero();
        assertThat(body.get("version").asLong()).isZero();
        assertThat(body.get("submittedAt").isNull()).isTrue();
        assertThat(body.get("employeeId").asLong()).isEqualTo(owner.getId());
    }

    @DisplayName("L3-TRN-04 | Validation: POST without activityTypeId, title and durationUnit → 422 VAL_001 listing all three fields")
    @Test
    void createRecordValidatesMandatoryFields() {
        ResponseEntity<String> response = post(API + "/training/records", ownerToken,
                """
                {"provider":"Bệnh viện","startDate":"2026-06-01"}
                """);

        assertError(response, HttpStatus.UNPROCESSABLE_ENTITY, "VAL_001");
        String details = json(response).get("details").toString();
        assertThat(details).contains("activityTypeId").contains("title").contains("durationUnit");
    }

    @DisplayName("L3-TRN-05 | Input-Domain-Invalid: declaredHours=0.4 breaches the @DecimalMin(0.5) boundary → 422 VAL_001")
    @Test
    void declaredHoursBelowTheMinimumIsRejected() {
        ResponseEntity<String> response = post(API + "/training/records", ownerToken,
                recordBody("Dưới ngưỡng " + nextSeq(), "0.4", "2026-06-01", "2026-06-01"));

        assertError(response, HttpStatus.UNPROCESSABLE_ENTITY, "VAL_001");
        assertThat(json(response).get("details").toString()).contains("declaredHours");
    }

    @DisplayName("L3-TRN-06 | Input-Domain-Invalid: endDate before startDate → 400 REQ_001 'End date must be greater than or equal to start date'")
    @Test
    void endDateBeforeStartDateIsRejected() {
        ResponseEntity<String> response = post(API + "/training/records", ownerToken,
                recordBody("Ngày sai " + nextSeq(), "2.0", "2026-06-10", "2026-06-01"));

        assertError(response, HttpStatus.BAD_REQUEST, "REQ_001");
        assertThat(json(response).get("message").asText())
                .isEqualTo("End date must be greater than or equal to start date");
    }

    @DisplayName("L3-TRN-07 | Auth-Wrong-Role: another employee updating my draft → 403 AUTH_002 and the row is untouched")
    @Test
    void anotherEmployeeCannotUpdateMyDraft() {
        long recordId = createRecord(ownerToken, "Hồ sơ riêng " + nextSeq());

        ResponseEntity<String> response = put(API + "/training/records/" + recordId, otherToken,
                recordBody("Bị chiếm quyền", "2.0", "2026-06-01", "2026-06-01"));

        assertError(response, HttpStatus.FORBIDDEN, "AUTH_002");
        assertThat(data(get(API + "/training/records/" + recordId, ownerToken)).get("title").asText())
                .doesNotContain("Bị chiếm quyền");
    }

    @DisplayName("L3-TRN-08 | Input-Domain-Happy: POST /{id}/submit → SUBMITTED with submittedAt set and version bumped")
    @Test
    void submitMovesTheRecordToSubmitted() {
        long recordId = createRecord(ownerToken, "Nộp hồ sơ " + nextSeq());

        ResponseEntity<String> response = post(API + "/training/records/" + recordId + "/submit", ownerToken, "{}");

        assertOk(response);
        JsonNode body = data(response);
        assertThat(body.get("workflowStatus").asText()).isEqualTo("SUBMITTED");
        assertThat(body.get("submittedAt").isNull()).isFalse();
        assertThat(body.get("version").asLong()).isPositive();
    }

    @DisplayName("L3-TRN-09 | State-Conflict: submitting an already SUBMITTED record → 400 REQ_001 'Hồ sơ đào tạo ở trạng thái SUBMITTED không thể chỉnh sửa'")
    @Test
    void resubmittingASubmittedRecordIsRejected() {
        long recordId = createRecord(ownerToken, "Nộp hai lần " + nextSeq());
        assertOk(post(API + "/training/records/" + recordId + "/submit", ownerToken, "{}"));

        ResponseEntity<String> response = post(API + "/training/records/" + recordId + "/submit", ownerToken, "{}");

        // The editability guard runs before the state machine, so the wire contract is 400 REQ_001 —
        // not the 409 a state-transition rejection would suggest.
        assertError(response, HttpStatus.BAD_REQUEST, "REQ_001");
        assertThat(json(response).get("message").asText())
                .isEqualTo("Hồ sơ đào tạo ở trạng thái SUBMITTED không thể chỉnh sửa");
    }

    @DisplayName("L3-TRN-10 | Input-Domain-Happy: the owner can return their own SUBMITTED record to draft → DRAFT")
    @Test
    void ownerCanReturnTheirOwnRecordToDraft() {
        long recordId = createRecord(ownerToken, "Trả nháp " + nextSeq());
        assertOk(post(API + "/training/records/" + recordId + "/submit", ownerToken, "{}"));

        ResponseEntity<String> response =
                post(API + "/training/records/" + recordId + "/return-to-draft", ownerToken, "{}");

        assertOk(response);
        JsonNode body = data(response);
        assertThat(body.get("workflowStatus").asText()).isEqualTo("DRAFT");
        assertThat(body.get("submittedAt").isNull()).isTrue();
    }

    @DisplayName("L3-TRN-11 | Input-Domain-Happy: an ADMIN can return a submitted record to draft → DRAFT with submittedAt cleared")
    @Test
    void adminCanReturnASubmittedRecordToDraft() {
        long recordId = createRecord(ownerToken, "Admin trả nháp " + nextSeq());
        assertOk(post(API + "/training/records/" + recordId + "/submit", ownerToken, "{}"));

        ResponseEntity<String> response =
                post(API + "/training/records/" + recordId + "/return-to-draft", adminToken, "{}");

        assertOk(response);
        JsonNode body = data(response);
        assertThat(body.get("workflowStatus").asText()).isEqualTo("DRAFT");
        assertThat(body.get("submittedAt").isNull()).isTrue();
    }

    @DisplayName("L3-TRN-12 | Not-Found: GET /training/records/{unknownId} → 404 SYS_404")
    @Test
    void unknownRecordIdIsNotFound() {
        assertError(get(API + "/training/records/99999999", ownerToken), HttpStatus.NOT_FOUND, "SYS_404");
    }

    @DisplayName("L3-TRN-13 | Input-Domain-Happy: multipart PNG evidence upload → 200 with moderationStatus PASSED and a stored checksum")
    @Test
    void uploadingPngEvidencePassesModeration() {
        long recordId = createRecord(ownerToken, "Có minh chứng " + nextSeq());

        ResponseEntity<String> response = upload(
                API + "/training/records/" + recordId + "/evidences", ownerToken,
                "file", "evidence.png", pngBytes(), MediaType.IMAGE_PNG);

        assertOk(response);
        JsonNode body = data(response);
        assertThat(body.get("moderationStatus").asText()).isEqualTo("PASSED");
        assertThat(body.get("mimeType").asText()).isEqualTo("image/png");
        assertThat(body.get("storedChecksumSha256").asText()).isNotBlank();
        assertThat(body.get("active").asBoolean()).isTrue();
    }

    @DisplayName("L3-TRN-14 | Input-Domain-Invalid: PNG bytes declared as application/pdf → 422 VAL_001 'Evidence file content must match an allowed JPG, PNG, or PDF'")
    @Test
    void mismatchedMimeTypeIsRejected() {
        long recordId = createRecord(ownerToken, "Sai định dạng " + nextSeq());

        ResponseEntity<String> response = upload(
                API + "/training/records/" + recordId + "/evidences", ownerToken,
                "file", "evidence.pdf", pngBytes(), MediaType.APPLICATION_PDF);

        assertError(response, HttpStatus.UNPROCESSABLE_ENTITY, "VAL_001");
        assertThat(json(response).get("details").toString())
                .contains("Evidence file content must match an allowed JPG, PNG, or PDF");
    }

    @DisplayName("L3-TRN-15 | Input-Domain-Happy: POST /evidences/{id}/download-url → 200 with a time-limited URL from the storage adapter")
    @Test
    void downloadUrlIsIssuedForStoredEvidence() {
        long recordId = createRecord(ownerToken, "Tải minh chứng " + nextSeq());
        long evidenceId = data(upload(API + "/training/records/" + recordId + "/evidences", ownerToken,
                "file", "evidence.png", pngBytes(), MediaType.IMAGE_PNG)).get("id").asLong();

        ResponseEntity<String> response = post(
                API + "/training/records/" + recordId + "/evidences/" + evidenceId + "/download-url",
                ownerToken, "{}");

        assertOk(response);
        JsonNode body = data(response);
        assertThat(body.get("downloadUrl").asText()).startsWith("https://evidence.test/");
        assertThat(body.get("expiresAt").isNull()).isFalse();
    }

    @DisplayName("L3-TRN-16 | Auth-Wrong-Role: GET /training/employees/status with a USER token → 403 AUTH_002")
    @Test
    void employeeStatusListIsClosedToPlainUsers() {
        assertError(get(API + "/training/employees/status", ownerToken), HttpStatus.FORBIDDEN, "AUTH_002");
    }

    @DisplayName("L3-TRN-17 | Pagination: GET /training/employees/status as ADMIN → 200 sorted by employeeCode,asc with the compliance fields present")
    @Test
    void adminReadsTheEmployeeStatusList() {
        ResponseEntity<String> response = get(API + "/training/employees/status?page=0&size=20", adminToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode page = data(response);
        assertThat(page.get("sort").toString()).contains("employeeCode,asc");
        assertThat(page.get("content").isArray()).isTrue();
        if (!page.get("content").isEmpty()) {
            JsonNode row = page.get("content").get(0);
            assertThat(row.has("requiredHours")).isTrue();
            assertThat(row.has("submittedHours")).isTrue();
            assertThat(row.has("complianceStatus")).isTrue();
        }
    }

    @DisplayName("L3-TRN-18 | Contract: GET /training/status/me counts only SUBMITTED hours for the caller")
    @Test
    void personalStatusCountsSubmittedHoursOnly() {
        long submitted = createRecord(ownerToken, "Đã nộp " + nextSeq());
        assertOk(post(API + "/training/records/" + submitted + "/submit", ownerToken, "{}"));
        createRecord(ownerToken, "Vẫn nháp " + nextSeq());

        ResponseEntity<String> response = get(API + "/training/status/me", ownerToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = data(response);
        assertThat(body.get("employeeId").asLong()).isEqualTo(owner.getId());
        assertThat(body.get("submittedHours").asDouble()).isEqualTo(2.0);
        assertThat(body.has("requiredHours")).isTrue();
        assertThat(body.has("remainingHours")).isTrue();
    }

    // ------------------------------------------------------------------ helpers

    private long createRecord(String token, String title) {
        ResponseEntity<String> response = post(API + "/training/records", token,
                recordBody(title, "2.0", "2026-06-01", "2026-06-01"));
        assertOk(response);
        return id(response);
    }

    private String recordBody(String title, String declaredHours, String startDate, String endDate) {
        return """
                {"activityTypeId":%d,"title":"%s","provider":"Bệnh viện Việt Đức",
                 "description":"L3 system test","startDate":"%s","endDate":"%s",
                 "durationValue":%s,"durationUnit":"HOUR","declaredHours":%s}
                """.formatted(activityType.getId(), title, startDate, endDate, declaredHours, declaredHours);
    }

    /** A genuine PNG — the upload pipeline sniffs magic bytes and rejects fabricated content. */
    private byte[] pngBytes() {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB), "png", out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("cannot build a PNG fixture", e);
        }
    }
}
