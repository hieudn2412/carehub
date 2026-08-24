package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class CompetencyScoringTest {

    private static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }

    @Test
    @DisplayName("Điểm tổng là trung bình hai vế khi có đủ lý thuyết và thực hành")
    void overallScoreAveragesBothSides() {
        assertThat(CompetencyScoring.overallScore(bd("8.00"), bd("6.00")))
                .isEqualByComparingTo("7.00");
    }

    @Test
    @DisplayName("Thiếu một vế thì lấy vế còn lại, không coi vế thiếu là 0 điểm")
    void overallScoreKeepsTheAvailableSide() {
        assertThat(CompetencyScoring.overallScore(bd("8.00"), null)).isEqualByComparingTo("8.00");
        assertThat(CompetencyScoring.overallScore(null, bd("5.50"))).isEqualByComparingTo("5.50");
    }

    @Test
    @DisplayName("Chưa có vế nào thì không có điểm tổng")
    void overallScoreIsNullWithoutData() {
        assertThat(CompetencyScoring.overallScore(null, null)).isNull();
    }

    @Test
    @DisplayName("Đạt khi bằng hoặc vượt điểm sàn, biên tính là đạt")
    void meetsTargetIsInclusiveAtTheBoundary() {
        assertThat(CompetencyScoring.meetsTarget(bd("6.00"), bd("6.00"))).isTrue();
        assertThat(CompetencyScoring.meetsTarget(bd("6.01"), bd("6.00"))).isTrue();
        assertThat(CompetencyScoring.meetsTarget(bd("5.99"), bd("6.00"))).isFalse();
    }

    @Test
    @DisplayName("Thiếu điểm hoặc thiếu điểm sàn thì không kết luận Đạt")
    void meetsTargetNeedsBothValues() {
        assertThat(CompetencyScoring.meetsTarget(null, bd("6.00"))).isFalse();
        assertThat(CompetencyScoring.meetsTarget(bd("9.00"), null)).isFalse();
    }

    @Test
    @DisplayName("Điểm sàn cũ lưu theo thang 0-100 được quy về thang 0-10")
    void normalizeTargetRescalesLegacyHundredScale() {
        assertThat(CompetencyScoring.normalizeTarget(bd("60.00"))).isEqualByComparingTo("6.00");
        assertThat(CompetencyScoring.normalizeTarget(bd("6.00"))).isEqualByComparingTo("6.00");
        assertThat(CompetencyScoring.normalizeTarget(bd("10.00"))).isEqualByComparingTo("10.00");
        assertThat(CompetencyScoring.normalizeTarget(null)).isNull();
    }
}
