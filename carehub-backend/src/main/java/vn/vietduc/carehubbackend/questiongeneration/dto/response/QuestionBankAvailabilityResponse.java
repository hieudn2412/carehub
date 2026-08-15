package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record QuestionBankAvailabilityResponse(
        Long professionalFieldId,
        String professionalFieldCode,
        String professionalFieldName,
        String cognitiveLevel,
        long questionCount
) {
}
