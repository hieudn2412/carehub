package vn.vietduc.carehubbackend.questiongeneration.modelruntime;

import java.util.List;
import java.util.function.Consumer;

public interface EmbeddingModelService {
    String modelName();

    /** Single embedding cho real-time dedup check */
    double[] embedQuery(String text);

    /** Single embedding cho backfill từng câu */
    double[] embedPassage(String text);

    /** Batch embedding cho backfill/cache warmup */
    default List<double[]> embedPassageBatch(List<String> texts) {
        return embedPassageBatch(texts, null);
    }

    /** Batch embedding với progress callback */
    List<double[]> embedPassageBatch(List<String> texts, Consumer<Integer> progressCallback);
}
