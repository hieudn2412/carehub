package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import org.springframework.stereotype.Component;

/**
 * Builds the control prefix expected by the official VietQuill models.
 *
 * <p>VietQuill is not an instruction/chat model. Its input contract is:
 * {@code SEM_x SYN_y LEX_z : text}. Adding natural-language instructions to
 * the input causes prompt leakage and low-quality generations.</p>
 */
@Component
public class VietQuillPromptBuilder {

    public String buildControlledInput(String text, String changeStrength) {
        Controls controls = controlsFor(changeStrength);
        return "SEM_%d SYN_%d LEX_%d : %s".formatted(
                controls.semantic(),
                controls.syntactic(),
                controls.lexical(),
                safe(text)
        );
    }

    public String buildSingleField(String text) {
        return buildControlledInput(text, "medium");
    }

    public String buildSingleField(String text, String changeStrength, int variantIndex, boolean retry) {
        return buildControlledInput(text, changeStrength);
    }

    private Controls controlsFor(String value) {
        return switch (safe(value).toLowerCase()) {
            // Official VietQuill CONSERVATIVE preset.
            case "low", "nhẹ" -> new Controls(95, 90, 80);
            // Official VietQuill DIVERSE preset.
            case "high", "mạnh" -> new Controls(90, 60, 40);
            // Preserve clinical meaning while allowing enough syntactic and
            // lexical movement to avoid near-identical assessment items.
            default -> new Controls(90, 75, 50);
        };
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private record Controls(int semantic, int syntactic, int lexical) {
    }
}
