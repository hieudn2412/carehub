package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.config.ValidationRulesProperties;
import vn.vietduc.carehubbackend.questiongeneration.service.model.CandidateValidationResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedQuestion;

import static org.assertj.core.api.Assertions.assertThat;

class QuestionCandidateValidationServiceTest {
    private final QuestionCandidateValidationService service =
            new QuestionCandidateValidationService(new ObjectMapper(), new ValidationRulesProperties());

    @Test
    void validateRejectsBannedOptionPattern() {
        GeneratedQuestion question = validQuestion(
                "Tất cả đều đúng",
                "Người bệnh cần được xác định bằng tối thiểu hai thông tin."
        );

        CandidateValidationResult result = service.validate(question, "Người bệnh cần được xác định bằng tối thiểu hai thông tin.");

        assertThat(result.rejected()).isTrue();
        assertThat(result.warnings()).anyMatch(warning -> warning.contains("Phương án trả lời chứa mẫu không phù hợp"));
    }

    @Test
    void validateMarksMissingGroundingForReview() {
        GeneratedQuestion question = validQuestion(
                "Chỉ cần hỏi tên người bệnh.",
                "Trích dẫn không tồn tại trong chunk"
        );

        CandidateValidationResult result = service.validate(question, "Người bệnh cần được xác định bằng tối thiểu hai thông tin.");

        assertThat(result.rejected()).isFalse();
        assertThat(result.needsReview()).isTrue();
        assertThat(result.warnings()).anyMatch(warning -> warning.contains("Trích dẫn nguồn chưa khớp"));
    }

    @Test
    void groundedV4WarnsButNoLongerRejectsEvidenceThatIsNotAnExactSourceExcerpt() {
        GeneratedQuestion legacy = validQuestion(
                "Chỉ cần hỏi tên người bệnh.",
                "Người bệnh cần được xác định bằng tối thiểu hai thông tin."
        );
        GeneratedQuestion grounded = new GeneratedQuestion(
                legacy.stem(),
                legacy.optionA(),
                legacy.optionB(),
                legacy.optionC(),
                legacy.optionD(),
                legacy.correctAnswer(),
                legacy.explanation(),
                legacy.cognitiveLevel(),
                legacy.topic(),
                legacy.sourceExcerpt(),
                legacy.knowledgePointId(),
                legacy.rawJson(),
                null,
                "FACT",
                "Bằng chứng không có trong nguồn",
                "{\"B\":\"trái nguồn\",\"C\":\"trái nguồn\",\"D\":\"trái nguồn\"}"
        );

        CandidateValidationResult result = service.validate(
                grounded,
                "Người bệnh cần được xác định bằng tối thiểu hai thông tin."
        );

        // Thiếu sót về grounding chỉ còn là cảnh báo; tự động từ chối chỉ dành cho lỗi cấu trúc.
        assertThat(result.rejected()).isFalse();
        assertThat(result.evidenceStatus()).isEqualTo("MISMATCH");
        assertThat(result.warnings())
                .anyMatch(warning -> warning.contains("Bằng chứng đáp án không xuất hiện nguyên văn"));
    }

    @Test
    void groundedV4RejectsMediumQuestionThatCanBeGuessedWithoutDomainReasoning() {
        String source = "Người bệnh cần được xác định bằng tối thiểu hai thông tin.";
        GeneratedQuestion question = new GeneratedQuestion(
                "Yêu cầu nào đúng khi xác định người bệnh?",
                "Xác định bằng tối thiểu hai thông tin",
                "Chỉ cần hỏi tên",
                "Có thể bỏ qua hoàn toàn",
                "Không bao giờ cần đối chiếu",
                "A",
                "Đáp án A bám nguồn.",
                "CLINICAL_APPLICATION",
                "An toàn người bệnh",
                source,
                "KP1",
                "{}",
                """
                        {
                          "answerable":true,
                          "singleBestAnswer":true,
                          "correctAnswerSupported":true,
                          "distractorsInvalid":true,
                          "surfaceCueFree":false,
                          "distractorsPlausible":false,
                          "requiresDomainReasoning":false,
                          "qualityScore":0.7,
                          "issues":["Có thể loại trừ bằng từ tuyệt đối"]
                        }
                        """,
                "application",
                source,
                "{\"B\":\"sai điều kiện\",\"C\":\"trái nguồn\",\"D\":\"trái nguồn\"}"
        );

        CandidateValidationResult result = service.validate(question, source);

        assertThat(result.rejected()).isTrue();
        assertThat(result.warnings())
                .anyMatch(warning -> warning.contains("surfaceCueFree") || warning.contains("LLM validation"))
                .anyMatch(warning -> warning.contains("LLM validation"));
    }

    private GeneratedQuestion validQuestion(String optionB, String sourceExcerpt) {
        return new GeneratedQuestion(
                "Theo tài liệu, yêu cầu nào đúng khi xác định người bệnh?",
                "Người bệnh cần được xác định bằng tối thiểu hai thông tin.",
                optionB,
                "Có thể bỏ qua bước xác định nếu đang cấp cứu.",
                "Không cần đối chiếu thông tin trên hồ sơ.",
                "A",
                "Đáp án A bám nguồn.",
                "FOUNDATION",
                "An toàn người bệnh",
                sourceExcerpt,
                "KP1",
                "{}",
                """
                        {"answerable":true,"singleBestAnswer":true,"correctAnswerSupported":true,"qualityScore":0.86,"issues":[]}
                        """
        );
    }
}
