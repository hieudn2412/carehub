package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;

public record ParaphraseCandidateResponse(
        Long id,
        Long jobId,
        Long sourceQuestionId,
        String stem,
        String optionA,
        String optionB,
        String optionC,
        String optionD,
        String correctAnswer,
        String explanation,
        String topic,
        String difficulty,
        String rawOutput,
        Double semanticSimilarityToSource,
        Double lexicalDifferenceFromSource,
        Double duplicateMaxSimilarity,
        Long duplicateQuestionId,
        String duplicateQuestionStemSnapshot,
        String label,
        String labelText,
        String warnings,
        String status,
        String statusText,
        String reviewerNotes,
        Long savedQuestionId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
