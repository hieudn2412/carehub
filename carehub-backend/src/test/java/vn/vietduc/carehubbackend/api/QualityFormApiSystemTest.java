package vn.vietduc.carehubbackend.api;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import vn.vietduc.carehubbackend.user.entity.User;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * L3 system/API tests — sheet {@code L3-QualityAPI}, ids L3-QLT-01…19.
 *
 * <p>Walks the dynamic-checklist contract over HTTP: form CRUD and its 201/204 status codes, the
 * draft→published version lifecycle with optimistic locking, publish-time validation, assignment,
 * and the submission scoring round trip.
 *
 * <p>Two contract quirks are pinned here: reading someone else's assigned form answers <b>404</b>
 * (not 403), and re-submitting a submitted form answers 409 with
 * {@code "Only a draft submission can be modified"} rather than a state-machine message.
 */
class QualityFormApiSystemTest extends AbstractApiSystemTest {

    private User admin;
    private User manager;
    private User outsider;
    private String adminToken;
    private String managerToken;
    private String outsiderToken;

    @BeforeEach
    void createFixtures() {
        admin = newUser("L3QADM", "ADMIN");
        manager = newUser("L3QMGR", "USER");
        outsider = newUser("L3QOUT", "USER");
        adminToken = tokenFor(admin);
        managerToken = tokenFor(manager);
        outsiderToken = tokenFor(outsider);
    }

    @DisplayName("L3-QLT-01 | Pagination: GET /forms as ADMIN → 200 with the PageResponse envelope sorted updatedAt,desc")
    @Test
    void listFormsUsesThePageResponseEnvelope() {
        createForm();

        ResponseEntity<String> response = get(API + "/forms?page=0&size=20", adminToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode page = data(response);
        assertThat(page.get("content").isArray()).isTrue();
        assertThat(page.get("size").asInt()).isEqualTo(20);
        assertThat(page.get("sort").toString()).contains("updatedAt,desc");
    }

    @DisplayName("L3-QLT-02 | Input-Domain-Invalid: GET /forms?size=200 exceeds the 100-row cap → 422 VAL_001 on field 'size'")
    @Test
    void pageSizeAboveTheCapIsRejected() {
        ResponseEntity<String> response = get(API + "/forms?size=200", adminToken);

        assertError(response, HttpStatus.UNPROCESSABLE_ENTITY, "VAL_001");
        assertThat(json(response).get("details").toString()).contains("size");
    }

    @DisplayName("L3-QLT-03 | Input-Domain-Happy: POST /forms → 201 + Location, code upper-cased, status DRAFT")
    @Test
    void createFormReturns201AndNormalisesTheCode() {
        String code = "l3-form-%04d".formatted(nextSeq());

        ResponseEntity<String> response = post(API + "/forms", adminToken, """
                {"code":" %s ","title":"Bảng kiểm L3","description":"system test","subjectType":"USER"}
                """.formatted(code));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getHeaders().getLocation()).isNotNull();
        JsonNode body = data(response);
        assertThat(body.get("code").asText()).isEqualTo(code.toUpperCase());
        assertThat(body.get("status").asText()).isEqualTo("DRAFT");
    }

    @DisplayName("L3-QLT-04 | Validation: POST /forms without title/subjectType and with an illegal code → 422 VAL_001 per field")
    @Test
    void createFormValidatesTheRequestBody() {
        ResponseEntity<String> response = post(API + "/forms", adminToken, """
                {"code":"bad code!"}
                """);

        assertError(response, HttpStatus.UNPROCESSABLE_ENTITY, "VAL_001");
        String details = json(response).get("details").toString();
        assertThat(details).contains("title").contains("subjectType").contains("code");
    }

    @DisplayName("L3-QLT-05 | State-Conflict: POST /forms with a code that already exists → 409 SYS_409 'Form code already exists'")
    @Test
    void duplicateFormCodeIsRejected() {
        String code = "L3DUP%04d".formatted(nextSeq());
        assertThat(post(API + "/forms", adminToken, formBody(code)).getStatusCode()).isEqualTo(HttpStatus.CREATED);

        ResponseEntity<String> response = post(API + "/forms", adminToken, formBody(code));

        assertError(response, HttpStatus.CONFLICT, "SYS_409");
        assertThat(json(response).get("message").asText()).isEqualTo("Form code already exists");
    }

