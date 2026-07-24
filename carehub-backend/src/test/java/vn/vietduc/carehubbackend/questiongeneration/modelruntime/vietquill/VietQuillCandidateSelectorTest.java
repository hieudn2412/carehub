package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class VietQuillCandidateSelectorTest {
    private final VietQuillCandidateSelector selector = new VietQuillCandidateSelector();
    private final String source =
            "Khi xác định người bệnh trước khi tiêm thuốc, điều dưỡng cần làm gì?";

    @Test
    void removesIdentityAndCandidatesThatOnlyAddOneWord() {
        List<String> selected = selector.select(source, List.of(
                source,
                "Khi xác định được người bệnh trước khi tiêm thuốc, điều dưỡng cần làm gì?",
                "Khi xác định bệnh nhân trước khi tiêm thuốc, điều dưỡng cần làm gì?",
                "Điều dưỡng cần thực hiện bước nào để xác định đúng người bệnh trước lúc tiêm thuốc?"
        ), "medium", 3);

        assertThat(selected).containsExactly(
                "Điều dưỡng cần thực hiện bước nào để xác định đúng người bệnh trước lúc tiêm thuốc?"
        );
    }

    @Test
    void rejectsCandidateThatDropsImportantPatientIdentificationMeaning() {
        List<String> selected = selector.select(source, List.of(
                "Trước khi tiêm thuốc, điều dưỡng cần làm gì?",
                "Trước lúc tiêm thuốc, điều dưỡng phải kiểm tra danh tính người bệnh bằng cách nào?"
        ), "medium", 3);

        assertThat(selected).containsExactly(
                "Trước lúc tiêm thuốc, điều dưỡng phải kiểm tra danh tính người bệnh bằng cách nào?"
        );
    }

    @Test
    void keepsMateriallyDifferentCandidatesAndRemovesNearDuplicates() {
        List<String> selected = selector.select(source, List.of(
                "Điều dưỡng cần thực hiện bước nào để xác định đúng người bệnh trước lúc tiêm thuốc?",
                "Điều dưỡng phải thực hiện bước nào để xác định đúng người bệnh trước lúc tiêm thuốc?",
                "Trước lúc dùng thuốc tiêm, danh tính người bệnh cần được điều dưỡng xác minh ra sao?"
        ), "medium", 3);

        assertThat(selected).hasSize(2);
        assertThat(selected).doesNotHaveDuplicates();
        assertThat(selected).allSatisfy(candidate ->
                assertThat(selector.changeRatio(source, candidate)).isGreaterThanOrEqualTo(0.22)
        );
    }
}
