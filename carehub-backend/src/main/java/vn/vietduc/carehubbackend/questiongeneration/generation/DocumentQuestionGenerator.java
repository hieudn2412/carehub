package vn.vietduc.carehubbackend.questiongeneration.generation;

import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedChunkResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GenerationInput;

public interface DocumentQuestionGenerator {
    String provider();

    GeneratedChunkResult generate(GenerationInput input);
}
