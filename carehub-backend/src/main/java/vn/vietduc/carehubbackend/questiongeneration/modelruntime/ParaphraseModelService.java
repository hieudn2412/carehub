package vn.vietduc.carehubbackend.questiongeneration.modelruntime;

import java.util.List;

public interface ParaphraseModelService {
    String modelName();

    String provider();

    List<ParaphrasedMcq> paraphrase(ParaphraseModelInput input);
}
