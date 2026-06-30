package vn.vietduc.carehubbackend.questiongeneration.embedding;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionEmbedding;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.EmbeddingModelService;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionEmbeddingRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QuestionEmbeddingServiceTest {
    private final QuestionEmbeddingRepository embeddingRepository = mock(QuestionEmbeddingRepository.class);
    private final QuestionBankQuestionRepository questionRepository = mock(QuestionBankQuestionRepository.class);
    private final EmbeddingModelService embeddingModelService = mock(EmbeddingModelService.class);
    private final AiEmbeddingProperties properties = new AiEmbeddingProperties();
    private final List<QuestionEmbedding> savedEmbeddings = new ArrayList<>();
    private QuestionEmbeddingService service;

    @BeforeEach
    void setUp() {
        properties.setProvider("e5");
        properties.setModel("intfloat/multilingual-e5-small");
        service = new QuestionEmbeddingService(
                embeddingRepository,
                questionRepository,
                embeddingModelService,
                properties,
                new ObjectMapper()
        );
        when(embeddingRepository.findFirstByQuestionAndTextTypeAndEmbeddingModelAndInputTextHash(
                any(QuestionBankQuestion.class),
                eq(QuestionEmbeddingService.STEM_TEXT_TYPE),
                eq(properties.getModel()),
                any(String.class)
        )).thenAnswer(invocation -> {
            QuestionBankQuestion question = invocation.getArgument(0);
            String hash = invocation.getArgument(3);
            return savedEmbeddings.stream()
                    .filter(embedding -> embedding.getQuestion().equals(question))
                    .filter(embedding -> hash.equals(embedding.getInputTextHash()))
                    .findFirst();
        });
        when(embeddingRepository.save(any(QuestionEmbedding.class))).thenAnswer(invocation -> {
            QuestionEmbedding embedding = invocation.getArgument(0);
            savedEmbeddings.add(embedding);
            return embedding;
        });
        when(embeddingModelService.embedPassage(any(String.class))).thenReturn(new double[]{0.1, 0.2, 0.3});
    }

    @Test
    void saveStemEmbeddingIsIdempotentByNormalizedInputHash() {
        QuestionBankQuestion question = approvedQuestion(1L, "  Vệ sinh tay trước khi chăm sóc người bệnh?  ");

        service.saveStemEmbedding(question);
        service.saveStemEmbedding(question);

        assertThat(savedEmbeddings).hasSize(1);
        assertThat(savedEmbeddings.get(0).getNormalizedText())
                .isEqualTo("vệ sinh tay trước khi chăm sóc người bệnh?");
    }

    @Test
    void saveStemEmbeddingCreatesNewEmbeddingWhenStemHashChanges() {
        QuestionBankQuestion question = approvedQuestion(2L, "Người bệnh cần được xác định bằng mấy thông tin?");

        service.saveStemEmbedding(question);
        question.setStem("Trước thủ thuật, cần đối chiếu ít nhất mấy thông tin người bệnh?");
        service.saveStemEmbedding(question);

        assertThat(savedEmbeddings).hasSize(2);
        assertThat(savedEmbeddings)
                .extracting(QuestionEmbedding::getInputTextHash)
                .doesNotHaveDuplicates();
    }

    @Test
    void backfillCountsCreatedAndSkippedFromHashAwarePersistResult() {
        QuestionBankQuestion alreadyEmbedded = approvedQuestion(3L, "Câu hỏi đã có embedding?");
        QuestionBankQuestion newQuestion = approvedQuestion(4L, "Câu hỏi mới cần embedding?");
        service.saveStemEmbedding(alreadyEmbedded);
        when(questionRepository.findByStatusOrderByIdAsc(QuestionBankStatus.APPROVED))
                .thenReturn(List.of(alreadyEmbedded, newQuestion));

        QuestionEmbeddingService.BackfillResult result = service.backfillApprovedQuestionEmbeddings();

        assertThat(result.created()).isEqualTo(1);
        assertThat(result.skipped()).isEqualTo(1);
        assertThat(result.failed()).isZero();
        assertThat(savedEmbeddings).hasSize(2);
        verify(questionRepository).findByStatusOrderByIdAsc(QuestionBankStatus.APPROVED);
    }

    @Test
    void countApprovedStemEmbeddingsDelegatesToRepositoryForCurrentModel() {
        when(embeddingRepository.countByTextTypeAndEmbeddingModelAndQuestion_Status(
                QuestionEmbeddingService.STEM_TEXT_TYPE,
                properties.getModel(),
                QuestionBankStatus.APPROVED
        )).thenReturn(7L);

        assertThat(service.countApprovedStemEmbeddings()).isEqualTo(7L);
    }

    private QuestionBankQuestion approvedQuestion(Long id, String stem) {
        return QuestionBankQuestion.builder()
                .id(id)
                .stem(stem)
                .optionA("A")
                .optionB("B")
                .optionC("C")
                .optionD("D")
                .correctAnswer("A")
                .language("vi")
                .status(QuestionBankStatus.APPROVED)
                .build();
    }
}
