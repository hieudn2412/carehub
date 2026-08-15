package vn.vietduc.carehubbackend.api;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.user.entity.User;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * L3 system/API tests — sheet {@code L3-APIFlows}, ids L3-FLOW-01…05.
 *
 * <p>Each test is one business transaction carried out purely through HTTP calls, asserting the
 * state visible to an external caller after every step. Where the API-contract sheets check one
 * endpoint at a time, these check that the endpoints compose.
 */
class ApiFlowSystemTest extends AbstractApiSystemTest {

    @Autowired
    private TrainingActivityTypeRepository activityTypeRepository;
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

    @BeforeEach
    void createFixtures() {
        admin = newUser("L3FADM", "ADMIN");
        employee = newUser("L3FEMP", "USER");
        adminToken = tokenFor(admin);
        employeeToken = tokenFor(employee);
    }

    @DisplayName("L3-FLOW-01 | Multi-step Flow: login → change password → login with the new password → GET /me")
    @Test
    void credentialRotationFlow() {
        // Step 1: log in with the seeded password.
        String token = login(employee.getEmployeeCode(), PASSWORD);

        // Step 2: rotate the credential.
        assertOk(patch(API + "/user/change-password", token, """
                {"oldPassword":"%s","newPassword":"Flow0nePass","confirmNewPassword":"Flow0nePass"}
                """.formatted(PASSWORD)));

        // Step 3: the old password no longer authenticates.
        assertError(post(API + "/auth/login", null, """
                {"employeeCode":"%s","password":"%s"}
                """.formatted(employee.getEmployeeCode(), PASSWORD)), HttpStatus.BAD_REQUEST, "REQ_001");

        // Step 4: the new password does, and its token identifies the same employee.
        String rotated = login(employee.getEmployeeCode(), "Flow0nePass");
        assertThat(data(get(API + "/me", rotated)).get("employeeCode").asText())
                .isEqualTo(employee.getEmployeeCode());
    }

    @DisplayName("L3-FLOW-02 | Multi-step Flow: create a CME record → attach evidence → submit → the personal status endpoint counts the hours")
    @Test
    void cmeRecordWithEvidenceFlow() {
        TrainingActivityType activityType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("L3FLW%04d".formatted(nextSeq()))
                .name("Flow activity")
                .defaultDurationUnit(DurationUnit.HOUR)
                .requiresEvidence(true)
                .active(true)
                .build());

        // Step 1: draft record.
        ResponseEntity<String> created = post(API + "/training/records", employeeToken, """
                {"activityTypeId":%d,"title":"Tập huấn an toàn %d","provider":"Bệnh viện",
                 "startDate":"2026-06-01","endDate":"2026-06-01","durationValue":3,
                 "durationUnit":"HOUR","declaredHours":3}
                """.formatted(activityType.getId(), nextSeq()));
        assertOk(created);
        long recordId = id(created);
        assertThat(data(created).get("workflowStatus").asText()).isEqualTo("DRAFT");

        // Step 2: evidence upload passes moderation and is listed on the record.
        assertOk(upload(API + "/training/records/" + recordId + "/evidences", employeeToken,
                "file", "flow-evidence.png", pngBytes(), MediaType.IMAGE_PNG));
        assertThat(data(get(API + "/training/records/" + recordId + "/evidences", employeeToken)))
                .hasSizeGreaterThan(0);

        // Step 3: submit.
        assertThat(data(post(API + "/training/records/" + recordId + "/submit", employeeToken, "{}"))
                .get("workflowStatus").asText()).isEqualTo("SUBMITTED");

