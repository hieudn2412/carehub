package vn.vietduc.carehubbackend.questiongeneration.service.model;

public record GenerationInput(
        Long documentId,
        Long jobId,
        Long chunkId,
        String chunkText,
        String sectionPath,
        int questionsPerChunk,
        String targetLanguage
) {
}
