package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record QuestionClassificationTestResponse(
        Long ruleId,
        String ruleName,
        Long categoryId,
        String categoryName,
        double confidence,
        String reason
) {
}
