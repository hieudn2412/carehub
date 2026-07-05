package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;

public record QuestionSetSummaryResponse(
        Long id,
        String code,
        String name,
        String description,
        String category,
        String difficulty,
        String status,
        String statusText,
        Integer questionCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
