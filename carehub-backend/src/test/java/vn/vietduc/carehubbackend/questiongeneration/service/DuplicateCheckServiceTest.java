package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.ValidationRulesProperties;
import vn.vietduc.carehubbackend.questiongeneration.embedding.AnnEmbeddingIndex;
import vn.vietduc.carehubbackend.questiongeneration.embedding.EmbeddingCache;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionCandidateRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateCheckResult;

import java.util.Collection;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DuplicateCheckServiceTest {
    private final DocumentQuestionCandidateRepository candidateRepository = mock(DocumentQuestionCandidateRepository.class);
    private final QuestionBankQuestionRepository questionRepository = mock(QuestionBankQuestionRepository.class);
    private final QuestionEmbeddingService embeddingService = mock(QuestionEmbeddingService.class);
    private final EmbeddingCache embeddingCache = mock(EmbeddingCache.class);
    private final AnnEmbeddingIndex annIndex = mock(AnnEmbeddingIndex.class);
    private final AiEmbeddingProperties embeddingProperties = new AiEmbeddingProperties();
    private final ValidationRulesProperties validationProperties = new ValidationRulesProperties();
    private DuplicateCheckService service;

    @BeforeEach
    void setUp() {
        embeddingProperties.setProvider("e5");
        embeddingProperties.setAnnEnabled(false); // Tắt ANN để test exact search
        service = new DuplicateCheckService(
                candidateRepository,
                questionRepository,
                embeddingService,
                embeddingCache,
                annIndex,
                embeddingProperties,
                validationProperties
        );
        when(candidateRepository.findByStatusIn(
                org.mockito.ArgumentMatchers.<Collection<CandidateStatus>>any(),
                any(Pageable.class)))
                .thenReturn(List.of());
        when(annIndex.isReady()).thenReturn(false);
    }

    @Test
    void semanticCheckMarksStrongDuplicateAndHonorsExcludedSourceQuestion() {
        when(embeddingService.embedCandidateStem("Cần xác định người bệnh bằng mấy thông tin?"))
                .thenReturn(new double[]{1.0, 0.0});
        when(embeddingCache.approvedStemEmbeddings()).thenReturn(List.of(
                new QuestionEmbeddingSnapshot(10L, "Nguồn gốc cần bỏ qua", new double[]{1.0, 0.0}),
                new QuestionEmbeddingSnapshot(11L, "Đối chiếu hai thông tin nhận diện người bệnh", new double[]{0.96, 0.28})
        ));

        DuplicateCheckResult result = service.check(
                "Cần xác định người bệnh bằng mấy thông tin?",
                Set.of(10L)
        );

        assertThat(result.checker()).isEqualTo("e5");
        assertThat(result.matchedQuestionId()).isEqualTo(11L);
        assertThat(result.maxSimilarity()).isGreaterThanOrEqualTo(validationProperties.getDuplicate().getStrongMin());
        assertThat(result.strongDuplicate()).isTrue();
        assertThat(result.needsReview()).isTrue();
        assertThat(result.warning()).isNull();
    }

    @Test
    void semanticFailureFallsBackToLexicalCheckWithWarning() {
        when(embeddingService.embedCandidateStem(anyString())).thenThrow(new IllegalStateException("model missing"));
        when(questionRepository.findByStatus(
                org.mockito.ArgumentMatchers.eq(QuestionBankStatus.APPROVED),
                any(Pageable.class)))
                .thenReturn(List.of(
                        approvedQuestion(20L, "Cần xác định người bệnh bằng hai thông tin nhận diện")
                ))
                .thenReturn(List.of());

        DuplicateCheckResult result = service.check("Cần xác định người bệnh bằng hai thông tin nhận diện");

        assertThat(result.checker()).isEqualTo("lexical-fallback");
        assertThat(result.warning()).contains("kiểm tra trùng ngữ nghĩa");
        assertThat(result.matchedQuestionId()).isEqualTo(20L);
        assertThat(result.maxSimilarity()).isEqualTo(1.0);
        assertThat(result.strongDuplicate()).isTrue();
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
