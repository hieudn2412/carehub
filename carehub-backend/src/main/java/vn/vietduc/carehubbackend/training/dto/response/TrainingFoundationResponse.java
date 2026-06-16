package vn.vietduc.carehubbackend.training.dto.response;

import java.util.List;

public record TrainingFoundationResponse(
        String module,
        String phase,
        List<String> enabledFoundations,
        List<String> openBusinessDecisions
) {
}
