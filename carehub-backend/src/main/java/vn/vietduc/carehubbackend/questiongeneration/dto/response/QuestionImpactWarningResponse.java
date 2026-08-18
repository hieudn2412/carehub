package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record QuestionImpactWarningResponse(
        long publishedExamPaperCount,
        boolean blocksArchive,
        String warning
) {
}
