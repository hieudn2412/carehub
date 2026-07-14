package vn.vietduc.carehubbackend.questiongeneration.service.model;

public record OcrPageResult(
        int pageNumber,
        String text,
        double confidence,
        boolean hasText,
        String errorMessage
) {
    public static OcrPageResult empty(int pageNumber) {
        return new OcrPageResult(pageNumber, "", 0.0, false, null);
    }

    public static OcrPageResult error(int pageNumber, String errorMessage) {
        return new OcrPageResult(pageNumber, null, 0.0, false, errorMessage);
    }
}
