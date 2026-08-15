package vn.vietduc.carehubbackend.questiongeneration.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

@Getter
@Setter
@ConfigurationProperties(prefix = "ai.embedding")
public class AiEmbeddingProperties {
    private String provider = "lexical";
    private String model = "intfloat/multilingual-e5-small";
    private int dimension = 384;
    private Path modelPath = Path.of("models", "intfloat", "multilingual-e5-small");
    private boolean preload = true;
    private boolean backfillOnStartup = true;
    private int maxLength = 512;
    private int timeoutSeconds = 30;
    private String fallbackProvider = "lexical";
    private int dedupPageSize = 500;
    private int lexicalPageSize = 500;
    private int cacheTtlMinutes = 30;
    private boolean cacheWarmupEnabled = true;
    // Tắt mặc định: đo thực tế recall@1 chỉ 0.163 và quét đầy đủ vài trăm/vài nghìn vector chỉ
    // tốn ~0.1ms — ANN chỉ đáng bật khi ngân hàng câu hỏi đủ lớn (~10k+ câu). Xem
    // developer_docs/ai/ai-models.md §9.3.
    private boolean annEnabled = false;
    private int annLshBits = 16;
    private int annSearchK = 50;
    private boolean annNeighborBuckets = true;
    private int batchSize = 32;
    private boolean batchEnabled = true;
    private boolean backfillAsync = true;
    private int intraOpThreads = -1;
    private int interOpThreads = 1;

    public boolean isE5Provider() {
        return "e5".equalsIgnoreCase(provider);
    }
}
