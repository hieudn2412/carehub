package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class VietQuillPromptBuilderTest {
    private final VietQuillPromptBuilder builder = new VietQuillPromptBuilder();

    @Test
    void buildsDiverseButMeaningPreservingControlPrefix() {
        String input = builder.buildControlledInput(
                "Thủ đô của nước Pháp là thành phố nào?",
                "medium"
        );

        assertThat(input).isEqualTo(
                "SEM_90 SYN_75 LEX_50 : Thủ đô của nước Pháp là thành phố nào?"
        );
    }

    @Test
    void mapsLowStrengthToOfficialConservativePreset() {
        assertThat(builder.buildControlledInput("Câu hỏi?", "low"))
                .startsWith("SEM_95 SYN_90 LEX_80 : ");
    }

    @Test
    void mapsHighStrengthToOfficialDiversePreset() {
        assertThat(builder.buildControlledInput("Câu hỏi?", "high"))
                .startsWith("SEM_90 SYN_60 LEX_40 : ");
    }

    @Test
    void neverAddsNaturalLanguageInstructionsThatCanLeakIntoOutput() {
        String input = builder.buildSingleField("Nội dung", "medium", 3, true);

        assertThat(input)
                .doesNotContain("Yêu cầu:")
                .doesNotContain("Biến thể số")
                .doesNotContain("paraphrase:")
                .endsWith(": Nội dung");
    }

    @Test
    void handlesNullTextWithoutThrowing() {
        assertThat(builder.buildSingleField(null))
                .isEqualTo("SEM_90 SYN_75 LEX_50 : ");
    }
}
