package vn.vietduc.carehubbackend.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EmailTemplateRequest {
    @NotBlank(message = "Code is required")
    @Size(max = 80, message = "Code must be at most 80 characters")
    private String code;

    @NotBlank(message = "Subject is required")
    @Size(max = 200, message = "Subject must be at most 200 characters")
    private String subject;

    @NotBlank(message = "Body is required")
    private String body;

    private boolean mandatory;

    private boolean active = true;
}
