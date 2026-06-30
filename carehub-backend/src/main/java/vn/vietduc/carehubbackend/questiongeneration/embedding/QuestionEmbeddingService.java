package vn.vietduc.carehubbackend.questiongeneration.embedding;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionEmbedding;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.EmbeddingModelService;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.e5.E5TextPreprocessor;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionEmbeddingRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuestionEmbeddingService {
    public static final String STEM_TEXT_TYPE = "stem";

    private final QuestionEmbeddingRepository embeddingRepository;
    private final QuestionBankQuestionRepository questionRepository;
    private final EmbeddingModelService embeddingModelService;
    private final AiEmbeddingProperties properties;
    private final ObjectMapper objectMapper;

    @Transactional
    public void saveStemEmbedding(QuestionBankQuestion question) {
        try {
            persistStemEmbedding(question);
        } catch (RuntimeException ex) {
            log.warn("Không tạo được embedding cho question {}: {}", question == null ? null : question.getId(), ex.getMessage());
        }
    }

    private PersistResult persistStemEmbedding(QuestionBankQuestion question) {
        if (!properties.isE5Provider() || question == null || question.getId() == null) {
            return PersistResult.SKIPPED;
        }
        String normalizedText = E5TextPreprocessor.normalize(question.getStem());
        if (normalizedText.isBlank()) {
            return PersistResult.SKIPPED;
        }
        String hash = sha256(normalizedText);
        if (embeddingRepository
                .findFirstByQuestionAndTextTypeAndEmbeddingModelAndInputTextHash(
                        question,
                        STEM_TEXT_TYPE,
                        properties.getModel(),
                        hash
                )
                .isPresent()) {
            return PersistResult.SKIPPED;
        }
        double[] vector = embeddingModelService.embedPassage(question.getStem());
        QuestionEmbedding embedding = QuestionEmbedding.builder()
                .question(question)
                .textType(STEM_TEXT_TYPE)
                .embeddingModel(properties.getModel())
                .embeddingDimension(vector.length)
                .inputTextHash(hash)
                .normalizedText(normalizedText)
                .vectorJson(toJson(vector))
                .build();
        embeddingRepository.save(embedding);
        return PersistResult.CREATED;
    }

    @Transactional
    public BackfillResult backfillApprovedQuestionEmbeddings() {
        int created = 0;
        int skipped = 0;
        int failed = 0;
        if (!properties.isE5Provider()) {
            return new BackfillResult(0, 0, 0);
        }
        List<QuestionBankQuestion> questions = questionRepository.findByStatusOrderByIdAsc(QuestionBankStatus.APPROVED);
        for (QuestionBankQuestion question : questions) {
            try {
                PersistResult result = persistStemEmbedding(question);
                if (result == PersistResult.CREATED) {
                    created++;
                } else {
                    skipped++;
                }
            } catch (RuntimeException ex) {
                failed++;
                log.warn("Không tạo được embedding cho question {}: {}", question.getId(), ex.getMessage());
            }
        }
        return new BackfillResult(created, skipped, failed);
    }

    @Transactional(readOnly = true)
    public long countApprovedStemEmbeddings() {
        if (!properties.isE5Provider()) {
            return 0;
        }
        return embeddingRepository.countByTextTypeAndEmbeddingModelAndQuestion_Status(
                STEM_TEXT_TYPE,
                properties.getModel(),
                QuestionBankStatus.APPROVED
        );
    }

    @Transactional(readOnly = true)
    public List<QuestionEmbeddingSnapshot> approvedStemEmbeddings() {
        return embeddingRepository
                .findTop500ByTextTypeAndEmbeddingModelAndQuestion_StatusOrderByIdDesc(
                        STEM_TEXT_TYPE,
                        properties.getModel(),
                        QuestionBankStatus.APPROVED
                )
                .stream()
                .map(embedding -> new QuestionEmbeddingSnapshot(
                        embedding.getQuestion().getId(),
                        embedding.getQuestion().getStem(),
                        fromJson(embedding.getVectorJson())
                ))
                .toList();
    }

    public double[] embedCandidateStem(String stem) {
        return embeddingModelService.embedQuery(stem);
    }

    public double[] embedSourceStem(String stem) {
        return embeddingModelService.embedPassage(stem);
    }

    private String toJson(double[] vector) {
        try {
            return objectMapper.writeValueAsString(vector);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Không serialize được embedding vector", ex);
        }
    }

    private double[] fromJson(String json) {
        try {
            return objectMapper.readValue(json, double[].class);
        } catch (Exception ex) {
            return new double[0];
        }
    }

    private String sha256(String text) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 không khả dụng", ex);
        }
    }

    public record BackfillResult(int created, int skipped, int failed) {
    }

    private enum PersistResult {
        CREATED,
        SKIPPED
    }
}
