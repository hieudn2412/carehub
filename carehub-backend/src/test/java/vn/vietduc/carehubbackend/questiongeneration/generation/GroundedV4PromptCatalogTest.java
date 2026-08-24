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
                // AUTO phải leo thang lên mức khó nhất mà chunk chịu được, và phải tôn trọng
                // tỷ lệ ba mức khi admin đặt tỷ lệ lúc tạo phiên.
                .contains("Khi được giao tỷ lệ mục tiêu, bám theo tỷ lệ đó")
                .contains("ưu tiên CLINICAL_REASONING_ANALYSIS")
                .contains("không đến từ câu chữ mơ hồ");
        assertThat(first.criticPrompt())
                .contains("surfaceCueFree")
                .contains("requiresDomainReasoning");
    }
}
