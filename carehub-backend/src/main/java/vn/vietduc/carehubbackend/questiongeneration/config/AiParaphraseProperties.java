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

    public boolean isVietQuillProvider() {
        return "vietquill".equalsIgnoreCase(provider) || "local".equalsIgnoreCase(provider);
    }

    public boolean isMockProvider() {
        return "mock".equalsIgnoreCase(provider);
    }
}
