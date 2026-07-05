package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import java.util.List;

public record UpdateQuestionSetRequest(
        String code,
        String name,
        String description,
        String category,
        String difficulty,
        String status,
        List<Long> questionIds
) {
}
