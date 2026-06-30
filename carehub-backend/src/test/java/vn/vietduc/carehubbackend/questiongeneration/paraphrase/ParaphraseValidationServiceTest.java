package vn.vietduc.carehubbackend.questiongeneration.paraphrase;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphrasedMcq;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill.ProtectedTermService;
import vn.vietduc.carehubbackend.questiongeneration.service.DuplicateCheckService;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateCheckResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ParaphraseValidationServiceTest {
    private final DuplicateCheckService duplicateCheckService = mock(DuplicateCheckService.class);
    private final QuestionEmbeddingService embeddingService = mock(QuestionEmbeddingService.class);
    private final AiEmbeddingProperties embeddingProperties = new AiEmbeddingProperties();
    private ParaphraseValidationService service;

    @BeforeEach
    void setUp() {
        embeddingProperties.setProvider("lexical");
        service = new ParaphraseValidationService(
                new ProtectedTermService(),
                duplicateCheckService,
                embeddingService,
                embeddingProperties
        );
        when(duplicateCheckService.similarity(anyString(), anyString())).thenReturn(0.55);
        when(duplicateCheckService.check(anyString(), anySet())).thenReturn(new DuplicateCheckResult(
                0.1,
                null,
                null,
                false,
                false,
                null,
                "lexical"
        ));
    }

    @Test
    void rejectsCandidateThatDropsProtectedNumbersOrTerms() {
        QuestionBankQuestion source = sourceQuestion("Người bệnh cần dùng thuốc 5 mg trước thủ thuật SpO2?");
        ParaphrasedMcq candidate = validCandidate("Trước thủ thuật, người bệnh cần dùng thuốc như thế nào?");

        ParaphraseValidationResult result = service.validate(source, candidate);

        assertThat(result.rejected()).isTrue();
        assertThat(result.warnings()).anyMatch(warning -> warning.contains("Mất thuật ngữ"));
    }

    @Test
    void rejectsBannedAnswerOptionPatterns() {
        QuestionBankQuestion source = sourceQuestion("Biện pháp nào giúp xác định đúng người bệnh?");
        ParaphrasedMcq candidate = new ParaphrasedMcq(
                "Cách nào hỗ trợ xác định đúng người bệnh?",
                "Tất cả đều đúng",
                "Chỉ hỏi số phòng",
                "Chỉ nhìn vị trí giường",
                "Bỏ qua khi người bệnh tỉnh",
                "raw"
        );

        ParaphraseValidationResult result = service.validate(source, candidate);

        assertThat(result.rejected()).isTrue();
        assertThat(result.warnings()).anyMatch(warning -> warning.contains("mẫu không phù hợp"));
    }

    @Test
    void rejectsCandidateWhenE5SourceSimilarityIsTooLow() {
        embeddingProperties.setProvider("e5");
        when(embeddingService.embedSourceStem(anyString())).thenReturn(new double[]{1.0, 0.0});
        when(embeddingService.embedCandidateStem(anyString())).thenReturn(new double[]{0.0, 1.0});
        QuestionBankQuestion source = sourceQuestion("Khi tiêm thuốc, cần xác định người bệnh bằng mấy thông tin?");
        ParaphrasedMcq candidate = validCandidate("Sau khi ăn, người bệnh nên nghỉ trong bao lâu?");

        ParaphraseValidationResult result = service.validate(source, candidate);

        assertThat(result.rejected()).isTrue();
        assertThat(result.semanticSimilarity()).isEqualTo(0.0);
        assertThat(result.warnings()).anyMatch(warning -> warning.contains("đổi nghĩa"));
    }

    @Test
    void rejectsStrongDuplicateOutsideSourceQuestion() {
        when(duplicateCheckService.check(anyString(), anySet())).thenReturn(new DuplicateCheckResult(
                0.96,
                99L,
                "Câu hỏi gần trùng trong ngân hàng",
                true,
                true,
                null,
                "e5"
        ));
        QuestionBankQuestion source = sourceQuestion("Cần đối chiếu mấy thông tin nhận diện người bệnh?");
        ParaphrasedMcq candidate = validCandidate("Nên kiểm tra bao nhiêu thông tin nhận diện người bệnh?");

        ParaphraseValidationResult result = service.validate(source, candidate);

        assertThat(result.rejected()).isTrue();
        assertThat(result.duplicateQuestionId()).isEqualTo(99L);
        assertThat(result.warnings()).anyMatch(warning -> warning.contains("Trùng ngữ nghĩa mạnh"));
    }

    private QuestionBankQuestion sourceQuestion(String stem) {
        return QuestionBankQuestion.builder()
                .id(10L)
                .stem(stem)
                .optionA("Đối chiếu ít nhất hai thông tin nhận diện")
                .optionB("Chỉ hỏi số phòng")
                .optionC("Chỉ dựa vào vị trí giường")
                .optionD("Bỏ qua nếu người bệnh tỉnh")
                .correctAnswer("A")
                .language("vi")
                .status(QuestionBankStatus.APPROVED)
                .build();
    }

    private ParaphrasedMcq validCandidate(String stem) {
        return new ParaphrasedMcq(
                stem,
                "Kiểm tra tối thiểu hai thông tin nhận diện",
                "Chỉ cần hỏi số phòng",
                "Chỉ nhìn vị trí giường hiện tại",
                "Có thể bỏ qua nếu người bệnh tỉnh táo",
                "raw"
        );
    }
}
