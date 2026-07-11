package vn.vietduc.carehubbackend.notification.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import vn.vietduc.carehubbackend.notification.entity.NotificationCadence;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
public class NotificationConfigRequest {
    @Valid
    @NotEmpty(message = "At least one notification policy is required")
    private List<PolicyRequest> policies;

    @Getter
    @Setter
    public static class PolicyRequest {
        @NotNull(message = "Event type is required")
        private NotificationEventType eventType;

        private boolean enabled;

        private boolean inAppEnabled = true;

        private boolean emailEnabled = true;

        @NotNull(message = "Cadence is required")
        private NotificationCadence cadence;

        @DecimalMin(value = "0", message = "Threshold must be at least 0")
        @DecimalMax(value = "100", message = "Threshold must be at most 100")
        private BigDecimal thresholdPercent;

        private Long version;
    }
}
