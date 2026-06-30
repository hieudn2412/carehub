package vn.vietduc.carehubbackend.questiongeneration.modelruntime;

public class ParaphraseModelException extends RuntimeException {
    public ParaphraseModelException(String message) {
        super(message);
    }

    public ParaphraseModelException(String message, Throwable cause) {
        super(message, cause);
    }
}
