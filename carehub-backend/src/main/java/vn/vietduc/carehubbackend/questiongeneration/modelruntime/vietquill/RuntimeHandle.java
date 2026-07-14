package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import java.util.Objects;

/**
 * Cặp question + sentence handles cho VietQuill model.
 * Nếu question và sentence dùng chung 1 model directory thì question == sentence.
 */
record RuntimeHandle(
        Seq2SeqHandle question,
        Seq2SeqHandle sentence
) implements AutoCloseable {
    RuntimeHandle {
        Objects.requireNonNull(question);
        Objects.requireNonNull(sentence);
    }

    @Override
    public void close() {
        question.close();
        if (sentence != question) {
            sentence.close();
        }
    }
}
