package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record ExamConfigPreviewResponse(
        Integer totalQuestions,
        Integer distributedQuestions,
        Boolean valid,
        List<String> warnings,
        List<ExamBlueprintFieldPreviewResponse> blueprintFields,
        String poolChecksum,
        Integer blueprintVersion
) {
}
