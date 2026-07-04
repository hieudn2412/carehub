package vn.vietduc.carehubbackend.questiongeneration.dto.request;

public record TestQuestionClassificationRuleRequest(
        String stem,
        String explanation,
        String sourceDocument,
        String sectionTitle,
        String sourceExcerpt
) {
}
