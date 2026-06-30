package vn.vietduc.carehubbackend.questiongeneration.service.model;

import java.util.List;

public record GeneratedChunkResult(
        String provider,
        String model,
        String promptVersion,
        LlmUsage usage,
        List<GeneratedKnowledgePoint> knowledgePoints,
        List<GeneratedQuestion> questions
) {
}
