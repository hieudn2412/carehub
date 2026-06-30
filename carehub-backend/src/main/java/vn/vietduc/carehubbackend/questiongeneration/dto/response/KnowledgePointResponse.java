package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record KnowledgePointResponse(
        Long id,
        Long chunkId,
        String sourceKey,
        String statement,
        String knowledgeType,
        String importance,
        String sourceExcerpt,
        Boolean generationEligible
) {
}
