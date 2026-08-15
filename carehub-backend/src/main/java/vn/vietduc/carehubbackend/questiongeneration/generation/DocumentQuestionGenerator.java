package vn.vietduc.carehubbackend.questiongeneration.generation;

import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedChunkResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedTaxonomyClassification;
import vn.vietduc.carehubbackend.questiongeneration.service.model.ProfessionalFieldClassificationInput;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GenerationInput;

public interface DocumentQuestionGenerator {
    String provider();

    GeneratedChunkResult generate(GenerationInput input);

    /**
     * Reclassifies an existing candidate without regenerating its question content.
     * Providers that do not support an external classifier can use the safe default.
     */
    default GeneratedTaxonomyClassification classifyTaxonomy(ProfessionalFieldClassificationInput input) {
        throw new UnsupportedOperationException("Provider chưa hỗ trợ phân loại taxonomy");
    }
}
