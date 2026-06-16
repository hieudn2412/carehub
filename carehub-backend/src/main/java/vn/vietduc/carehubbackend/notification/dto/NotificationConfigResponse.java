package vn.vietduc.carehubbackend.notification.dto;

import lombok.Builder;
import vn.vietduc.carehubbackend.notification.entity.NotificationConfig;

@Builder
public record NotificationConfigResponse(
        Long id,
        boolean inAppEnabled,
        boolean emailEnabled,
        int dedupWindowMinutes,
        String alertSchedule
) {
    public static NotificationConfigResponse from(NotificationConfig config) {
        return NotificationConfigResponse.builder()
                .id(config.getId())
                .inAppEnabled(config.isInAppEnabled())
                .emailEnabled(config.isEmailEnabled())
                .dedupWindowMinutes(config.getDedupWindowMinutes())
                .alertSchedule(config.getAlertSchedule())
                .build();
    }
}
