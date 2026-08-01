package vn.vietduc.carehubbackend.questiongeneration.service.model;

public record GenerationInput(
        Long documentId,
        Long jobId,
        Long chunkId,
        String chunkText,
        String sectionPath,
        int questionsPerChunk,
        String targetLanguage,
        String documentName,
        Integer pageStart,
        Integer pageEnd,
        String categoryName,
        String categoryDescription,
        String targetDifficulty,
        String pipelineVersion
) {
    public GenerationInput(
            Long documentId,
            Long jobId,
            Long chunkId,
            String chunkText,
            String sectionPath,
            int questionsPerChunk,
            String targetLanguage
    ) {
        this(
                documentId,
                jobId,
                chunkId,
                chunkText,
                sectionPath,
                questionsPerChunk,
                targetLanguage,
                null,
                null,
                null,
                null,
                null,
                "AUTO",
                "LEGACY_V3"
        );
    }
}
