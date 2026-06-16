package vn.vietduc.carehubbackend.notification.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NotificationConfigRequest {
    private boolean inAppEnabled;

    private boolean emailEnabled;

    @Min(value = 1, message = "Dedup window must be at least 1 minute")
    @Max(value = 1440, message = "Dedup window must be at most 1440 minutes")
    private int dedupWindowMinutes;

    @NotBlank(message = "Alert schedule is required")
    private String alertSchedule;
}
