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
     * <p><b>Hiệu chỉnh theo phân bố LÁNG GIỀNG GẦN NHẤT, không theo phân bố cặp.</b> Mỗi lần kiểm
     * tra là {@code max} trên toàn bộ câu đã duyệt, nên một câu chỉ cần có MỘT láng giềng vượt
     * ngưỡng là bị gắn cờ. Đo trên 270 câu seed (leave-one-out, xem
     * {@code developer_docs/ai/benchmarks/hieu-chinh-nguong-trung-lap-e5.md}): phân bố nn-max có
     * p05=0,870 p50=0,897 p95=0,938. Ngưỡng cũ 0,88 — chọn từ phân vị của CẶP — gắn cờ 82,6 % số
     * câu; 0,93 đưa tỉ lệ đó về ~10 %.</p>
     *
     * <p>Tỉ lệ gắn cờ TĂNG theo kích thước ngân hàng (ngân hàng càng lớn, láng giềng gần nhất càng
     * gần), nên phải đo lại khi ngân hàng lớn lên đáng kể.</p>
     */
    @Getter
    @Setter
    public static class Duplicate {
        /**
         * Loại thẳng, không ai xem lại. Đặt cao có chủ đích: trên corpus seed, cặp điểm cao nhất
         * (0,973) lại là DƯƠNG TÍNH GIẢ — hai câu khác bài, khác nội dung. Nghĩa là không có ngưỡng
         * nào an toàn tuyệt đối cho việc loại tự động; giữ nó hiếm khi kích hoạt và để cờ
         * {@link #reviewMin} làm chốt chặn chính.
         */
        private double strongMin = 0.97;

        /** Gắn cờ cho người duyệt. 0,93 ≈ p90 của phân bố nn-max trên corpus seed (~10 % số câu). */
        private double reviewMin = 0.93;

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
