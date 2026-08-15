package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

/** Checkpoint state used to resume the exam creation wizard safely. */
public record ExamConfigWorkflowStateResponse(
        ExamConfigResponse config,
        List<ExamPaperResponse> papers,
        long publishedPaperCount,
        long assignmentCount,
        String nextStep
) {
}
