package vn.vietduc.carehubbackend.notification.dto;

import vn.vietduc.carehubbackend.notification.entity.NotificationCadence;
import vn.vietduc.carehubbackend.notification.entity.NotificationConfig;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;

import java.math.BigDecimal;
import java.util.List;

public record NotificationConfigResponse(List<PolicyResponse> policies) {
    public static NotificationConfigResponse from(List<NotificationConfig> policies) {
        return new NotificationConfigResponse(policies.stream().map(PolicyResponse::from).toList());
    }

    public record PolicyResponse(
            NotificationEventType eventType,
            boolean enabled,
            boolean inAppEnabled,
            boolean emailEnabled,
            NotificationCadence cadence,
            BigDecimal thresholdPercent,
            Long version
    ) {
        static PolicyResponse from(NotificationConfig policy) {
            return new PolicyResponse(
                    policy.getEventType(),
                    policy.isEnabled(),
                    policy.isInAppEnabled(),
                    policy.isEmailEnabled(),
                    policy.getCadence(),
                    policy.getThresholdPercent(),
                    policy.getVersion()
            );
        }
    }
}
