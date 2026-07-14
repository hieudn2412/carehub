package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record CompetencyLevelCountResponse(
        String level,
        String levelText,
        String levelColor,
        Long count
) {
}
