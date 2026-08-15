package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ServiceUnavailableException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateExamAssignmentRequest;
import vn.vietduc.carehubbackend.questiongeneration.config.EvaluationCutoverProperties;

import java.util.Map;

/** Centralized, auditable rollout gates for Phase 8. */
@Service
@RequiredArgsConstructor
public class EvaluationCutoverService {
    private final EvaluationCutoverProperties properties;

    public void requireDirectField() {
        require(properties.isDirectField(), "EVAL_QUESTION_DIRECT_FIELD", "Luồng câu hỏi gắn lĩnh vực trực tiếp chưa được bật");
    }

    public void requireCognitiveVerified() {
        require(properties.isCognitiveVerified(), "EVAL_COGNITIVE_VERIFIED", "Mức độ nhận thức chưa được reviewer xác nhận đầy đủ");
    }

    public void requireAudienceRules() {
        require(properties.isAudienceRulesV1(), "EVAL_AUDIENCE_RULES_V1", "Luồng đối tượng thi chưa được bật sau preflight");
    }

    /**
     * Once audience v1 is enabled, do not allow callers to silently bypass the
     * persisted rule/snapshot by sending the legacy inline target lists. Tests
     * for the old contract may opt in explicitly with the compatibility flag.
     */
    public void requireAudienceSelection(CreateExamAssignmentRequest request) {
        if (properties.isLegacyInlineAudienceEnabled()) return;
        if (request == null || request.audienceId() == null) {
            throw new BadRequestException("Phân công mới bắt buộc chọn audienceId");
        }
        if (hasInlineTargets(request)) {
            throw new BadRequestException("Không được trộn audienceId với danh sách đối tượng inline");
        }
    }

    private boolean hasInlineTargets(CreateExamAssignmentRequest request) {
        return Boolean.TRUE.equals(request.allEmployees())
                || hasValues(request.userIds())
                || hasValues(request.departmentIds())
                || hasValues(request.positionIds())
                || hasValues(request.groupIds());
    }

    private boolean hasValues(java.util.Collection<?> values) {
        return values != null && !values.isEmpty();
    }

    public void requireMultiFieldBlueprint() {
        require(properties.isMultiFieldBlueprint(), "EVAL_MULTI_FIELD_BLUEPRINT", "Cấu hình đề đa lĩnh vực chưa được bật sau preflight");
    }

    public void requireMultiFieldGeneration() {
        require(properties.isMultiFieldGeneration(), "EVAL_MULTI_FIELD_GENERATION", "Sinh đề trực tiếp từ ngân hàng chưa được bật sau shadow run");
        requireCognitiveVerified();
    }

    public void requireFieldResults() {
        require(properties.isFieldResults(), "EVAL_FIELD_RESULTS", "Báo cáo kết quả theo lĩnh vực chưa được bật");
    }

    public Map<String, Boolean> status() {
        return Map.of(
                "EVAL_QUESTION_DIRECT_FIELD", properties.isDirectField(),
                "EVAL_COGNITIVE_VERIFIED", properties.isCognitiveVerified(),
                "EVAL_AUDIENCE_RULES_V1", properties.isAudienceRulesV1(),
                "EVAL_LEGACY_INLINE_AUDIENCE_ENABLED", properties.isLegacyInlineAudienceEnabled(),
                "EVAL_MULTI_FIELD_BLUEPRINT", properties.isMultiFieldBlueprint(),
                "EVAL_MULTI_FIELD_GENERATION", properties.isMultiFieldGeneration(),
                "EVAL_FIELD_RESULTS", properties.isFieldResults()
        );
    }

    private void require(boolean enabled, String flag, String message) {
        if (!enabled) {
            throw new ServiceUnavailableException(message + " (feature flag: " + flag + ")");
        }
    }
}
