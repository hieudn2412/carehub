package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record ExamPaperCoverageCellResponse(
        Long professionalFieldId,
        String professionalFieldCode,
        String professionalFieldName,
        String cognitiveLevel,
        String cognitiveLabel,
        Integer requiredCount,
        Integer actualCount,
        Boolean matchesBlueprint
) {
}
