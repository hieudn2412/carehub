package vn.vietduc.carehubbackend.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationCategory;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;

@Getter
@Setter
public class EmailTemplateRequest {
    @NotBlank(message = "Code is required")
    @Size(max = 80, message = "Code must be at most 80 characters")
    @Pattern(regexp = "^[A-Z0-9_]+$", message = "Code may contain only A-Z, 0-9 and underscore")
    private String code;

    @NotBlank(message = "Name is required")
    @Size(max = 160, message = "Name must be at most 160 characters")
    private String name;

    @NotNull(message = "Category is required")
    private NotificationCategory category;

    @NotNull(message = "Event type is required")
    private NotificationEventType eventType;

    @NotNull(message = "Audience is required")
    private NotificationAudience audience;

    @NotBlank(message = "Subject is required")
    @Size(max = 200, message = "Subject must be at most 200 characters")
    private String subject;

    @NotBlank(message = "Body is required")
    private String body;

    private boolean active = true;

    private Long version;
}
