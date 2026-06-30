package vn.vietduc.carehubbackend.questiongeneration.service.model;

public record GeneratedQuestion(
        String stem,
        String optionA,
        String optionB,
        String optionC,
        String optionD,
        String correctAnswer,
        String explanation,
        String difficulty,
        String topic,
        String sourceExcerpt,
        String knowledgePointId,
        String rawJson,
        String llmValidationJson
) {
}
