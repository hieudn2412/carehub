package vn.vietduc.carehubbackend.questiongeneration.entity.enums;

/**
 * Clinical cognitive level used by the multi-field examination blueprint.
 *
 * <p>Đây là trục phân loại duy nhất của ngân hàng câu hỏi. Khái niệm "độ khó"
 * (easy/medium/hard) đã được gỡ bỏ khỏi toàn bộ luồng backend.</p>
 */
public enum CognitiveLevel {
    FOUNDATION,
    CLINICAL_APPLICATION,
    CLINICAL_REASONING_ANALYSIS
}
