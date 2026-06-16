package vn.vietduc.carehubbackend.notification.dto;

import lombok.Builder;
import vn.vietduc.carehubbackend.notification.entity.Notification;

import java.time.LocalDateTime;

@Builder
public record NotificationResponse(
        Long id,
        String type,
        String title,
        String content,
        String deepLink,
        boolean read,
        LocalDateTime readAt,
        LocalDateTime createdAt
) {
    public static NotificationResponse from(Notification notification) {
        return NotificationResponse.builder()
                .id(notification.getId())
                .type(notification.getType())
                .title(notification.getTitle())
                .content(notification.getContent())
                .deepLink(notification.getDeepLink())
                .read(notification.isRead())
                .readAt(notification.getReadAt())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}
