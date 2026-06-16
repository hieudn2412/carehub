package vn.vietduc.carehubbackend.notification.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class NotificationActionRequest {
    @NotBlank(message = "Action is required")
    private String action;
}
