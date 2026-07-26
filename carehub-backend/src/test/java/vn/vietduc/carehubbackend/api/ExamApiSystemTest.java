package vn.vietduc.carehubbackend.api;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import vn.vietduc.carehubbackend.questiongeneration.security.EvaluationPermissions;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.user.entity.User;

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

    private User admin;
    private User employee;
    private String adminToken;
    private String employeeToken;
    private ProfessionalField professionalField;

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
    }

    @DisplayName("L3-EXM-01 | Auth-Wrong-Role: GET /questions with a plain USER token (no evaluation permission) → 403 AUTH_002")
    @Test
    void questionBankIsClosedWithoutEvaluationPermissions() {
        assertError(get(API + "/questions", employeeToken), HttpStatus.FORBIDDEN, "AUTH_002");
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

    @DisplayName("L3-EXM-09 | Input-Domain-Happy: POST /exam-configs then /activate → ACTIVE and bound to the question set")
    @Test
    void examConfigGoesActive() {
        long setId = activeQuestionSet();

        long configId = id(post(API + "/exam-configs", adminToken, configBody(setId, "7")));
        ResponseEntity<String> response = post(API + "/exam-configs/" + configId + "/activate", adminToken, "{}");

        assertOk(response);
        JsonNode body = data(response);
        assertThat(body.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(body.get("questionSetId").asLong()).isEqualTo(setId);
    }

    @DisplayName("L3-EXM-10 | Input-Domain-Invalid: passingScore=85 → 4xx 'Điểm đạt phải trong khoảng 0-10' (the API scale is 0–10, not 0–100)")
    @Test
    void passingScoreAboveTenIsRejected() {
        long setId = activeQuestionSet();

        ResponseEntity<String> response = post(API + "/exam-configs", adminToken, configBody(setId, "85"));

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
                {"examConfigId":%d,"namePrefix":"Đề L3","variantCount":1,"randomSeed":7}
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
        assertThat(attempt.get("expiresAt").isNull()).isFalse();
        assertThat(attempt.get("questions")).hasSize(1);
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

    // ------------------------------------------------------------------ chain helpers

    private String questionBody(String label) {
        return """
                {"stem":"Câu hỏi L3 %s %d?","optionA":"Đúng","optionB":"Sai","optionC":"Có thể","optionD":"Không rõ",
                 "correctAnswer":"A","explanation":"L3 system test","topic":"An toàn","difficulty":"EASY","language":"vi"}
                """.formatted(label, nextSeq());
    }

    /** Explicit DRAFT — without a status the service approves on create (D41). */
    private String draftQuestionBody(String label) {
        String body = questionBody(label);
        return body.substring(0, body.lastIndexOf('}')) + ",\"status\":\"DRAFT\"}";
    }

    private long approvedQuestion(String label) {
        long questionId = id(post(API + "/questions", adminToken, questionBody(label)));
        assertOk(post(API + "/questions/" + questionId + "/approve", adminToken, "{}"));
        return questionId;
    }

    private long activeQuestionSet() {
        long questionId = approvedQuestion("chain");
        long setId = id(post(API + "/question-sets", adminToken, """
                {"name":"Bộ câu hỏi chuỗi %d","questionIds":[%d]}
                """.formatted(nextSeq(), questionId)));
        assertOk(post(API + "/question-sets/" + setId + "/activate", adminToken, "{}"));
        return setId;
    }

    private String configBody(long questionSetId, String passingScore) {
        return """
                {"name":"Cấu hình L3 %d","questionSetId":%d,"totalQuestions":1,"timeLimitMinutes":30,
                 "passingScore":%s,"maxRetakes":3,"shuffleQuestions":false,"shuffleOptions":false}
                """.formatted(nextSeq(), questionSetId, passingScore);
    }

    private long activeExamConfig() {
        long configId = id(post(API + "/exam-configs", adminToken, configBody(activeQuestionSet(), "5")));
        assertOk(post(API + "/exam-configs/" + configId + "/activate", adminToken, "{}"));
        return configId;
    }

    private long publishedPaper() {
        ResponseEntity<String> generated = post(API + "/exam-papers/generate", adminToken, """
                {"examConfigId":%d,"namePrefix":"Đề chuỗi","variantCount":1,"randomSeed":11}
                """.formatted(activeExamConfig()));
        assertOk(generated);
        long paperId = data(generated).get(0).get("id").asLong();
        assertOk(post(API + "/exam-papers/" + paperId + "/publish", adminToken, "{}"));
        return paperId;
    }

    private String assignmentBody(long paperId, int maxAttempts) {
        return """
                {"name":"Phân công L3 %d","examPaperId":%d,"professionalFieldId":%d,"userIds":[%d],
                 "maxAttempts":%d,"resultVisibility":"SCORE_AND_ANSWERS","status":"DRAFT"}
                """.formatted(nextSeq(), paperId, professionalField.getId(), employee.getId(), maxAttempts);
    }

    private long openAssignment(int maxAttempts) {
        long assignmentId = id(post(API + "/exam-assignments", adminToken,
                assignmentBody(publishedPaper(), maxAttempts)));
        assertOk(post(API + "/exam-assignments/" + assignmentId + "/open", adminToken, "{}"));
        return assignmentId;
    }
}
