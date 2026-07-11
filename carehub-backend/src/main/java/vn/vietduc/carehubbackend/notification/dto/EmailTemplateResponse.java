package vn.vietduc.carehubbackend.notification.dto;

import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationCategory;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;

import java.time.LocalDateTime;
import java.util.Set;

public record EmailTemplateResponse(
        Long id,
        String code,
        String name,
        NotificationCategory category,
        NotificationEventType eventType,
        NotificationAudience audience,
        String triggerLabel,
        String subject,
        String body,
        boolean active,
        boolean mandatory,
        boolean systemManaged,
        boolean editable,
        boolean deletable,
        Set<String> allowedVariables,
        Long version,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
