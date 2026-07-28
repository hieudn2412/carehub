package vn.vietduc.carehubbackend.questiongeneration.service.model;

public record DuplicateMatchResult(
        SourceType sourceType,
        Long sourceId,
        String stem,
        double similarity,
        boolean strongDuplicate
) {
    public enum SourceType {
        QUESTION_BANK,
        DOCUMENT_CANDIDATE
    }
}
