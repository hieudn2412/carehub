package vn.vietduc.carehubbackend.questiongeneration.modelruntime;

import java.util.List;
import java.util.function.Consumer;

public interface EmbeddingModelService {
    String modelName();

    /**
     * Nhúng theo vai "query" của cặp query/passage — dùng cho truy hồi bất đối xứng
     * (câu hỏi ngắn đi tìm đoạn văn dài).
     */
    double[] embedQuery(String text);

    /**
     * Nhúng theo vai "passage" của cặp query/passage — dùng cho truy hồi bất đối xứng.
     */
    double[] embedPassage(String text);

    /**
     * Nhúng cho bài toán ĐỐI XỨNG: so hai đoạn văn cùng loại với nhau
     * (ví dụ so trùng hai câu hỏi, so câu gốc với bản diễn đạt lại).
     *
     * <p>Với họ model E5, cả hai vế của phép so đối xứng phải dùng cùng một tiền tố.
     * Trộn {@code query:} với {@code passage:} sẽ kéo điểm cosine xuống một cách hệ thống
     * vì hai tiền tố đưa vector về hai vùng khác nhau của không gian nhúng.</p>
     */
    double[] embedSymmetric(String text);

    /** Batch cho {@link #embedSymmetric(String)}. */
    default List<double[]> embedSymmetricBatch(List<String> texts) {
        return embedSymmetricBatch(texts, null);
    }

    /** Batch cho {@link #embedSymmetric(String)} kèm progress callback. */
    List<double[]> embedSymmetricBatch(List<String> texts, Consumer<Integer> progressCallback);
}
