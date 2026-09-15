package vn.vietduc.carehubbackend.questiongeneration.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Quy tắc quy đổi điểm năng lực sang kết luận Đạt/Chưa đạt.
 *
 * <p>Đặt chung ở đây vì cả {@link CompetencyService} (màn hình quản lý) lẫn
 * {@link MyCompetencyService} (màn hình nhân viên) phải cho ra cùng một kết quả
 * trên cùng một nhân viên — trước đây hai bên tự tính nên lệch nhau.
 */
public final class CompetencyScoring {

    private CompetencyScoring() {
    }

    /**
     * Điểm tổng là trung bình của các vế đã có. Thiếu vế nào thì bỏ qua vế đó,
     * không coi vế thiếu là 0 điểm.
     */
    public static BigDecimal overallScore(BigDecimal knowledgeAverage, BigDecimal skillAverage) {
        if (knowledgeAverage == null) {
            return skillAverage;
        }
        if (skillAverage == null) {
            return knowledgeAverage;
        }
        return knowledgeAverage.add(skillAverage)
                .divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
    }

    /** Đạt khi điểm bằng hoặc vượt điểm sàn do admin cấu hình cho toàn viện. */
    public static boolean meetsTarget(BigDecimal score, BigDecimal target) {
        return score != null && target != null && score.compareTo(target) >= 0;
    }

    /** Điểm sàn dùng thang 0–10; chịu được dữ liệu cũ còn lưu theo thang 0–100. */
    public static BigDecimal normalizeTarget(BigDecimal target) {
        if (target != null && target.compareTo(BigDecimal.valueOf(10)) > 0) {
            return target.divide(BigDecimal.valueOf(10), 2, RoundingMode.HALF_UP);
        }
        return target;
    }
}
