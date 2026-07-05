package vn.vietduc.carehubbackend.questiongeneration.dto.request;

public record GenerateExamPaperRequest(
        Long examConfigId,
        String namePrefix,
        Integer variantCount,
        Long randomSeed
) {
}
