package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.GenerationPipelineVersion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.TargetDifficulty;

public record CreateDocumentQuestionJobRequest(
        @Min(1)
        @Max(5)
        Integer questionsPerChunk,
        Long categoryId,
        GenerationPipelineVersion pipelineVersion,
        TargetDifficulty targetDifficulty
) {
}
