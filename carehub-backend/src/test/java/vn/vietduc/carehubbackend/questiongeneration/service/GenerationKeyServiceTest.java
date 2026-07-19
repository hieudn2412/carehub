package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;

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
}
