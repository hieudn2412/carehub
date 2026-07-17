package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record CreateDocumentQuestionJobRequest(
        @Min(1)
        @Max(5)
        Integer questionsPerChunk,
        Long categoryId
) {
}
