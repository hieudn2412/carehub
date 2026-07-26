package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GenerationKeyServiceTest {
    private final GenerationKeyService service = new GenerationKeyService();

    @Test
    void categoryChangesGenerationKeySoSameSourceCanBeGeneratedForAnotherCategory() {
        String withoutCategory = service.candidateKey("api", "deepseek-v4-flash", "v2", 1, "hash", "vi", 0);
        String categoryThree = service.candidateKey("api", "deepseek-v4-flash", "v2", 1, "hash", "vi", 3L, 0);
        String categoryFour = service.candidateKey("api", "deepseek-v4-flash", "v2", 1, "hash", "vi", 4L, 0);

        assertThat(categoryThree).isNotEqualTo(withoutCategory);
        assertThat(categoryThree).isNotEqualTo(categoryFour);
    }

    @Test
    void nullCategoryKeepsTheLegacyKeyFormatForExistingJobs() {
        String legacy = service.candidateKey("api", "deepseek-v4-flash", "v2", 1, "hash", "vi", 0);
        String explicitNull = service.candidateKey("api", "deepseek-v4-flash", "v2", 1, "hash", "vi", null, 0);

        assertThat(explicitNull).isEqualTo(legacy);
    }

    /**
     * Bộ tài liệu SOP của bệnh viện thường dùng chung nguyên một đoạn (lời mở đầu an toàn, mục
     * quy định chung). Nếu khoá chỉ dựa vào nội dung chunk thì tài liệu thứ hai bị coi là "đã xử
     * lý rồi" và im lặng không sinh câu hỏi nào cho đoạn đó.
     */
    @Test
    void sameChunkTextInTwoDocumentsMustNotShareAnIdempotencyKey() {
        String documentOne = service.candidateKey(
                "api", "deepseek-v4-flash", "v3", 3, "cùng-một-hash", "vi", null, 100L, 0);
        String documentTwo = service.candidateKey(
                "api", "deepseek-v4-flash", "v3", 3, "cùng-một-hash", "vi", null, 200L, 0);

        assertThat(documentOne).isNotEqualTo(documentTwo);
    }

    @Test
    void nullDocumentKeepsTheLegacyKeyFormat() {
        String legacy = service.candidateKey("api", "deepseek-v4-flash", "v2", 1, "hash", "vi", 3L, 0);
        String explicitNull = service.candidateKey("api", "deepseek-v4-flash", "v2", 1, "hash", "vi", 3L, null, 0);

        assertThat(explicitNull).isEqualTo(legacy);
    }

    @Test
    void documentAndCategoryAreIndependentPartsOfTheKey() {
        String base = service.candidateKey("api", "m", "v3", 3, "hash", "vi", null, null, 0);
        String withCategory = service.candidateKey("api", "m", "v3", 3, "hash", "vi", 7L, null, 0);
        String withDocument = service.candidateKey("api", "m", "v3", 3, "hash", "vi", null, 7L, 0);
        String withBoth = service.candidateKey("api", "m", "v3", 3, "hash", "vi", 7L, 7L, 0);

        assertThat(List.of(base, withCategory, withDocument, withBoth)).doesNotHaveDuplicates();
    }
}
