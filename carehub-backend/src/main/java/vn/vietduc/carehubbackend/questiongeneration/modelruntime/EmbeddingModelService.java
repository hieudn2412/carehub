package vn.vietduc.carehubbackend.questiongeneration.modelruntime;

public interface EmbeddingModelService {
    String modelName();

    double[] embedQuery(String text);

    double[] embedPassage(String text);
}
