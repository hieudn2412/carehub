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

        /**
         * Ngưỡng riêng cho đường lexical fallback (Jaccard trên tập từ đã bỏ dấu — xem
         * {@code DuplicateCheckService.similarity}), dùng khi provider = lexical hoặc E5 lỗi/chưa
         * backfill. KHÔNG dùng chung với {@link #strongMin}/{@link #reviewMin} vì Jaccard và cosine
         * là hai thang điểm khác nhau.
         *
         * <p>Hiệu chỉnh trên 270 câu hỏi seed (36.315 cặp, xem
         * {@code developer_docs/ai/benchmarks/hieu-chinh-nguong-trung-lap-lexical-jaccard.md}):
         * p50 khác bài=0,048, p99 khác bài=0,192 — thang Jaccard nén thấp hơn nhiều so với cosine E5.
         * LƯU Ý: rút ra từ dữ liệu seed một học phần, chạy lại trên ngân hàng thật trước khi tin tưởng
         * hoàn toàn ({@code RUN_LEXICAL_CALIBRATION=true ./mvnw.cmd test -Dtest=LexicalSimilarityCalibrationTest}).</p>
         */
        private double lexicalStrongMin = 0.80;
        private double lexicalReviewMin = 0.50;
    }

    @Getter
    @Setter
    public static class Quality {
        private double rejectMin = 0.55;
    }
}
