package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record ExamPaperQuestionResponse(
        Long id,
        Long questionId,
        Integer position,
        BigDecimal points,
        String stem,
        String optionA,
        String optionB,
        String optionC,
        String optionD,
        String correctAnswer,
        String explanation,
        String topic,
        String sourceDocument,
        Long categoryId,
        String categoryCode,
        String categoryName,
        Long professionalFieldId,
        String professionalFieldCode,
        String professionalFieldName,
        String cognitiveLevel,
        String cognitiveLabel,
        Long sourceDocumentId,
        String sourceDocumentFilename,
        String sourceDocumentContentHash,
        Long questionFamilyId
) {
}
