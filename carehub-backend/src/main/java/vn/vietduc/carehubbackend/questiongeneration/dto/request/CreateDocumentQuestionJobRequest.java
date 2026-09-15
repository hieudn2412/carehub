package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.GenerationPipelineVersion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.TargetCognitiveLevel;

public record CreateDocumentQuestionJobRequest(
        @Min(1)
        @Max(3)
        Integer questionsPerChunk,
        Long categoryId,
        Long professionalFieldId,
        GenerationPipelineVersion pipelineVersion,
        TargetCognitiveLevel targetCognitiveLevel,

        @Min(0) @Max(100)
        Integer cognitiveMixFoundation,

        @Min(0) @Max(100)
        Integer cognitiveMixApplication,

        @Min(0) @Max(100)
        Integer cognitiveMixReasoning
) {
    public CreateDocumentQuestionJobRequest(
            Integer questionsPerChunk,
            Long categoryId,
            GenerationPipelineVersion pipelineVersion,
            TargetCognitiveLevel targetCognitiveLevel
    ) {
        this(questionsPerChunk, categoryId, null, pipelineVersion, targetCognitiveLevel, null, null, null);
    }

    /** Có đặt tỷ lệ khi cả ba mức đều được điền. */
    public boolean hasCognitiveMix() {
        return cognitiveMixFoundation != null && cognitiveMixApplication != null && cognitiveMixReasoning != null;
    }
}
