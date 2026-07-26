package vn.vietduc.carehubbackend.questiongeneration.embedding;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.LoadingCache;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Component
@RequiredArgsConstructor
public class EmbeddingCache {
    private static final String APPROVED_STEMS_KEY = "approved_stems";

    private final QuestionEmbeddingService embeddingService;
    private final AiEmbeddingProperties properties;
    private final AnnEmbeddingIndex annIndex;

    private volatile LoadingCache<String, List<QuestionEmbeddingSnapshot>> cache;

    /** Tăng mỗi lần ngân hàng câu hỏi đổi; ANN index dùng số này để biết có cần build lại. */
    private final AtomicLong dataVersion = new AtomicLong();

    @PostConstruct
    void init() {
        if (!properties.isE5Provider()) {
            return;
        }

        this.cache = Caffeine.newBuilder()
                .maximumSize(5)
                .expireAfterWrite(Duration.ofMinutes(properties.getCacheTtlMinutes()))
                .recordStats()
                .build(key -> {
                    log.info("Loading all approved stem embeddings into cache");
                    return embeddingService.loadAllApprovedStemEmbeddings();
                });
        log.info("Embedding cache initialized");
    }

    public List<QuestionEmbeddingSnapshot> approvedStemEmbeddings() {
        if (cache == null) {
            return embeddingService.loadAllApprovedStemEmbeddings();
        }
        long versionAtLoad = dataVersion.get();
        List<QuestionEmbeddingSnapshot> result = cache.get(APPROVED_STEMS_KEY);
        // Rebuild ANN index theo version của dữ liệu, không theo số lượng: sửa nội dung một
        // câu hỏi làm vector đổi mà số lượng giữ nguyên. AnnEmbeddingIndex tự bỏ qua nếu
        // đã build đúng version này rồi.
        if (result != null && properties.isAnnEnabled()) {
            annIndex.rebuild(result, versionAtLoad);
        }
        return result;
    }

    /**
     * Invalidate cache khi có thay đổi trong ngân hàng câu hỏi.
     * Gọi từ QuestionEmbeddingService hoặc QuestionBankService.
     */
    public void invalidate() {
        dataVersion.incrementAndGet();
        if (cache != null) {
            cache.invalidateAll();
            log.info("Embedding cache invalidated (dataVersion={})", dataVersion.get());
        }
    }

    /**
     * Số lượng embedding đang cache.
     */
    public int cachedCount() {
        if (cache == null) {
            return 0;
        }
        List<QuestionEmbeddingSnapshot> cached = cache.getIfPresent(APPROVED_STEMS_KEY);
        return cached == null ? 0 : cached.size();
    }
}
