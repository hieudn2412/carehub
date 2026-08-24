package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.NotBlank;

/**
 * Kiểm tra trùng cho nội dung câu hỏi đang soạn, trước khi lưu vào ngân hàng.
 *
 * @param excludeQuestionId bỏ qua chính câu đang sửa khi ở chế độ chỉnh sửa
 */
public record QuestionDuplicateCheckRequest(
        @NotBlank(message = "Nội dung câu hỏi không được để trống")
        String stem,
        Long excludeQuestionId
) {
}
