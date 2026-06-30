package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record ParaphraseJobResponse(
        Long id,
        QuestionBankQuestionResponse sourceQuestion,
        String mode,
        String targetLanguage,
        Integer requestedCount,
        String changeStrength,
        String provider,
        String model,
        String status,
        String statusText,
        String errorMessage,
        List<ParaphraseCandidateResponse> candidates,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
