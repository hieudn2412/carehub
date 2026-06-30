package vn.vietduc.carehubbackend.questiongeneration.modelruntime;

public class EmbeddingModelException extends RuntimeException {
    public EmbeddingModelException(String message) {
        super(message);
    }

    public EmbeddingModelException(String message, Throwable cause) {
        super(message, cause);
    }
}
