package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import java.util.List;

public record UpdateQuestionSetRequest(
        String code,
        String name,
        String description,
        String cognitiveLevel,
        String status,
        List<Long> questionIds,
        Long professionalFieldId,
        Long questionSetCategoryId
) {
    public UpdateQuestionSetRequest(
            String code, String name, String description, String cognitiveLevel,
            String status, List<Long> questionIds
    ) {
        this(code, name, description, cognitiveLevel, status, questionIds, null, null);
    }
}
