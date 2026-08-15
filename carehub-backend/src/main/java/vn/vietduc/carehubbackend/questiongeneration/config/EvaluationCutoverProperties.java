package vn.vietduc.carehubbackend.questiongeneration.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Runtime gates for the multi-field evaluation cutover.  Defaults are deliberately
 * conservative for production data: generation stays off until cognitive levels
 * have been verified by a reviewer.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "app.evaluation.cutover")
public class EvaluationCutoverProperties {
    private boolean directField = true;
    private boolean cognitiveVerified = false;
    private boolean audienceRulesV1 = false;
    /** Compatibility escape hatch for old API callers; production keeps it off. */
    private boolean legacyInlineAudienceEnabled = false;
    private boolean multiFieldBlueprint = true;
    private boolean multiFieldGeneration = false;
    private boolean fieldResults = true;
}
