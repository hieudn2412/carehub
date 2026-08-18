package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import java.util.List;

public record AddExamAssignmentTargetsRequest(
        List<Long> userIds
) {
}
