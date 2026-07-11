package vn.vietduc.carehubbackend.notification.messaging;

import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;

import java.util.Map;

public record NotificationDispatchEvent(
        NotificationEventType eventType,
        Long userId,
        NotificationAudience audience,
        String severity,
        String title,
        String content,
        String deepLink,
        String dedupKey,
        Map<String, String> variables
) {
}
