package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record ExamPaperCoverageCellResponse(
        Long categoryId,
        String categoryCode,
        String categoryName,
        Long professionalFieldId,
        String professionalFieldCode,
        String professionalFieldName,
        String cognitiveLevel,
        String cognitiveLabel,
        Integer requiredCount,
        Integer actualCount,
        Boolean matchesBlueprint
) {
    public ExamPaperCoverageCellResponse(
            Long professionalFieldId,
            String professionalFieldCode,
            String professionalFieldName,
            String cognitiveLevel,
            String cognitiveLabel,
            Integer requiredCount,
            Integer actualCount,
            Boolean matchesBlueprint
    ) {
        this(null, null, null, professionalFieldId, professionalFieldCode, professionalFieldName,
                cognitiveLevel, cognitiveLabel, requiredCount, actualCount, matchesBlueprint);
    }
}
