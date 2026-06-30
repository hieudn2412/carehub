package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record DocumentQuestionCandidateResponse(
        Long id,
        Long jobId,
        Long documentId,
        Long chunkId,
        String stem,
        String optionA,
        String optionB,
        String optionC,
        String optionD,
        String correctAnswer,
        String explanation,
        String topic,
        String difficulty,
        String sourceExcerpt,
        String knowledgePointKey,
        Double qualityScore,
        String llmValidation,
        String label,
        String labelText,
        String warnings,
        String status,
        String statusText,
        Double duplicateMaxSimilarity,
        Long duplicateQuestionId,
        String duplicateQuestionStemSnapshot,
        String reviewerNotes,
        Long savedQuestionId
) {
}