    @DisplayName("L3-QLT-06 | Input-Domain-Happy: POST /forms/{id}/versions → 201 with versionNumber 1, status DRAFT and a lockVersion token")
    @Test
    void createVersionReturnsADraftWithALockToken() {
        long formId = createForm();

        ResponseEntity<String> response = post(API + "/forms/" + formId + "/versions", adminToken, versionBody());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode body = data(response);
        assertThat(body.get("versionNumber").asInt()).isEqualTo(1);
        assertThat(body.get("status").asText()).isEqualTo("DRAFT");
        assertThat(body.get("lockVersion").isNull()).isFalse();
        assertThat(body.get("sections")).hasSize(1);
    }

    @DisplayName("L3-QLT-07 | State-Conflict: a second draft while one is open → 409 SYS_409 'This form already has a draft version'")
    @Test
    void onlyOneDraftVersionIsAllowed() {
        long formId = createForm();
        assertThat(post(API + "/forms/" + formId + "/versions", adminToken, versionBody()).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);

        ResponseEntity<String> response = post(API + "/forms/" + formId + "/versions", adminToken, versionBody());

        assertError(response, HttpStatus.CONFLICT, "SYS_409");
        assertThat(json(response).get("message").asText()).isEqualTo("This form already has a draft version");
    }

