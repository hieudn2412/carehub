package vn.vietduc.carehubbackend.questiongeneration.entity.enums;

/**
 * Mức độ nhận thức mong muốn khi yêu cầu AI sinh câu hỏi từ tài liệu.
 *
 * <p>{@code AUTO} nghĩa là để AI tự chọn mức phù hợp với đoạn tài liệu.</p>
 */
public enum TargetCognitiveLevel {
    AUTO,
    FOUNDATION,
    CLINICAL_APPLICATION,
    CLINICAL_REASONING_ANALYSIS
}
