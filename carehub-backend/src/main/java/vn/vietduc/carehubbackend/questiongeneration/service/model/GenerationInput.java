package vn.vietduc.carehubbackend.questiongeneration.service.model;

import java.util.List;

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
        String targetCognitiveLevel,
        String pipelineVersion,
        List<ProfessionalFieldPromptOption> professionalFields
) {
    public GenerationInput(
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
            String targetCognitiveLevel,
            String pipelineVersion
    ) {
        this(
                documentId,
                jobId,
                chunkId,
                chunkText,
                sectionPath,
                questionsPerChunk,
                targetLanguage,
                documentName,
                pageStart,
                pageEnd,
                categoryName,
                categoryDescription,
                targetCognitiveLevel,
                pipelineVersion,
                List.of()
        );
    }

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
                "LEGACY_V3",
                List.of()
        );
    }
}
