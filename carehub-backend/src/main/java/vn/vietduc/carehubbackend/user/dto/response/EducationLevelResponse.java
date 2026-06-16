package vn.vietduc.carehubbackend.user.dto.response;

import lombok.Builder;
import vn.vietduc.carehubbackend.user.entity.EducationLevel;

import java.time.LocalDateTime;

@Builder
public record EducationLevelResponse(
        Long id,
        String educationCode,
        String name,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static EducationLevelResponse from(EducationLevel educationLevel) {
        return EducationLevelResponse.builder()
                .id(educationLevel.getId())
                .educationCode(educationLevel.getEducationCode())
                .name(educationLevel.getName())
                .createdAt(educationLevel.getCreatedAt())
                .updatedAt(educationLevel.getUpdatedAt())
                .build();
    }
}
