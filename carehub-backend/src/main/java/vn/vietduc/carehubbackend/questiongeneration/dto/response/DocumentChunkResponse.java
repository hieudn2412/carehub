package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record DocumentChunkResponse(
        Long id,
        Integer chunkIndex,
        String chunkType,
        Integer pageStart,
        Integer pageEnd,
        String sectionTitle,
        String sectionPath,
        Integer tokenCount,
        Integer charCount,
        String qualityFlags,
        String textPreview
) {
}
