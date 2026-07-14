package vn.vietduc.carehubbackend.questiongeneration.embedding;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
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

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

@Slf4j
@Service
public class QuestionEmbeddingService {
    public static final String STEM_TEXT_TYPE = "stem";

    private final QuestionEmbeddingRepository embeddingRepository;
    private final QuestionBankQuestionRepository questionRepository;
    private final EmbeddingModelService embeddingModelService;
    private final AiEmbeddingProperties properties;
    private final ObjectMapper objectMapper;
    private final EmbeddingCache embeddingCache;

    public QuestionEmbeddingService(
            QuestionEmbeddingRepository embeddingRepository,
            QuestionBankQuestionRepository questionRepository,
            EmbeddingModelService embeddingModelService,
            AiEmbeddingProperties properties,
            ObjectMapper objectMapper,
            @Lazy EmbeddingCache embeddingCache) {
        this.embeddingRepository = embeddingRepository;
        this.questionRepository = questionRepository;
        this.embeddingModelService = embeddingModelService;
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.embeddingCache = embeddingCache;
    }

    @Transactional
    public void saveStemEmbedding(QuestionBankQuestion question) {
        try {
            persistStemEmbedding(question);
        } catch (RuntimeException ex) {
            log.warn("Không tạo được embedding cho question {}: {}", question == null ? null : question.getId(), ex.getMessage());
        } finally {
            embeddingCache.invalidate();
        }
    }

    @Transactional
    public void refreshStemEmbedding(QuestionBankQuestion question) {
        if (question == null || question.getId() == null) {
            return;
        }
        embeddingRepository.deleteByQuestionAndTextType(question, STEM_TEXT_TYPE);
        saveStemEmbedding(question);
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
                .vector(toBytes(vector))
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

        if (properties.isBatchEnabled()) {
            return backfillWithBatch(questions);
        }
        return backfillSequential(questions);
    }

    private BackfillResult backfillSequential(List<QuestionBankQuestion> questions) {
        int created = 0;
        int skipped = 0;
        int failed = 0;
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

    private BackfillResult backfillWithBatch(List<QuestionBankQuestion> questions) {
        int created = 0;
        int skipped = 0;
        int failed = 0;

        // Lọc: chỉ giữ câu chưa có embedding (incremental)
        List<QuestionBankQuestion> pending = new ArrayList<>();
        for (QuestionBankQuestion q : questions) {
            String normalizedText = E5TextPreprocessor.normalize(q.getStem());
            if (normalizedText.isBlank()) {
                skipped++;
                continue;
            }
            String hash = sha256(normalizedText);
            boolean exists = embeddingRepository
                    .findFirstByQuestionAndTextTypeAndEmbeddingModelAndInputTextHash(
                            q, STEM_TEXT_TYPE, properties.getModel(), hash)
                    .isPresent();
            if (exists) {
                skipped++;
            } else {
                pending.add(q);
            }
        }

        if (pending.isEmpty()) {
            return new BackfillResult(0, skipped, 0);
        }

        // Batch embed
        List<String> stems = pending.stream().map(QuestionBankQuestion::getStem).toList();
        List<double[]> vectors;
        try {
            vectors = embeddingModelService.embedPassageBatch(stems, progress -> {
                log.info("E5 batch backfill progress: {}/{} questions", progress, stems.size());
            });
        } catch (RuntimeException ex) {
            failed = pending.size();
            log.warn("E5 batch backfill failed: {}", ex.getMessage());
            return new BackfillResult(0, skipped, failed);
        }

        // Persist từng kết quả
        for (int i = 0; i < pending.size(); i++) {
            try {
                persistStemEmbeddingFromVector(pending.get(i), vectors.get(i));
                created++;
            } catch (RuntimeException ex) {
                failed++;
                log.warn("Không persist được embedding cho question {}: {}", pending.get(i).getId(), ex.getMessage());
            }
        }
        return new BackfillResult(created, skipped, failed);
    }

    private PersistResult persistStemEmbeddingFromVector(QuestionBankQuestion question, double[] vector) {
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
                        question, STEM_TEXT_TYPE, properties.getModel(), hash)
                .isPresent()) {
            return PersistResult.SKIPPED;
        }
        QuestionEmbedding embedding = QuestionEmbedding.builder()
                .question(question)
                .textType(STEM_TEXT_TYPE)
                .embeddingModel(properties.getModel())
                .embeddingDimension(vector.length)
                .inputTextHash(hash)
                .normalizedText(normalizedText)
                .vectorJson(toJson(vector))
                .vector(toBytes(vector))
                .build();
        embeddingRepository.save(embedding);
        return PersistResult.CREATED;
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
        return loadAllApprovedStemEmbeddings();
    }

    @Transactional(readOnly = true)
    public List<QuestionEmbeddingSnapshot> loadAllApprovedStemEmbeddings() {
        List<QuestionEmbeddingSnapshot> allEmbeddings = new ArrayList<>();
        int page = 0;
        int pageSize = Math.max(1, properties.getDedupPageSize());
        Pageable pageable = PageRequest.of(page, pageSize);

        List<QuestionEmbedding> pageResult;
        do {
            pageResult = embeddingRepository
                    .findPageByTextTypeAndEmbeddingModelAndQuestionStatus(
                            STEM_TEXT_TYPE,
                            properties.getModel(),
                            QuestionBankStatus.APPROVED,
                            pageable
                    );
            for (QuestionEmbedding embedding : pageResult) {
                allEmbeddings.add(new QuestionEmbeddingSnapshot(
                        embedding.getQuestion().getId(),
                        embedding.getQuestion().getStem(),
                        fromJson(embedding.getVectorJson())
                ));
            }
            page++;
            pageable = PageRequest.of(page, pageSize);
        } while (!pageResult.isEmpty() && pageResult.size() == pageSize);

        return allEmbeddings;
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

    private byte[] toBytes(double[] vector) {
        ByteBuffer buffer = ByteBuffer.allocate(vector.length * Double.BYTES);
        buffer.order(ByteOrder.nativeOrder());
        for (double v : vector) {
            buffer.putDouble(v);
        }
        return buffer.array();
    }

    public record BackfillResult(int created, int skipped, int failed) {
    }

    private enum PersistResult {
        CREATED,
        SKIPPED
    }
}
