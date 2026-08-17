package vn.vietduc.carehubbackend.questiongeneration.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

@Getter
@Setter
@ConfigurationProperties(prefix = "ai.paraphrase")
public class AiParaphraseProperties {
    private String provider = "vietquill";
    private String model = "ngwgsang/vietquill-vit5-base-tsubaki";
    private Path modelPath = Path.of("models", "ngwgsang", "vietquill-vit5-base-tsubaki");
    private boolean preload = false;
    private int maxInputLength = 512;
    private int maxOutputLength = 512;
    private int timeoutSeconds = 60;
    private int generateTimeoutSeconds = 30;
    private int numBeams = 4;
    private int maxDecodeLength = 96;
    private int requestedCountDefault = 3;
    /**
     * Safe by default: paraphrase only the question stem and preserve all
     * answer options. Full-option paraphrasing can be enabled explicitly after
     * domain quality validation.
     */
    private boolean paraphraseOptions = false;
    private int poolSize = 2;
    private long acquireTimeoutMs = 30_000;

    /**
     * Tắt mặc định vì đường decode có KV-cache hiện chưa dùng được:
     * <ul>
     *   <li>Mỗi ứng viên beam phải deep-copy toàn bộ KV-cache ({@code clonePastKV}). Với ViT5-base
     *       và beam width thực tế ~6, mỗi bước decode sinh vài chục bản sao đầy đủ — tốn bộ nhớ
     *       nhiều hơn phần tính toán tiết kiệm được.</li>
     *   <li>Cross-attention KV là hằng số theo prompt nên không cần sao chép lại mỗi bước.</li>
     *   <li>{@code decoder_model.onnx} (bản không merged) thường không nhận {@code past_key_values}
     *       ở bước đầu tiên; cần export {@code decoder_model_merged.onnx}.</li>
     * </ul>
     * Bật cờ này chỉ có tác dụng khi decoder thật sự có {@code past_key_values}; nếu không,
     * service sẽ log cảnh báo và dùng đường decode thường.
     */
    private boolean kvCacheEnabled = false;

    /**
     * Ngưỡng validate biến thể paraphrase, so cosine(gốc, biến thể) qua embedding E5. Trước đây
     * hardcode trong {@code ParaphraseValidationService}, đưa ra config để chỉnh được lúc vận
     * hành.
     *
     * <p>Hiệu chỉnh bằng model VietQuill + E5 thật trên mẫu 15 câu seed / 40 biến thể (xem
     * {@code developer_docs/ai/benchmarks/hieu-chinh-nguong-ngu-nghia-paraphrase-vietquill.md}):
     * phân bố paraphrase thật p05=0,950 p25=0,966 TB=0,975, trong khi baseline câu không liên
     * quan TB chỉ 0,828 (max 0,907) — tách biệt rất rõ, cho thấy 0,72/0,85 cũ là số đoán quá lỏng,
     * để lọt biến thể lệch nghĩa. <b>LƯU Ý</b>: mẫu còn nhỏ (15 câu một học phần) — nên chạy lại
     * trên 100+ câu trải nhiều chuyên khoa trước khi tin tưởng tuyệt đối, dù độ tách biệt hiện tại
     * lớn tới mức khó bị đảo ngược bởi cỡ mẫu lớn hơn.</p>
     */
    private double lowSourceSemanticSimilarity = 0.95;
    private double reviewSourceSemanticSimilarity = 0.97;
    private double lowOptionSemanticSimilarity = 0.95;

    public boolean isVietQuillProvider() {
        return "vietquill".equalsIgnoreCase(provider) || "local".equalsIgnoreCase(provider);
    }

    public boolean isMockProvider() {
        return "mock".equalsIgnoreCase(provider);
    }

    public boolean isDisabledProvider() {
        return "disabled".equalsIgnoreCase(provider);
    }
}
