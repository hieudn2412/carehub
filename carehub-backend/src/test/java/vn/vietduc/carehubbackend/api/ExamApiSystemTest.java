package vn.vietduc.carehubbackend.api;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import vn.vietduc.carehubbackend.questiongeneration.security.EvaluationPermissions;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.user.entity.User;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * L3 system/API tests — sheet {@code L3-ExamAPI}, ids L3-EXM-01…16.
 *
 * <p>Drives the whole evaluation pipeline over HTTP — question bank → question set → exam config →
 * exam paper → assignment → attempt → grading — and checks the evaluation permission matrix, which
 * is a different mechanism from the ADMIN/MANAGER/USER roles (JWT {@code permissions} claim resolved
 * by {@code @evaluationSecurity}).
 *
 * <p>Contract facts pinned: the list endpoints in this module return a bare JSON array rather than
 * the {@code PageResponse} envelope; a passing score above 10 is rejected because the scale is 0–10
 * (same family as D24); and touching another employee's attempt answers <b>400</b>, not 403 (D40).
 */
class ExamApiSystemTest extends AbstractApiSystemTest {

    @Autowired
    private ProfessionalFieldRepository professionalFieldRepository;
    @Autowired
    private QuestionCategoryRepository questionCategoryRepository;
    @Autowired
    private QuestionBankQuestionRepository questionRepository;

    private User admin;
    private User employee;
    private String adminToken;
    private String employeeToken;
    private ProfessionalField professionalField;
    private QuestionCategory questionCategory;

    @BeforeEach
    void createFixtures() {
        admin = newUser("L3XADM", "ADMIN");
        employee = newUser("L3XEMP", "USER");
        adminToken = tokenFor(admin);
        employeeToken = tokenFor(employee);
        professionalField = professionalFieldRepository.save(ProfessionalField.builder()
                .code("L3PF%04d".formatted(nextSeq()))
                .name("Lĩnh vực L3")
                .active(true)
                .build());
        questionCategory = questionCategoryRepository.save(QuestionCategory.builder()
                .code("L3CAT%04d".formatted(nextSeq()))
                .name("An toàn L3")
                .status(QuestionCategoryStatus.ACTIVE)
                .createdBy("system-test")
                .build());
    }

    @DisplayName("L3-EXM-01 | Auth-Wrong-Role: GET /questions with a plain USER token (no evaluation permission) → 403 AUTH_002")
    @Test
    void questionBankIsClosedWithoutEvaluationPermissions() {
        assertError(get(API + "/questions", employeeToken), HttpStatus.FORBIDDEN, "AUTH_002");
    }

