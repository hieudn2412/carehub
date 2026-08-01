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
        String llmValidationJson,
        String questionType,
        String answerEvidence,
        String distractorRationales
) {
    public GeneratedQuestion(
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
        this(
                stem,
                optionA,
                optionB,
                optionC,
                optionD,
                correctAnswer,
                explanation,
                difficulty,
                topic,
                sourceExcerpt,
                knowledgePointId,
                rawJson,
                llmValidationJson,
                null,
                null,
                null
        );
    }
}
