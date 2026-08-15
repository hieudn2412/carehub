package vn.vietduc.carehubbackend.questiongeneration.service.model;

import java.util.List;

public record ProfessionalFieldClassificationInput(
        String stem,
        String optionA,
        String optionB,
        String optionC,
        String optionD,
        String correctAnswer,
        String explanation,
        String sourceExcerpt,
        String topic,
        List<ProfessionalFieldPromptOption> professionalFields
) {
}