    @DisplayName("L3-EXM-01b | Auth: result report/export surfaces are closed without RESULT_VIEWER")
    @Test
    void resultReportRequiresResultViewerPermission() {
        assertError(get(API + "/evaluation-results?assignmentId=999999", employeeToken), HttpStatus.FORBIDDEN, "AUTH_002");

        String viewerToken = tokenFor(newUserWithPermissions("L3XRES", EvaluationPermissions.RESULT_VIEWER));
        ResponseEntity<String> response = get(API + "/evaluation-results?assignmentId=999999", viewerToken);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @DisplayName("L3-EXM-02 | Contract: GET /questions with QUESTION_AUTHOR → 200 and data is a bare JSON array, not a PageResponse")
    @Test
    void questionListIsNotPaginated() {
        String authorToken = tokenFor(newUserWithPermissions("L3XAUT", EvaluationPermissions.QUESTION_AUTHOR));

        ResponseEntity<String> response = get(API + "/questions", authorToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(data(response).isArray()).as("evaluation list endpoints skip PageResponse").isTrue();
    }

    @DisplayName("L3-EXM-03 | Contract: POST /questions with QUESTION_AUTHOR and no status → the question is APPROVED straight away, bypassing review (D41)")
    @Test
    void authorCreatedQuestionIsApprovedWithoutReview() {
        String authorToken = tokenFor(newUserWithPermissions("L3XAU2", EvaluationPermissions.QUESTION_AUTHOR));

        ResponseEntity<String> response = post(API + "/questions", authorToken, questionBody("author path"));

        assertOk(response);
        JsonNode body = data(response);
        // D41: the status defaults to APPROVED (QuestionBankService:85) and reviewedBy is set to the
        // author, so a QUESTION_AUTHOR alone can publish into the bank — the QUESTION_REVIEWER gate
        // on /approve only matters for questions explicitly created as DRAFT.
        assertThat(body.get("status").asText()).isEqualTo("APPROVED");
        assertThat(body.get("correctAnswer").asText()).isEqualTo("A");
        assertThat(body.get("questionType").asText()).isEqualTo("ORIGINAL");
    }

    @DisplayName("L3-EXM-04 | Validation: POST /questions without a stem → 422 VAL_001 on field 'stem'")
    @Test
    void questionStemIsMandatory() {
        ResponseEntity<String> response = post(API + "/questions", adminToken, """
                {"optionA":"A","optionB":"B","optionC":"C","optionD":"D","correctAnswer":"A"}
                """);

        assertError(response, HttpStatus.UNPROCESSABLE_ENTITY, "VAL_001");
        assertThat(json(response).get("details").toString()).contains("stem");
    }

    @DisplayName("L3-EXM-05 | Auth-Wrong-Role: approving with only QUESTION_AUTHOR → 403 AUTH_002 (review is a separate permission)")
    @Test
    void authorCannotApproveOwnQuestion() {
        String authorToken = tokenFor(newUserWithPermissions("L3XAU3", EvaluationPermissions.QUESTION_AUTHOR));
        long questionId = id(post(API + "/questions", authorToken, draftQuestionBody("needs review")));

        ResponseEntity<String> response = post(API + "/questions/" + questionId + "/approve", authorToken, "{}");

        assertError(response, HttpStatus.FORBIDDEN, "AUTH_002");
    }

    @DisplayName("L3-EXM-06 | Input-Domain-Happy: a DRAFT question approved with QUESTION_REVIEWER → status APPROVED")
    @Test
    void reviewerApprovesADraftQuestion() {
        String reviewerToken = tokenFor(newUserWithPermissions("L3XREV",
                EvaluationPermissions.QUESTION_AUTHOR, EvaluationPermissions.QUESTION_REVIEWER));
        ResponseEntity<String> created = post(API + "/questions", reviewerToken, draftQuestionBody("to approve"));
        assertThat(data(created).get("status").asText()).isEqualTo("DRAFT");

        ResponseEntity<String> response =
                post(API + "/questions/" + id(created) + "/approve", reviewerToken, "{}");

        assertOk(response);
        assertThat(data(response).get("status").asText()).isEqualTo("APPROVED");
    }

    @DisplayName("L3-EXM-06b | Cognitive-review legacy endpoint is no longer exposed after direct-field cutover")
    @Test
    void cognitiveReviewEndpointIsNotExposedAfterCutover() {
        String authorToken = tokenFor(newUserWithPermissions("L3XCRAUT",
                EvaluationPermissions.QUESTION_AUTHOR));
        long questionId = id(post(API + "/questions", authorToken, questionBody("cognitive api")));
        String reviewBody = """
                {"reviews":[{"questionId":%d,"cognitiveLevel":"CLINICAL_APPLICATION",
                 "reviewerNotes":"Đã đối chiếu ma trận nhận thức"}]}
                """.formatted(questionId);

        assertError(post(API + "/questions/cognitive-review", authorToken, reviewBody),
                HttpStatus.METHOD_NOT_ALLOWED, "REQ_001");
    }

    @DisplayName("L3-EXM-06c | Audience: real HTTP preview exposes validity and activation accepts only a non-empty audience")
    @Test
    void audiencePreviewAndActivationAreAvailableThroughTheApi() {
        String audienceToken = tokenFor(newUserWithPermissions("L3XAUD",
                EvaluationPermissions.ASSIGNMENT_MANAGER));
        String allEmployeesRule = "{\"version\":1,\"all\":[{\"type\":\"ALL_EMPLOYEES\"}]}";
        String quotedRule = "\"" + allEmployeesRule.replace("\"", "\\\"") + "\"";

        ResponseEntity<String> preview = post(API + "/evaluation-audiences/preview", audienceToken,
                "{\"ruleJson\":" + quotedRule + "}");
        assertOk(preview);
        assertThat(data(preview).get("valid").asBoolean()).isTrue();
        assertThat(data(preview).get("count").asInt()).isGreaterThan(0);

        ResponseEntity<String> created = post(API + "/evaluation-audiences", audienceToken,
                "{\"name\":\"Toàn viện L3\",\"ruleJson\":" + quotedRule + "}");
        assertOk(created);
        long audienceId = id(created);

        ResponseEntity<String> activated = post(API + "/evaluation-audiences/" + audienceId + "/activate",
                audienceToken, "{}");
        assertOk(activated);
        assertThat(data(activated).get("status").asText()).isEqualTo("ACTIVE");
        assertThat(data(activated).get("preview").get("valid").asBoolean()).isTrue();
    }

    @DisplayName("L3-EXM-07 | Input-Domain-Happy: POST /question-sets then /activate → ACTIVE with the approved question counted")
    @Test
    void questionSetGoesActiveWithApprovedQuestions() {
        long questionId = approvedQuestion("set member");

        long setId = id(post(API + "/question-sets", adminToken, """
                {"name":"Bộ câu hỏi L3 %d","questionIds":[%d]}
                """.formatted(nextSeq(), questionId)));
        ResponseEntity<String> response = post(API + "/question-sets/" + setId + "/activate", adminToken, "{}");

        assertOk(response);
        JsonNode body = data(response);
        assertThat(body.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(body.get("questionCount").asInt()).isEqualTo(1);
    }

    @DisplayName("L3-EXM-08 | State-Conflict: activating an empty question set → 4xx 'Không thể kích hoạt bộ câu hỏi rỗng'")
    @Test
    void emptyQuestionSetCannotBeActivated() {
        long setId = id(post(API + "/question-sets", adminToken, """
                {"name":"Bộ rỗng %d"}
                """.formatted(nextSeq())));

        ResponseEntity<String> response = post(API + "/question-sets/" + setId + "/activate", adminToken, "{}");

        assertThat(response.getStatusCode().is4xxClientError())
                .as("body was: %s", response.getBody()).isTrue();
        assertThat(json(response).get("message").asText())
                .isEqualTo("Không thể kích hoạt bộ câu hỏi rỗng");
    }

    @DisplayName("L3-EXM-09 | Input-Domain-Happy: POST /exam-configs then /activate → ACTIVE with direct field×cognitive blueprint")
    @Test
    void examConfigGoesActive() {
        approvedQuestion("chain");

        long configId = id(post(API + "/exam-configs", adminToken, configBody("7")));
        ResponseEntity<String> response = post(API + "/exam-configs/" + configId + "/activate", adminToken, "{}");

        assertOk(response);
        JsonNode body = data(response);
        assertThat(body.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(body.hasNonNull("questionSetId")).isFalse();
        assertThat(body.get("blueprintFields")).hasSize(1);
    }

    @DisplayName("L3-EXM-10 | Input-Domain-Invalid: passingScore=85 → 4xx 'Điểm đạt phải trong khoảng 0-10' (the API scale is 0–10, not 0–100)")
    @Test
    void passingScoreAboveTenIsRejected() {
        approvedQuestion("invalid-passing-score");

        ResponseEntity<String> response = post(API + "/exam-configs", adminToken, configBody("85"));

        assertThat(response.getStatusCode().is4xxClientError())
                .as("body was: %s", response.getBody()).isTrue();
        assertThat(json(response).get("message").asText())
                .isEqualTo("Điểm đạt phải trong khoảng 0-10");
    }

    @DisplayName("L3-EXM-11 | Input-Domain-Happy: POST /exam-papers/generate returns a list of variants; publishing one → PUBLISHED")
    @Test
    void paperIsGeneratedThenPublished() {
        long configId = activeExamConfig();

        ResponseEntity<String> generated = post(API + "/exam-papers/generate", adminToken, """
                {"examConfigId":%d,"namePrefix":"Đề L3","variantCount":1,"randomSeed":7,"idempotencyKey":"l3-paper-generate"}
                """.formatted(configId));
        assertOk(generated);
        assertThat(data(generated).isArray()).isTrue();
        long paperId = data(generated).get(0).get("id").asLong();

        ResponseEntity<String> published = post(API + "/exam-papers/" + paperId + "/publish", adminToken, "{}");

        assertOk(published);
        assertThat(data(published).get("status").asText()).isEqualTo("PUBLISHED");
        assertThat(data(published).get("totalQuestions").asInt()).isEqualTo(1);
    }

    @DisplayName("L3-EXM-12 | Input-Domain-Happy: POST /exam-assignments then /open → OPEN with the targeted employee resolved")
    @Test
    void assignmentTargetsTheEmployeeAndOpens() {
        long paperId = publishedPaper();

        long assignmentId = id(post(API + "/exam-assignments", adminToken, assignmentBody(paperId, 2)));
        ResponseEntity<String> response = post(API + "/exam-assignments/" + assignmentId + "/open", adminToken, "{}");

        assertOk(response);
        JsonNode body = data(response);
        assertThat(body.get("status").asText()).isEqualTo("OPEN");
        assertThat(body.get("targetCount").asInt()).isEqualTo(1);
        assertThat(body.get("openedAt").isNull()).isFalse();
    }

    @DisplayName("L3-EXM-13 | Input-Domain-Happy: GET /me/exam-assignments lists the open assignment and POST /start creates an IN_PROGRESS attempt")
    @Test
    void employeeStartsAnAttempt() {
        long assignmentId = openAssignment(2);

        JsonNode mine = data(get(API + "/me/exam-assignments", employeeToken));
        assertThat(mine.toString()).contains(String.valueOf(assignmentId));

        ResponseEntity<String> started =
                post(API + "/me/exam-assignments/" + assignmentId + "/start", employeeToken, "{}");

        assertOk(started);
        JsonNode attempt = data(started);
        assertThat(attempt.get("status").asText()).isEqualTo("IN_PROGRESS");
        assertThat(attempt.get("attemptNumber").asInt()).isEqualTo(1);
        assertOffsetTimestamp(attempt.get("expiresAt"));
        assertOffsetTimestamp(attempt.get("serverNow"));
        assertThat(attempt.get("remainingSeconds").asLong()).isBetween(0L, 1_800L);
        assertThat(attempt.get("questions")).hasSize(1);

        JsonNode mineAfterStart = data(get(API + "/me/exam-assignments", employeeToken));
        JsonNode currentAssignment = null;
        for (JsonNode item : mineAfterStart) {
            if (item.get("id").asLong() == assignmentId) {
                currentAssignment = item;
                break;
            }
        }
        assertThat(currentAssignment).isNotNull();
        assertOffsetTimestamp(currentAssignment.get("currentAttemptExpiresAt"));
        assertThat(currentAssignment.get("currentAttemptRemainingSeconds").asLong()).isBetween(0L, 1_800L);
    }

    private void assertOffsetTimestamp(JsonNode value) {
        assertThat(value).isNotNull().isNotEqualTo(com.fasterxml.jackson.databind.node.NullNode.getInstance());
        assertThat(value.asText()).matches(".*(?:Z|[+-]\\d{2}:\\d{2})$");
    }

    @DisplayName("L3-EXM-14 | Input-Domain-Happy: saving answers then submitting → GRADED with a score on the 0–10 scale")
    @Test
    void submittingAnAttemptGradesIt() {
        long assignmentId = openAssignment(2);
        JsonNode attempt = data(post(API + "/me/exam-assignments/" + assignmentId + "/start", employeeToken, "{}"));
        long attemptId = attempt.get("id").asLong();
        long paperQuestionId = attempt.get("questions").get(0).get("paperQuestionId").asLong();
        String answersBody = """
                {"answers":[{"paperQuestionId":%d,"selectedAnswer":"A"}]}
                """.formatted(paperQuestionId);

        assertOk(put(API + "/me/exam-attempts/" + attemptId + "/answers", employeeToken, answersBody));
        ResponseEntity<String> submitted =
                post(API + "/me/exam-attempts/" + attemptId + "/submit", employeeToken, answersBody);

        assertOk(submitted);
        JsonNode graded = data(submitted);
        assertThat(graded.get("status").asText()).isEqualTo("GRADED");
        assertThat(graded.get("correctCount").asInt()).isEqualTo(1);
        assertThat(graded.get("score").asDouble()).isBetween(0.0, 10.0);
        assertThat(graded.get("submittedAt").isNull()).isFalse();
    }

    @DisplayName("L3-EXM-15 | State-Conflict: starting again after maxAttempts=1 is used → 400 REQ_001 'Bạn đã dùng hết số lượt làm bài'")
    @Test
    void exhaustedAttemptsAreRejected() {
        long assignmentId = openAssignment(1);
        JsonNode attempt = data(post(API + "/me/exam-assignments/" + assignmentId + "/start", employeeToken, "{}"));
        long attemptId = attempt.get("id").asLong();
        long paperQuestionId = attempt.get("questions").get(0).get("paperQuestionId").asLong();
        assertOk(post(API + "/me/exam-attempts/" + attemptId + "/submit", employeeToken, """
                {"answers":[{"paperQuestionId":%d,"selectedAnswer":"A"}]}
                """.formatted(paperQuestionId)));

        ResponseEntity<String> response =
                post(API + "/me/exam-assignments/" + assignmentId + "/start", employeeToken, "{}");

        assertError(response, HttpStatus.BAD_REQUEST, "REQ_001");
        assertThat(json(response).get("message").asText()).isEqualTo("Bạn đã dùng hết số lượt làm bài");
    }

    @DisplayName("L3-EXM-16 | Auth-Wrong-Role: reading someone else's attempt → 400 REQ_001, not 403 (ownership violation reported as a bad request, D40)")
    @Test
    void anotherEmployeesAttemptIsRejectedWith400() {
        long assignmentId = openAssignment(2);
        long attemptId = data(post(API + "/me/exam-assignments/" + assignmentId + "/start", employeeToken, "{}"))
                .get("id").asLong();
        String intruderToken = tokenFor(newUser("L3XINT", "USER"));

        ResponseEntity<String> response = get(API + "/me/exam-attempts/" + attemptId, intruderToken);

        // D40: an authorisation failure surfaces as BadRequestException, so clients see 400 REQ_001
        // where the documented contract (and every other module) uses 403 AUTH_002.
        assertError(response, HttpStatus.BAD_REQUEST, "REQ_001");
        assertThat(json(response).get("message").asText())
                .isEqualTo("Bạn không có quyền truy cập lượt làm bài này");
    }

    @DisplayName("L3-EXM-17 | Blueprint generation keeps the configured cognitive mix on a fixed paper")
    @Test
    void balancedAttemptsKeepDifficultyMixAndPreferUnseenQuestions() {
        List<Long> questionIds = new ArrayList<>();
        for (int index = 0; index < 3; index++) questionIds.add(approvedQuestion("foundation-" + index, "FOUNDATION"));
        for (int index = 0; index < 5; index++) questionIds.add(approvedQuestion("application-" + index, "CLINICAL_APPLICATION"));
        for (int index = 0; index < 2; index++) questionIds.add(approvedQuestion("reasoning-" + index, "CLINICAL_REASONING_ANALYSIS"));

        long configId = id(post(API + "/exam-configs", adminToken, """
                {"name":"Cấu hình cân bằng %d","totalQuestions":5,"timeLimitMinutes":30,
                 "passingScore":5,"maxRetakes":1,"shuffleQuestions":false,"shuffleOptions":false,
                 "questionSelectionMode":"FIXED_PAPER","status":"ACTIVE",
                 "fieldBlueprints":[{
                   "professionalFieldId":%d,"questionCount":5,"displayOrder":0,
                   "cognitive":[
                     {"cognitiveLevel":"FOUNDATION","questionCount":1},
                     {"cognitiveLevel":"CLINICAL_APPLICATION","questionCount":3},
                     {"cognitiveLevel":"CLINICAL_REASONING_ANALYSIS","questionCount":1}
                   ]
                 }]}
                """.formatted(nextSeq(), professionalField.getId())));
        ResponseEntity<String> generated = post(API + "/exam-papers/generate", adminToken, """
                {"examConfigId":%d,"namePrefix":"Đề cân bằng","variantCount":1,"randomSeed":99,"idempotencyKey":"l3-paper-balanced"}
                """.formatted(configId));
        assertOk(generated);
        JsonNode paper = data(generated).get(0);
        assertThat(paper.get("totalQuestions").asInt()).isEqualTo(5);
        assertThat(paper.get("poolQuestionCount").asInt()).isEqualTo(5);
        Map<Long, String> cognitiveByPaperQuestion = new HashMap<>();
        paper.get("questions").forEach(question ->
                cognitiveByPaperQuestion.put(question.get("id").asLong(), question.get("cognitiveLevel").asText()));
        long paperId = paper.get("id").asLong();
        assertOk(post(API + "/exam-papers/" + paperId + "/publish", adminToken, "{}"));
        long assignmentId = id(post(API + "/exam-assignments", adminToken, assignmentBody(paperId, 2)));
        assertOk(post(API + "/exam-assignments/" + assignmentId + "/open", adminToken, "{}"));

        JsonNode first = data(post(API + "/me/exam-assignments/" + assignmentId + "/start", employeeToken, "{}"));
        long firstAttemptId = first.get("id").asLong();
        Set<Long> firstIds = questionIds(first);
        assertCognitiveCounts(firstIds, cognitiveByPaperQuestion, 1, 3, 1);
        JsonNode reloaded = data(get(API + "/me/exam-attempts/" + firstAttemptId, employeeToken));
        assertThat(questionIds(reloaded)).containsExactlyInAnyOrderElementsOf(firstIds);
        assertOk(post(API + "/me/exam-attempts/" + firstAttemptId + "/submit", employeeToken, "{\"answers\":[]}"));

        JsonNode second = data(post(API + "/me/exam-assignments/" + assignmentId + "/start", employeeToken, "{}"));
        Set<Long> secondIds = questionIds(second);
        assertCognitiveCounts(secondIds, cognitiveByPaperQuestion, 1, 3, 1);
        assertThat(secondIds).containsExactlyInAnyOrderElementsOf(firstIds);
    }

    // ------------------------------------------------------------------ chain helpers

    private String questionBody(String label) {
        return """
                {"stem":"Câu hỏi L3 %s %d?","optionA":"Đúng","optionB":"Sai","optionC":"Có thể","optionD":"Không rõ",
                 "correctAnswer":"A","explanation":"L3 system test","categoryId":%d,
                 "professionalFieldId":%d,"cognitiveLevel":"FOUNDATION","language":"vi","status":"APPROVED"}
                """.formatted(label, nextSeq(), questionCategory.getId(), professionalField.getId());
    }

    private String questionBody(String label, String cognitiveLevel) {
        return """
                {"stem":"Câu hỏi L3 %s %d?","optionA":"Đúng","optionB":"Sai","optionC":"Có thể","optionD":"Không rõ",
                 "correctAnswer":"A","explanation":"L3 system test","categoryId":%d,
                 "professionalFieldId":%d,"cognitiveLevel":"%s","language":"vi","status":"APPROVED"}
                """.formatted(label, nextSeq(), questionCategory.getId(), professionalField.getId(), cognitiveLevel);
    }

    /** Explicit DRAFT — without a status the service approves on create (D41). */
    private String draftQuestionBody(String label) {
        String body = questionBody(label);
        return body.substring(0, body.lastIndexOf('}')) + ",\"status\":\"DRAFT\"}";
    }

    private long approvedQuestion(String label) {
        long questionId = id(post(API + "/questions", adminToken, questionBody(label)));
        assertOk(post(API + "/questions/" + questionId + "/approve", adminToken, "{}"));
        ensureBlueprintQuestion(questionId, CognitiveLevel.FOUNDATION);
        return questionId;
    }

    private long approvedQuestion(String label, String cognitiveLevel) {
        long questionId = id(post(API + "/questions", adminToken, questionBody(label, cognitiveLevel)));
        assertOk(post(API + "/questions/" + questionId + "/approve", adminToken, "{}"));
        ensureBlueprintQuestion(questionId, CognitiveLevel.valueOf(cognitiveLevel));
        return questionId;
    }

    private void ensureBlueprintQuestion(long questionId, CognitiveLevel cognitiveLevel) {
        var question = questionRepository.findById(questionId).orElseThrow();
        question.setCategory(questionCategory);
        question.setProfessionalField(professionalField);
        question.setCognitiveLevel(cognitiveLevel);
        question.setCognitiveVerifiedAt(java.time.LocalDateTime.now());
        question.setCognitiveVerifiedBy("system-test");
        question.setStatus(QuestionBankStatus.APPROVED);
        questionRepository.save(question);
    }

    private Set<Long> questionIds(JsonNode attempt) {
        Set<Long> ids = new HashSet<>();
        attempt.get("questions").forEach(question -> ids.add(question.get("paperQuestionId").asLong()));
        return ids;
    }

    private void assertCognitiveCounts(
            Set<Long> paperQuestionIds,
            Map<Long, String> cognitiveByPaperQuestion,
            long foundation,
            long application,
            long reasoning
    ) {
        Map<String, Long> counts = paperQuestionIds.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        cognitiveByPaperQuestion::get,
                        java.util.stream.Collectors.counting()
                ));
        assertThat(counts.getOrDefault("FOUNDATION", 0L)).isEqualTo(foundation);
        assertThat(counts.getOrDefault("CLINICAL_APPLICATION", 0L)).isEqualTo(application);
        assertThat(counts.getOrDefault("CLINICAL_REASONING_ANALYSIS", 0L)).isEqualTo(reasoning);
    }

    private long activeQuestionSet() {
        long questionId = approvedQuestion("chain");
        long setId = id(post(API + "/question-sets", adminToken, """
                {"name":"Bộ câu hỏi chuỗi %d","questionIds":[%d]}
                """.formatted(nextSeq(), questionId)));
        assertOk(post(API + "/question-sets/" + setId + "/activate", adminToken, "{}"));
        return setId;
    }

    private String configBody(String passingScore) {
        return """
                {"name":"Cấu hình L3 %d","totalQuestions":1,"timeLimitMinutes":30,
                 "passingScore":%s,"maxRetakes":3,"shuffleQuestions":false,"shuffleOptions":false,
                 "fieldBlueprints":[{
                   "professionalFieldId":%d,"questionCount":1,"displayOrder":0,
                   "cognitive":[
                     {"cognitiveLevel":"FOUNDATION","questionCount":1},
                     {"cognitiveLevel":"CLINICAL_APPLICATION","questionCount":0},
                     {"cognitiveLevel":"CLINICAL_REASONING_ANALYSIS","questionCount":0}
                   ]
                 }]}
                """.formatted(nextSeq(), passingScore, professionalField.getId());
    }

    private long activeExamConfig() {
        approvedQuestion("chain");
        long configId = id(post(API + "/exam-configs", adminToken, configBody("5")));
        assertOk(post(API + "/exam-configs/" + configId + "/activate", adminToken, "{}"));
        return configId;
    }

    private long publishedPaper() {
        ResponseEntity<String> generated = post(API + "/exam-papers/generate", adminToken, """
                {"examConfigId":%d,"namePrefix":"Đề chuỗi","variantCount":1,"randomSeed":11,"idempotencyKey":"l3-paper-chain-%d"}
                """.formatted(activeExamConfig(), nextSeq()));
        assertOk(generated);
        long paperId = data(generated).get(0).get("id").asLong();
        assertOk(post(API + "/exam-papers/" + paperId + "/publish", adminToken, "{}"));
        return paperId;
    }

    private String assignmentBody(long paperId, int maxAttempts) {
        return """
                {"name":"Phân công L3 %d","examPaperId":%d,"userIds":[%d],"idempotencyKey":"l3-assignment-%d",
                 "maxAttempts":%d,"shuffleQuestions":false,"shuffleOptions":false,
                 "resultVisibility":"SCORE_ONLY","status":"DRAFT"}
                """.formatted(nextSeq(), paperId, employee.getId(), nextSeq(), maxAttempts);
    }

    private long openAssignment(int maxAttempts) {
        long assignmentId = id(post(API + "/exam-assignments", adminToken,
                assignmentBody(publishedPaper(), maxAttempts)));
        assertOk(post(API + "/exam-assignments/" + assignmentId + "/open", adminToken, "{}"));
        return assignmentId;
    }
}