        // Step 4: the hours are visible on the caller's own compliance status.
        JsonNode status = data(get(API + "/training/status/me", employeeToken));
        assertThat(status.get("submittedHours").asDouble()).isEqualTo(3.0);
        assertThat(status.get("employeeId").asLong()).isEqualTo(employee.getId());
    }

    @DisplayName("L3-FLOW-03 | Multi-step Flow: build a checklist → publish → assign → the assignee submits → the admin reads the response")
    @Test
    void checklistAssignmentAndSubmissionFlow() {
        String questionKey = UUID.randomUUID().toString();
        String highOptionKey = UUID.randomUUID().toString();
        User subject = newUser("L3FSUB", "USER");

        // Step 1-2: form + draft version.
        long formId = id(post(API + "/forms", adminToken, """
                {"code":"L3FLOW%04d","title":"Bảng kiểm luồng","subjectType":"USER"}
                """.formatted(nextSeq())));
        long versionId = id(post(API + "/forms/" + formId + "/versions", adminToken,
                versionBody(questionKey, highOptionKey)));

        // Step 3: publish makes it assignable.
        assertThat(data(post(API + "/forms/" + formId + "/versions/" + versionId + "/publication",
                adminToken, null)).get("status").asText()).isEqualTo("PUBLISHED");

        // Step 4: assign to the employee, who now sees it and evaluates another
        // employee in the same department.
        long assignmentItemId = data(post(API + "/form-assignments", adminToken, """
                {"managerId":%d,"formVersionIds":[%d]}
                """.formatted(employee.getId(), versionId)))
                .get("items").get(0).get("assignmentItemId").asLong();
        assertThat(data(get(API + "/assigned-forms", employeeToken)).get("content").toString())
                .contains(String.valueOf(assignmentItemId));

        // Step 5-7: draft submission → answer → submit.
        ResponseEntity<String> draft = post(API + "/form-submissions", employeeToken, """
                {"assignmentItemId":%d,"subject":{"type":"USER","userId":%d}}
                """.formatted(assignmentItemId, subject.getId()));
        long submissionId = id(draft);
        long lockVersion = data(put(API + "/form-submissions/" + submissionId, employeeToken, """
                {"lockVersion":%d,"answers":[{"questionKey":"%s","optionKey":"%s"}]}
                """.formatted(data(draft).get("lockVersion").asLong(), questionKey, highOptionKey)))
                .get("lockVersion").asLong();
        JsonNode submitted = data(post(API + "/form-submissions/" + submissionId + "/submission",
                employeeToken, "{\"lockVersion\":%d}".formatted(lockVersion)));
        assertThat(submitted.get("status").asText()).isEqualTo("SUBMITTED");
        assertThat(submitted.get("scoringStatus").asText()).isEqualTo("CALCULATED");

        // Step 8: the admin sees the response on the form.
        assertThat(get(API + "/forms/" + formId + "/versions/" + versionId + "/responses", adminToken)
                .getBody()).contains(subject.getEmployeeCode());
    }

    @DisplayName("L3-FLOW-04 | Multi-step Flow: question bank → set → config → paper → assignment → the employee sits the exam and it is graded")
    @Test
    void examLifecycleFlow() {
        ProfessionalField field = professionalFieldRepository.save(ProfessionalField.builder()
                .code("L3FPF%04d".formatted(nextSeq()))
                .name("Lĩnh vực luồng")
                .active(true)
                .build());
        QuestionCategory category = questionCategoryRepository.save(QuestionCategory.builder()
                .code("L3FCAT%04d".formatted(nextSeq()))
                .name("An toàn luồng")
                .status(QuestionCategoryStatus.ACTIVE)
                .createdBy("system-test")
                .build());

        // Step 1: an approved question.
        long questionId = id(post(API + "/questions", adminToken, """
                {"stem":"Câu hỏi luồng %d?","optionA":"Đúng","optionB":"Sai","optionC":"Có thể","optionD":"Không",
                 "correctAnswer":"A","categoryId":%d,"professionalFieldId":%d,
                 "cognitiveLevel":"FOUNDATION","language":"vi","status":"APPROVED"}
                """.formatted(nextSeq(), category.getId(), field.getId())));
        var bankQuestion = questionRepository.findById(questionId).orElseThrow();
        bankQuestion.setCategory(category);
        bankQuestion.setProfessionalField(field);
        bankQuestion.setCognitiveLevel(CognitiveLevel.FOUNDATION);
        bankQuestion.setCognitiveVerifiedAt(java.time.LocalDateTime.now());
        bankQuestion.setCognitiveVerifiedBy("system-test");
        bankQuestion.setStatus(QuestionBankStatus.APPROVED);
        questionRepository.save(bankQuestion);

        // Step 2-3: active question set.
        long setId = id(post(API + "/question-sets", adminToken, """
                {"name":"Bộ luồng %d","questionIds":[%d]}
                """.formatted(nextSeq(), questionId)));
        assertOk(post(API + "/question-sets/" + setId + "/activate", adminToken, "{}"));

        // Step 4-5: active exam config.
        long configId = id(post(API + "/exam-configs", adminToken, """
                {"name":"Cấu hình luồng %d","totalQuestions":1,"timeLimitMinutes":30,
                 "passingScore":5,"maxRetakes":2,"shuffleQuestions":false,"shuffleOptions":false,
                 "fieldBlueprints":[{
                   "professionalFieldId":%d,"questionCount":1,"displayOrder":0,
                   "cognitive":[
                     {"cognitiveLevel":"FOUNDATION","questionCount":1},
                     {"cognitiveLevel":"CLINICAL_APPLICATION","questionCount":0},
                     {"cognitiveLevel":"CLINICAL_REASONING_ANALYSIS","questionCount":0}
                   ]
                 }]}
                """.formatted(nextSeq(), field.getId())));
        assertOk(post(API + "/exam-configs/" + configId + "/activate", adminToken, "{}"));

        // Step 6-7: generated and published paper.
        long paperId = data(post(API + "/exam-papers/generate", adminToken, """
                {"examConfigId":%d,"namePrefix":"Đề luồng","variantCount":1,"randomSeed":3,"idempotencyKey":"api-flow-paper-%d"}
                """.formatted(configId, nextSeq()))).get(0).get("id").asLong();
        assertOk(post(API + "/exam-papers/" + paperId + "/publish", adminToken, "{}"));

        // Step 8-9: open assignment targeting the employee.
        long assignmentId = id(post(API + "/exam-assignments", adminToken, """
                {"name":"Phân công luồng %d","examPaperId":%d,"userIds":[%d],"idempotencyKey":"api-flow-assignment-%d",
                 "maxAttempts":2,"shuffleQuestions":false,"shuffleOptions":false,
                 "resultVisibility":"SCORE_ONLY","status":"DRAFT"}
                """.formatted(nextSeq(), paperId, employee.getId(), nextSeq())));
        assertOk(post(API + "/exam-assignments/" + assignmentId + "/open", adminToken, "{}"));

        // Step 10-12: the employee starts, answers and submits.
        JsonNode attempt = data(post(API + "/me/exam-assignments/" + assignmentId + "/start", employeeToken, "{}"));
        long attemptId = attempt.get("id").asLong();
        long paperQuestionId = attempt.get("questions").get(0).get("paperQuestionId").asLong();
        JsonNode graded = data(post(API + "/me/exam-attempts/" + attemptId + "/submit", employeeToken, """
                {"answers":[{"paperQuestionId":%d,"selectedAnswer":"A"}]}
                """.formatted(paperQuestionId)));
        assertThat(graded.get("status").asText()).isEqualTo("GRADED");
        assertThat(graded.get("passed").asBoolean()).isTrue();

        // Step 13: the attempt shows up in the employee's own history as graded.
        assertThat(get(API + "/me/exam-attempts", employeeToken).getBody())
                .contains("GRADED")
                .contains(String.valueOf(attemptId));
    }

    @DisplayName("L3-FLOW-05 | Multi-step Flow + Negative: logout revokes the refresh token, yet the already-issued access token keeps working until it expires (stateless JWT)")
    @Test
    void logoutRevokesRefreshButNotTheAccessToken() {
        // Step 1: log in and keep both credentials.
        JsonNode tokens = data(post(API + "/auth/login", null, """
                {"employeeCode":"%s","password":"%s"}
                """.formatted(employee.getEmployeeCode(), PASSWORD)));
        String accessToken = tokens.get("accessToken").asText();
        String refreshToken = tokens.get("refreshToken").asText();

        // Step 2: the access token works.
        assertOk(get(API + "/me", accessToken));

        // Step 3: log out.
        assertOk(post(API + "/auth/logout", null, """
                {"refreshToken":"%s"}
                """.formatted(refreshToken)));

        // Step 4: refreshing is now refused.
        assertError(post(API + "/auth/refresh-token", null, """
                {"refreshToken":"%s"}
                """.formatted(refreshToken)), HttpStatus.UNAUTHORIZED, "AUTH_001");

        // Step 5: the access token issued before logout still authenticates — there is no server-side
        // session or token blacklist, so it stays valid for its remaining 15-minute lifetime. Clients
        // must drop it themselves.
        assertOk(get(API + "/me", accessToken));
    }

    // ------------------------------------------------------------------ helpers

    private String versionBody(String questionKey, String highOptionKey) {
        return """
                {"title":"Phiên bản luồng","settings":{"scoringEnabled":true},
                 "sections":[{"sectionKey":"%s","title":"Mục kiểm tra","displayOrder":0,
                   "items":[{"itemKey":"%s","itemType":"QUESTION","displayOrder":0,
                     "question":{"questionKey":"%s","code":"flow_q_%d","title":"Đạt yêu cầu?",
                       "fieldType":"SINGLE_CHOICE","required":true,"weight":1,
                       "options":[{"optionKey":"%s","value":"NO","label":"Không","scoreValue":0,"displayOrder":0},
                                  {"optionKey":"%s","value":"YES","label":"Có","scoreValue":1,"displayOrder":1}]}}]}]}
                """.formatted(UUID.randomUUID(), UUID.randomUUID(), questionKey, nextSeq(),
                UUID.randomUUID(), highOptionKey);
    }

    private byte[] pngBytes() {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB), "png", out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("cannot build a PNG fixture", e);
        }
    }
}