    @DisplayName("L3-QLT-08 | Contract: publishing a draft → 200 PUBLISHED with schemaHash, publishedAt and publishedBy, and the form points at it")
    @Test
    void publishingADraftStampsTheVersion() {
        long formId = createForm();
        long versionId = createVersion(formId);

        ResponseEntity<String> response =
                post(API + "/forms/" + formId + "/versions/" + versionId + "/publication", adminToken, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = data(response);
        assertThat(body.get("status").asText()).isEqualTo("PUBLISHED");
        assertThat(body.get("schemaHash").asText()).isNotBlank();
        assertThat(body.get("publishedAt").isNull()).isFalse();
        assertThat(body.get("publishedBy").get("employeeCode").asText()).isEqualTo(admin.getEmployeeCode());

        JsonNode form = data(get(API + "/forms/" + formId, adminToken));
        assertThat(form.get("status").asText()).isEqualTo("PUBLISHED");
        assertThat(form.get("currentPublishedVersion").get("id").asLong()).isEqualTo(versionId);
    }

    @DisplayName("L3-QLT-09 | Validation: publishing a version with no sections → 422 VAL_001 'A published form must contain at least one section'")
    @Test
    void publishingAnEmptyVersionIsRejected() {
        long formId = createForm();
        long versionId = id(post(API + "/forms/" + formId + "/versions", adminToken, "{}"));

        ResponseEntity<String> response =
                post(API + "/forms/" + formId + "/versions/" + versionId + "/publication", adminToken, null);

        assertError(response, HttpStatus.UNPROCESSABLE_ENTITY, "VAL_001");
        assertThat(json(response).get("details").toString())
                .contains("A published form must contain at least one section");
    }

    @DisplayName("L3-QLT-10 | State-Conflict: PUT a draft version with a stale lockVersion → 409 SYS_409 'Form version has been updated by another user'")
    @Test
    void staleLockVersionIsRejected() {
        long formId = createForm();
        ResponseEntity<String> created = post(API + "/forms/" + formId + "/versions", adminToken, versionBody());
        long versionId = id(created);
        long lockVersion = data(created).get("lockVersion").asLong();
        // First write succeeds and increments the token, so replaying it is a genuine stale update.
        assertOk(put(API + "/forms/" + formId + "/versions/" + versionId, adminToken,
                versionBodyWithLock(lockVersion)));

        ResponseEntity<String> response = put(API + "/forms/" + formId + "/versions/" + versionId, adminToken,
                versionBodyWithLock(lockVersion));

        assertError(response, HttpStatus.CONFLICT, "SYS_409");
        assertThat(json(response).get("message").asText())
                .isEqualTo("Form version has been updated by another user");
    }

    @DisplayName("L3-QLT-11 | Contract: publishing v2 retires v1 — GET /forms/{id}/versions/{v1} reports RETIRED")
    @Test
    void publishingASecondVersionRetiresTheFirst() {
        long formId = createForm();
        long firstVersion = createVersion(formId);
        assertOk(post(API + "/forms/" + formId + "/versions/" + firstVersion + "/publication", adminToken, null));
        long secondVersion = createVersion(formId);

        assertOk(post(API + "/forms/" + formId + "/versions/" + secondVersion + "/publication", adminToken, null));

        JsonNode retired = data(get(API + "/forms/" + formId + "/versions/" + firstVersion, adminToken));
        assertThat(retired.get("status").asText()).isEqualTo("RETIRED");
        assertThat(data(get(API + "/forms/" + formId, adminToken))
                .get("currentPublishedVersion").get("id").asLong()).isEqualTo(secondVersion);
    }

    @DisplayName("L3-QLT-12 | Input-Domain-Happy: DELETE /forms/{id} → 204 with no envelope, and the form then reads 404 SYS_404")
    @Test
    void deleteFormIsASoftDeleteReturning204() {
        long formId = createForm();

        ResponseEntity<String> response = delete(API + "/forms/" + formId, adminToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(response.getBody()).isNullOrEmpty();
        assertError(get(API + "/forms/" + formId, adminToken), HttpStatus.NOT_FOUND, "SYS_404");
    }

    @DisplayName("L3-QLT-13 | Auth-Wrong-Role: GET /forms with a USER token → 403 AUTH_002")
    @Test
    void plainUsersCannotBrowseTheBuilder() {
        assertError(get(API + "/forms", managerToken), HttpStatus.FORBIDDEN, "AUTH_002");
    }

    @DisplayName("L3-QLT-14 | Input-Domain-Happy: POST /form-assignments → 201 with one item, and the assignee sees it in GET /assigned-forms")
    @Test
    void assigningAFormExposesItToTheAssignee() {
        long versionId = publishedVersion();

        ResponseEntity<String> response = post(API + "/form-assignments", adminToken, """
                {"managerId":%d,"formVersionIds":[%d]}
                """.formatted(manager.getId(), versionId));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode items = data(response).get("items");
        assertThat(items).hasSize(1);
        long assignmentItemId = items.get(0).get("assignmentItemId").asLong();

        JsonNode assigned = data(get(API + "/assigned-forms", managerToken)).get("content");
        assertThat(assigned.toString()).contains(String.valueOf(assignmentItemId));
    }

    @DisplayName("L3-QLT-15 | Not-Found: reading someone else's assigned form detail → 404 SYS_404 (ownership is hidden, not 403)")
    @Test
    void anotherUsersAssignedFormReads404() {
        long assignmentItemId = assignmentItemFor(manager);

        ResponseEntity<String> response = get(API + "/assigned-forms/" + assignmentItemId, outsiderToken);

        assertError(response, HttpStatus.NOT_FOUND, "SYS_404");
    }

    @DisplayName("L3-QLT-16 | Input-Domain-Happy: POST /form-submissions → 201 DRAFT with scoringStatus NOT_CONFIGURED")
    @Test
    void creatingASubmissionStartsAsADraft() {
        long assignmentItemId = assignmentItemFor(manager);

        ResponseEntity<String> response = post(API + "/form-submissions", managerToken, """
                {"assignmentItemId":%d,"subject":{"type":"USER","employeeCode":"%s"}}
                """.formatted(assignmentItemId, manager.getEmployeeCode()));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode body = data(response);
        assertThat(body.get("status").asText()).isEqualTo("DRAFT");
        assertThat(body.get("scoringStatus").asText()).isEqualTo("NOT_CONFIGURED");
        assertThat(body.get("assignmentItemId").asLong()).isEqualTo(assignmentItemId);
    }

    @DisplayName("L3-QLT-17 | Input-Domain-Happy: answering then submitting → SUBMITTED, scoringStatus CALCULATED with a computed score")
    @Test
    void answeringAndSubmittingScoresTheForm() {
        Submission submission = draftSubmission();

        ResponseEntity<String> answered = put(API + "/form-submissions/" + submission.id, managerToken, """
                {"lockVersion":%d,"answers":[{"questionKey":"%s","optionKey":"%s"}]}
                """.formatted(submission.lockVersion, submission.questionKey, submission.highOptionKey));
        assertOk(answered);
        long lockVersion = data(answered).get("lockVersion").asLong();

        ResponseEntity<String> submitted = post(API + "/form-submissions/" + submission.id + "/submission",
                managerToken, """
                {"lockVersion":%d}
                """.formatted(lockVersion));

        assertOk(submitted);
        JsonNode body = data(submitted);
        assertThat(body.get("status").asText()).isEqualTo("SUBMITTED");
        assertThat(body.get("scoringStatus").asText()).isEqualTo("CALCULATED");
        assertThat(body.get("submittedAt").isNull()).isFalse();
        assertThat(body.get("criticalFailure").asBoolean()).isFalse();
        assertThat(body.get("result").asText()).isNotBlank();
    }

    @DisplayName("L3-QLT-18 | State-Conflict: submitting an already submitted form → 409 SYS_409 'Only a draft submission can be modified'")
    @Test
    void resubmittingASubmittedFormIsRejected() {
        Submission submission = draftSubmission();
        ResponseEntity<String> answered = put(API + "/form-submissions/" + submission.id, managerToken, """
                {"lockVersion":%d,"answers":[{"questionKey":"%s","optionKey":"%s"}]}
                """.formatted(submission.lockVersion, submission.questionKey, submission.highOptionKey));
        long lockVersion = data(answered).get("lockVersion").asLong();
        assertOk(post(API + "/form-submissions/" + submission.id + "/submission", managerToken,
                "{\"lockVersion\":%d}".formatted(lockVersion)));

        ResponseEntity<String> response = post(API + "/form-submissions/" + submission.id + "/submission",
                managerToken, "{\"lockVersion\":%d}".formatted(lockVersion + 1));

        assertError(response, HttpStatus.CONFLICT, "SYS_409");
        assertThat(json(response).get("message").asText())
                .isEqualTo("Only a draft submission can be modified");
    }

    @DisplayName("L3-QLT-19 | Auth-Wrong-Role: PATCH scoring-configuration with a USER token → 403 AUTH_002")
    @Test
    void plainUsersCannotChangeScoring() {
        long formId = createForm();
        long versionId = createVersion(formId);

        ResponseEntity<String> response = patch(
                API + "/forms/" + formId + "/versions/" + versionId + "/scoring-configuration",
                managerToken, """
                {"criticalWeightPercent":50,"lockVersion":0}
                """);

        assertError(response, HttpStatus.FORBIDDEN, "AUTH_002");
    }

    // ------------------------------------------------------------------ helpers

    private record Submission(long id, long lockVersion, String questionKey, String highOptionKey) {
    }

    private String questionKey;
    private String lowOptionKey;
    private String highOptionKey;

    private String formBody(String code) {
        return """
                {"code":"%s","title":"Bảng kiểm %s","subjectType":"USER"}
                """.formatted(code, code);
    }

    private long createForm() {
        ResponseEntity<String> response = post(API + "/forms", adminToken, formBody("L3F%04d".formatted(nextSeq())));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return id(response);
    }

    private long createVersion(long formId) {
        ResponseEntity<String> response = post(API + "/forms/" + formId + "/versions", adminToken, versionBody());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return id(response);
    }

    /** A published version of a fresh form, remembering its question/option keys for answering. */
    private long publishedVersion() {
        long formId = createForm();
        long versionId = createVersion(formId);
        assertOk(post(API + "/forms/" + formId + "/versions/" + versionId + "/publication", adminToken, null));
        return versionId;
    }

    private long assignmentItemFor(User assignee) {
        long versionId = publishedVersion();
        ResponseEntity<String> response = post(API + "/form-assignments", adminToken, """
                {"managerId":%d,"formVersionIds":[%d]}
                """.formatted(assignee.getId(), versionId));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return data(response).get("items").get(0).get("assignmentItemId").asLong();
    }

    private Submission draftSubmission() {
        long assignmentItemId = assignmentItemFor(manager);
        ResponseEntity<String> response = post(API + "/form-submissions", managerToken, """
                {"assignmentItemId":%d,"subject":{"type":"USER","employeeCode":"%s"}}
                """.formatted(assignmentItemId, manager.getEmployeeCode()));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode body = data(response);
        return new Submission(body.get("id").asLong(), body.get("lockVersion").asLong(),
                questionKey, highOptionKey);
    }

    /** Smallest publishable version: one section, one scored single-choice question, two options. */
    private String versionBody() {
        questionKey = UUID.randomUUID().toString();
        lowOptionKey = UUID.randomUUID().toString();
        highOptionKey = UUID.randomUUID().toString();
        return """
                {"title":"Phiên bản L3","settings":{"scoringEnabled":true},
                 "sections":[{"sectionKey":"%s","title":"Đánh giá rủi ro","displayOrder":0,
                   "items":[{"itemKey":"%s","itemType":"QUESTION","displayOrder":0,
                     "question":{"questionKey":"%s","code":"risk_level_%d","title":"Mức độ rủi ro",
                       "fieldType":"SINGLE_CHOICE","required":true,"weight":1,
                       "options":[{"optionKey":"%s","value":"LOW","label":"Thấp","scoreValue":0,"displayOrder":0},
                                  {"optionKey":"%s","value":"HIGH","label":"Cao","scoreValue":1,"displayOrder":1}]}}]}]}
                """.formatted(UUID.randomUUID(), UUID.randomUUID(), questionKey, nextSeq(),
                lowOptionKey, highOptionKey);
    }

    private String versionBodyWithLock(long lockVersion) {
        String body = versionBody();
        return body.substring(0, body.lastIndexOf('}')) + ",\"lockVersion\":%d}".formatted(lockVersion);
    }
}
