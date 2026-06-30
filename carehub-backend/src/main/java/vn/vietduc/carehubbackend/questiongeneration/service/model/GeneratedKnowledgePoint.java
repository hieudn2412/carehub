package vn.vietduc.carehubbackend.questiongeneration.service.model;

public record GeneratedKnowledgePoint(
        String id,
        String statement,
        String type,
        String importance,
        String sourceExcerpt,
        boolean generationEligible,
        String rawJson
) {
}
