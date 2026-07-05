package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record ExamConfigResponse(
        Long id,
        String name,
        String description,
        Long questionSetId,
        String questionSetName,
        Integer questionSetQuestionCount,
        Integer totalQuestions,
        Integer timeLimitMinutes,
        Integer passingScore,
        Integer maxRetakes,
        Boolean shuffleQuestions,
        Boolean shuffleOptions,
        String status,
        String statusText,
        List<ExamConfigDistributionResponse> distributions,
        List<String> warnings,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
