package vn.vietduc.carehubbackend.user.dto.response;

import lombok.Builder;
import vn.vietduc.carehubbackend.user.entity.Position;

import java.time.LocalDateTime;

@Builder
public record PositionResponse(
        Long id,
        String name,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static PositionResponse from(Position position) {
        return PositionResponse.builder()
                .id(position.getId())
                .name(position.getName())
                .createdAt(position.getCreatedAt())
                .updatedAt(position.getUpdatedAt())
                .build();
    }
}
