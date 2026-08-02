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
                .contains("AUTO: ưu tiên mức MEDIUM")
                .contains("không đến từ câu chữ mơ hồ");
        assertThat(first.criticPrompt())
                .contains("surfaceCueFree")
                .contains("requiresDomainReasoning");
    }
}
