package vn.vietduc.carehubbackend.questiongeneration.embedding;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
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
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
public class QuestionEmbeddingService {
    /**
     * Phiên bản của cách nhúng stem. Đổi giá trị này làm mọi bản ghi cũ không còn khớp
     * khoá tra cứu (text_type nằm trong unique constraint và trong mọi query), nên backfill
     * sẽ tự sinh lại toàn bộ — dùng khi cách nhúng thay đổi về mặt ngữ nghĩa.
     *
     * <p>{@code stem} → {@code stem_sym_v2}: chuyển từ nhúng bất đối xứng (bank dùng
     * {@code passage:}, ứng viên dùng {@code query:}) sang nhúng đối xứng dùng chung
     * một tiền tố cho cả hai vế.</p>
     */
    public static final String STEM_TEXT_TYPE = "stem_sym_v2";

    /** Giá trị text_type của cách nhúng cũ, chỉ còn dùng để dọn dẹp. */
    public static final String LEGACY_STEM_TEXT_TYPE = "stem";

    private final QuestionEmbeddingRepository embeddingRepository;
    private final QuestionBankQuestionRepository questionRepository;
    private final EmbeddingModelService embeddingModelService;
    private final AiEmbeddingProperties properties;
    private final ObjectMapper objectMapper;
    private final EmbeddingCache embeddingCache;
    private QuestionEmbeddingService self;

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
        this.self = this;
    }

    /** Tự tiêm để mỗi lô backfill chạy trong một transaction riêng. */
    @Lazy
    @Autowired
    public void setSelf(QuestionEmbeddingService self) {
        this.self = self;
    }

    /**
     * Dùng khi câu hỏi vừa được THÊM vào tập đã duyệt. Cache chỉ cần nhận thêm một vector, không
     * phải nạp lại cả bảng — xem {@link EmbeddingCache#appendAfterCommit}. Với câu hỏi đã tồn tại
     * mà nội dung thay đổi, dùng {@link #refreshStemEmbedding} thay cho hàm này.
     */
    @Transactional
    public void saveStemEmbedding(QuestionBankQuestion question) {
        try {
            QuestionEmbeddingSnapshot created = persistStemEmbedding(question);
            if (created != null) {
                embeddingCache.appendAfterCommit(created);
            } else {
                // Không tạo vector mới, nhưng tập câu ĐÃ DUYỆT có thể vừa đổi (ví dụ câu cũ được
                // duyệt lại và vector cũ vẫn còn dùng được) nên cache vẫn phải nạp lại.
                embeddingCache.invalidate();
            }
        } catch (RuntimeException ex) {
            log.warn("Không tạo được embedding cho question {}: {}", question == null ? null : question.getId(), ex.getMessage());
            embeddingCache.invalidate();
        }
    }

    @Transactional
    public void refreshStemEmbedding(QuestionBankQuestion question) {
        if (question == null || question.getId() == null) {
            return;
        }
        embeddingRepository.deleteByQuestionAndTextType(question, STEM_TEXT_TYPE);
        try {
            persistStemEmbedding(question);
        } catch (RuntimeException ex) {
            log.warn("Không tạo được embedding cho question {}: {}", question.getId(), ex.getMessage());
        } finally {
            // Luôn invalidate: vector CŨ vừa bị xoá nên bản trong cache không còn đúng, append
            // thêm bản mới sẽ để lại hai bản ghi cho cùng một câu hỏi.
            embeddingCache.invalidate();
        }
    }

    /** @return snapshot của vector vừa tạo, hoặc {@code null} nếu không phải tạo mới. */
    private QuestionEmbeddingSnapshot persistStemEmbedding(QuestionBankQuestion question) {
        if (!properties.isE5Provider() || question == null || question.getId() == null) {
            return null;
        }
        String normalizedText = E5TextPreprocessor.normalize(question.getStem());
        if (normalizedText.isBlank()) {
            return null;
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
            return null;
        }
        double[] vector = embeddingModelService.embedSymmetric(question.getStem());
        embeddingRepository.save(buildEmbedding(question, normalizedText, hash, vector));
        return new QuestionEmbeddingSnapshot(question.getId(), question.getStem(), vector);
    }

    /**
     * Không gắn {@code @Transactional} ở đây: quá trình nhúng cả ngân hàng câu hỏi có thể
     * kéo dài hàng phút, giữ một transaction suốt thời gian đó sẽ chiếm connection HikariCP.
     * Mỗi lô được commit riêng qua {@link #backfillBatch(List)}.
     */
    public BackfillResult backfillApprovedQuestionEmbeddings() {
        if (!properties.isE5Provider()) {
            return new BackfillResult(0, 0, 0);
        }
        int created = 0;
        int skipped = 0;
        int failed = 0;
        int pageSize = Math.max(1, properties.getDedupPageSize());

        int page = 0;
        List<QuestionBankQuestion> batch;
        do {
            batch = questionRepository.findByStatus(
                    QuestionBankStatus.APPROVED, PageRequest.of(page++, pageSize));
            if (batch.isEmpty()) {
                break;
            }
            BackfillResult result = self.backfillBatch(batch);
            created += result.created();
            skipped += result.skipped();
            failed += result.failed();
        } while (batch.size() == pageSize);

        return new BackfillResult(created, skipped, failed);
    }

    @Transactional
    public BackfillResult backfillBatch(List<QuestionBankQuestion> questions) {
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
                if (persistStemEmbedding(question) != null) {
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
        int skipped = 0;

        // Một truy vấn lấy hết khoá đã có, thay vì gọi findFirst... cho từng câu.
        Set<String> existingKeys = new HashSet<>(embeddingRepository.findExistingKeys(
                STEM_TEXT_TYPE,
                properties.getModel(),
                questions.stream().map(QuestionBankQuestion::getId).toList()
        ));

        List<QuestionBankQuestion> pending = new ArrayList<>();
        List<String> pendingNormalized = new ArrayList<>();
        List<String> pendingHashes = new ArrayList<>();
        for (QuestionBankQuestion question : questions) {
            String normalizedText = E5TextPreprocessor.normalize(question.getStem());
            if (normalizedText.isBlank()) {
                skipped++;
                continue;
            }
            String hash = sha256(normalizedText);
            if (existingKeys.contains(question.getId() + ":" + hash)) {
                skipped++;
                continue;
            }
            pending.add(question);
            pendingNormalized.add(normalizedText);
            pendingHashes.add(hash);
        }

        if (pending.isEmpty()) {
            return new BackfillResult(0, skipped, 0);
        }

        List<String> stems = pending.stream().map(QuestionBankQuestion::getStem).toList();
        List<double[]> vectors;
        try {
            vectors = embeddingModelService.embedSymmetricBatch(stems, progress ->
                    log.info("E5 batch backfill progress: {}/{} questions", progress, stems.size()));
        } catch (RuntimeException ex) {
            log.warn("E5 batch backfill failed: {}", ex.getMessage());
            return new BackfillResult(0, skipped, pending.size());
        }

        int created = 0;
        int failed = 0;
        for (int i = 0; i < pending.size(); i++) {
            try {
                embeddingRepository.save(buildEmbedding(
                        pending.get(i), pendingNormalized.get(i), pendingHashes.get(i), vectors.get(i)));
                created++;
            } catch (RuntimeException ex) {
                failed++;
                log.warn("Không persist được embedding cho question {}: {}", pending.get(i).getId(), ex.getMessage());
            }
        }
        return new BackfillResult(created, skipped, failed);
    }

    private QuestionEmbedding buildEmbedding(
            QuestionBankQuestion question,
            String normalizedText,
            String hash,
            double[] vector
    ) {
        return QuestionEmbedding.builder()
                .question(question)
                .textType(STEM_TEXT_TYPE)
                .embeddingModel(properties.getModel())
                .embeddingDimension(vector.length)
                .inputTextHash(hash)
                .normalizedText(normalizedText)
                .vectorJson(toJson(vector))
                .vector(toBytes(vector))
                .build();
    }

    /**
     * Báo cho cache biết TẬP CÂU HỎI ĐÃ DUYỆT vừa thay đổi, dù bản thân embedding không đổi.
     *
     * <p>Dùng khi một câu hỏi bị gỡ khỏi trạng thái APPROVED (lưu trữ, hạ về nháp): vector của nó
     * vẫn còn trong bảng nhưng không được phép tham gia so trùng nữa. Không gọi thì cache và
     * chỉ mục ANN vẫn tiếp tục đối chiếu với câu đã gỡ.</p>
     */
    public void invalidateApprovedSetCache() {
        embeddingCache.invalidate();
    }

    /** Xoá các embedding sinh bằng cách nhúng cũ (bất đối xứng) — chỉ cần chạy một lần. */
    @Transactional
    public long deleteLegacyStemEmbeddings() {
        long deleted = embeddingRepository.deleteByTextType(LEGACY_STEM_TEXT_TYPE);
        if (deleted > 0) {
            log.info("Đã xoá {} embedding cũ (textType={})", deleted, LEGACY_STEM_TEXT_TYPE);
        }
        return deleted;
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

        List<QuestionEmbeddingRepository.EmbeddingVectorProjection> pageResult;
        do {
            pageResult = embeddingRepository
                    .findVectorPageByTextTypeAndEmbeddingModelAndQuestionStatus(
                            STEM_TEXT_TYPE,
                            properties.getModel(),
                            QuestionBankStatus.APPROVED,
                            pageable
                    );
            for (QuestionEmbeddingRepository.EmbeddingVectorProjection embedding : pageResult) {
                allEmbeddings.add(new QuestionEmbeddingSnapshot(
                        embedding.getQuestionId(),
                        embedding.getStem(),
                        fromBytes(embedding.getVector())
                ));
            }
            page++;
            pageable = PageRequest.of(page, pageSize);
        } while (!pageResult.isEmpty() && pageResult.size() == pageSize);

        return allEmbeddings;
    }

    /**
     * Nhúng một stem để so trùng. Cả câu ứng viên và câu trong ngân hàng đều đi qua đây,
     * nên hai vế luôn nằm trong cùng một không gian nhúng.
     */
    public double[] embedCandidateStem(String stem) {
        return embeddingModelService.embedSymmetric(stem);
    }

    /** @see #embedCandidateStem(String) — cùng cách nhúng, tách tên cho dễ đọc ở nơi gọi. */
    public double[] embedSourceStem(String stem) {
        return embeddingModelService.embedSymmetric(stem);
    }

    /** Nhúng nhiều stem trong một lần chạy model — dùng khi kiểm tra trùng cả một lô ứng viên. */
    public List<double[]> embedCandidateStems(List<String> stems) {
        return embeddingModelService.embedSymmetricBatch(stems);
    }

    private String toJson(double[] vector) {
        try {
            return objectMapper.writeValueAsString(vector);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Không serialize được embedding vector", ex);
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

    private double[] fromBytes(byte[] bytes) {
        if (bytes == null || bytes.length < Double.BYTES) {
            return new double[0];
        }
        ByteBuffer buffer = ByteBuffer.wrap(bytes).order(ByteOrder.nativeOrder());
        double[] vector = new double[bytes.length / Double.BYTES];
        for (int i = 0; i < vector.length; i++) {
            vector[i] = buffer.getDouble();
        }
        return vector;
    }

    public record BackfillResult(int created, int skipped, int failed) {
    }
}
