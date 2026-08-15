package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.exception.ServiceUnavailableException;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateExamAssignmentRequest;
import vn.vietduc.carehubbackend.questiongeneration.config.EvaluationCutoverProperties;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EvaluationCutoverServiceTest {
    @Test
    void productionDefaultsFailClosedForGenerationUntilCognitiveReview() {
        EvaluationCutoverService service = new EvaluationCutoverService(new EvaluationCutoverProperties());

        assertThrows(ServiceUnavailableException.class, service::requireMultiFieldGeneration);
        assertEquals(false, service.status().get("EVAL_COGNITIVE_VERIFIED"));
        assertEquals(false, service.status().get("EVAL_MULTI_FIELD_GENERATION"));
    }

    @Test
    void allGatesCanBeEnabledAfterPreflight() {
        EvaluationCutoverProperties properties = new EvaluationCutoverProperties();
        properties.setCognitiveVerified(true);
        properties.setMultiFieldGeneration(true);
        properties.setAudienceRulesV1(true);
        EvaluationCutoverService service = new EvaluationCutoverService(properties);

        assertDoesNotThrow(service::requireDirectField);
        assertDoesNotThrow(service::requireMultiFieldBlueprint);
        assertDoesNotThrow(service::requireAudienceRules);
        assertDoesNotThrow(service::requireMultiFieldGeneration);
    }

    @Test
    void productionAudienceGateRejectsLegacyInlineTargets() {
        EvaluationCutoverProperties properties = new EvaluationCutoverProperties();
        EvaluationCutoverService service = new EvaluationCutoverService(properties);
        CreateExamAssignmentRequest inline = new CreateExamAssignmentRequest(
                "Bài kiểm tra", null, 10L, List.of(42L), null, null, null,
                false, null, null, 1, true, true, "SCORE_ONLY", "DRAFT",
                "idem-1", null, null, null
        );

        assertThatThrownBy(() -> service.requireAudienceSelection(inline))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("audienceId");
    }

    @Test
    void productionAudienceGateRejectsMixedAudienceAndInlineTargets() {
        EvaluationCutoverProperties properties = new EvaluationCutoverProperties();
        EvaluationCutoverService service = new EvaluationCutoverService(properties);
        CreateExamAssignmentRequest mixed = new CreateExamAssignmentRequest(
                "Bài kiểm tra", null, 10L, List.of(42L), null, null, null,
                false, null, null, 1, true, true, "SCORE_ONLY", "DRAFT",
                "idem-2", 9L, null, null
        );

        assertThatThrownBy(() -> service.requireAudienceSelection(mixed))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("trộn");
    }

    @Test
    void compatibilityFlagAllowsOldInlineCallersOnlyWhenExplicitlyEnabled() {
        EvaluationCutoverProperties properties = new EvaluationCutoverProperties();
        properties.setLegacyInlineAudienceEnabled(true);
        EvaluationCutoverService service = new EvaluationCutoverService(properties);
        assertDoesNotThrow(() -> service.requireAudienceSelection(null));
    }
}
