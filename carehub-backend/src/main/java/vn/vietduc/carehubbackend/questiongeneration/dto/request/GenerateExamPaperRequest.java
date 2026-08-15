package vn.vietduc.carehubbackend.questiongeneration.dto.request;

public record GenerateExamPaperRequest(
        Long examConfigId,
        String namePrefix,
        Integer variantCount,
        Long randomSeed,
        String idempotencyKey,
        Boolean zeroOverlap
) {
    public GenerateExamPaperRequest(Long examConfigId, String namePrefix, Integer variantCount, Long randomSeed) {
        this(examConfigId, namePrefix, variantCount, randomSeed, null, false);
    }

    public GenerateExamPaperRequest(
            Long examConfigId,
            String namePrefix,
            Integer variantCount,
            Long randomSeed,
            String idempotencyKey
    ) {
        this(examConfigId, namePrefix, variantCount, randomSeed, idempotencyKey, false);
    }
}
