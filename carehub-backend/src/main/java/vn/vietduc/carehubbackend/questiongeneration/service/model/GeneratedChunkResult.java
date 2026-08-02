package vn.vietduc.carehubbackend.questiongeneration.service.model;

import java.util.List;

public record GeneratedChunkResult(
        String provider,
        String model,
        String promptVersion,
        LlmUsage usage,
        List<GeneratedKnowledgePoint> knowledgePoints,
        List<GeneratedQuestion> questions,
        int criticCallCount,
        int repairCallCount
) {
    public GeneratedChunkResult(
            String provider,
            String model,
            String promptVersion,
            LlmUsage usage,
            List<GeneratedKnowledgePoint> knowledgePoints,
            List<GeneratedQuestion> questions
    ) {
        this(provider, model, promptVersion, usage, knowledgePoints, questions, 0, 0);
    }
}
