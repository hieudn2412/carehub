package vn.vietduc.carehubbackend.questiongeneration.service.model;

/**
 * Stable taxonomy option exposed to the question-generation model.
 * The model returns the code; the service resolves that code to the real DB row.
 */
public record ProfessionalFieldPromptOption(
        String code,
        String name,
        String description
) {
}
