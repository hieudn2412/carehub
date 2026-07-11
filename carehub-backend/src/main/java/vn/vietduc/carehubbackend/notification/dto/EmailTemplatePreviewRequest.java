package vn.vietduc.carehubbackend.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;

import java.util.Map;

public record EmailTemplatePreviewRequest(
        @NotNull NotificationEventType eventType,
        @NotNull NotificationAudience audience,
        @NotBlank String subject,
        @NotBlank String body,
        Map<String, String> variables
) {
}
