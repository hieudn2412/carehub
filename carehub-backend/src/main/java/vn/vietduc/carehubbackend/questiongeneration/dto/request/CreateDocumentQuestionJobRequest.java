package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.GenerationPipelineVersion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.TargetCognitiveLevel;

public record CreateDocumentQuestionJobRequest(
        @Min(1)
        @Max(5)
        Integer questionsPerChunk,
        Long categoryId,
        Long professionalFieldId,
        GenerationPipelineVersion pipelineVersion,
        TargetCognitiveLevel targetCognitiveLevel
) {
    public CreateDocumentQuestionJobRequest(
            Integer questionsPerChunk,
            Long categoryId,
            GenerationPipelineVersion pipelineVersion,
            TargetCognitiveLevel targetCognitiveLevel
    ) {
        this(questionsPerChunk, categoryId, null, pipelineVersion, targetCognitiveLevel);
    }
}
