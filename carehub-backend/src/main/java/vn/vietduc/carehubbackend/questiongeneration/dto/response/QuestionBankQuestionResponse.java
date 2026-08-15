package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;

public record QuestionBankQuestionResponse(
        Long id,
        String stem,
        String optionA,
        String optionB,
        String optionC,
        String optionD,
        String correctAnswer,
        String explanation,
        String language,
        String sourceDocument,
        String questionType,
        Long parentQuestionId,
        String status,
        String statusText,
        QuestionDuplicateWarningResponse duplicateWarning,
        QuestionImpactWarningResponse impactWarning,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Long categoryId,
        String categoryCode,
        String categoryName,
        Long professionalFieldId,
        String professionalFieldCode,
        String professionalFieldName,
        String cognitiveLevel,
        LocalDateTime cognitiveVerifiedAt,
        String cognitiveVerifiedBy,
        Long sourceDocumentId,
        String sourceDocumentFilename,
        String sourceDocumentContentHash
) {
}
