package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record ExamConfigDistributionResponse(
        Long id,
        Long categoryId,
        String categoryName,
        String difficulty,
        Integer questionCount,
        Boolean required,
        Integer availableQuestionCount,
        Boolean shortage
) {
}
