package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record ExamPaperResponse(
        Long id,
        String code,
        String name,
        Long examConfigId,
        String examConfigName,
        Long questionSetId,
        String questionSetName,
        Integer version,
        Long randomSeed,
        String status,
        String statusText,
        Integer totalQuestions,
        Integer poolQuestionCount,
        Integer timeLimitMinutes,
        Integer passingScore,
        String questionSelectionMode,
        DifficultyPercentages difficultyPercentages,
        List<ExamPaperQuestionResponse> questions,
        LocalDateTime publishedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public record DifficultyPercentages(Integer easy, Integer medium, Integer hard) {
    }
}
