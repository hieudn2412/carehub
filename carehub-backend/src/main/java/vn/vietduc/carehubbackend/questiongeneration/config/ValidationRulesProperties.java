package vn.vietduc.carehubbackend.questiongeneration.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "validation")
public class ValidationRulesProperties {
    private Duplicate duplicate = new Duplicate();
    private Quality quality = new Quality();

    /**
     * Ngưỡng cosine chống trùng. Giữ khớp với {@code application.yaml} — lệch nhau thì code dựng
     * properties trực tiếp (test, tiện ích) sẽ chạy trên thang khác với lúc chạy thật.
     *
     * <p>Hiệu chỉnh trên 270 câu hỏi seed (36.315 cặp): p50=0,832 p99=0,889 max=0,973.
     * Ngưỡng cũ 0,80 nằm dưới trung vị nên gắn cờ 94,7 % số cặp.</p>
     */
    @Getter
    @Setter
    public static class Duplicate {
        private double strongMin = 0.95;
        private double reviewMin = 0.88;
    }

    @Getter
    @Setter
    public static class Quality {
        private double rejectMin = 0.55;
    }
}
