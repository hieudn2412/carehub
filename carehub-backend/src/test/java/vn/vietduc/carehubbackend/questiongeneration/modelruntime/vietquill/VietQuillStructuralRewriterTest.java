package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class VietQuillStructuralRewriterTest {
    private final VietQuillStructuralRewriter rewriter = new VietQuillStructuralRewriter();

    @Test
    void movesLeadingClinicalContextBehindTheQuestion() {
        assertThat(rewriter.rewrite(
                "Khi xác định người bệnh trước khi tiêm thuốc, điều dưỡng cần làm gì?"
        )).containsExactly(
                "Điều dưỡng cần làm gì khi xác định người bệnh trước khi tiêm thuốc?"
        );
    }

    @Test
    void rewritesPurposeQuestionWithoutChangingItsMeaning() {
        assertThat(rewriter.rewrite(
                "Điều dưỡng cần làm gì để phòng ngừa nhiễm khuẩn?"
        )).containsExactly(
                "Để phòng ngừa nhiễm khuẩn, điều dưỡng cần thực hiện điều gì?"
        );
    }

    @Test
    void rewritesPurposeDefinitionQuestion() {
        assertThat(rewriter.rewrite(
                "Mục đích của việc đối chiếu vòng tay là gì?"
        )).containsExactly(
                "Việc đối chiếu vòng tay nhằm mục đích gì?"
        );
    }

    @Test
    void leavesUnsupportedShapeForTheModelToHandle() {
        assertThat(rewriter.rewrite("Thủ đô của Việt Nam là thành phố nào?")).isEmpty();
    }
}
