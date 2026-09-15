package vn.vietduc.carehubbackend.questiongeneration.generation;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GroundedV4PromptCatalogTest {

    @Test
    void compositeHashIsStableAndCoversAllVersionedPrompts() {
        GroundedV4PromptCatalog first = new GroundedV4PromptCatalog();
        GroundedV4PromptCatalog second = new GroundedV4PromptCatalog();

        assertThat(first.manifestHash())
                .hasSize(64)
                .isEqualTo(second.manifestHash());
        assertThat(first.versionWithHash()).startsWith(GroundedV4PromptCatalog.VERSION + ":");
        assertThat(first.knowledgePrompt()).isNotBlank();
        assertThat(first.questionPrompt()).isNotBlank();
        assertThat(first.criticPrompt()).isNotBlank();
        assertThat(first.version()).isEqualTo("grounded-v4.1.0");
        assertThat(first.questionPrompt())
                // Backend quy tỷ lệ thành MỘT mức mục tiêu cho từng chunk rồi giao qua user
                // prompt; AUTO thì tự leo thang lên mức khó nhất mà chunk chịu được.
                .contains("Khi user prompt giao sẵn một mức mục tiêu cho chunk")
                .contains("ưu tiên CLINICAL_REASONING_ANALYSIS")
                .contains("không đến từ câu chữ mơ hồ")
                // Chú thích dễ/trung bình/khó ngay cạnh tên mức cho model dễ hiểu.
                .contains("FOUNDATION (mức dễ)")
                .contains("CLINICAL_APPLICATION (mức trung bình)")
                .contains("CLINICAL_REASONING_ANALYSIS (mức khó)");
        assertThat(first.criticPrompt())
                .contains("surfaceCueFree")
                .contains("requiresDomainReasoning");
    }
}
