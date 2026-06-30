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

    private GeneratedQuestion validQuestion(String optionB, String sourceExcerpt) {
        return new GeneratedQuestion(
                "Theo tài liệu, yêu cầu nào đúng khi xác định người bệnh?",
                "Người bệnh cần được xác định bằng tối thiểu hai thông tin.",
                optionB,
                "Có thể bỏ qua bước xác định nếu đang cấp cứu.",
                "Không cần đối chiếu thông tin trên hồ sơ.",
                "A",
                "Đáp án A bám nguồn.",
                "easy",
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
