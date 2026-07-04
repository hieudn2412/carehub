package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;

public record QuestionSetVersionSummaryResponse(
        Long id,
        Integer version,
        Integer questionCount,
        LocalDateTime snapshotAt,
        String activatedBy
) {
}
