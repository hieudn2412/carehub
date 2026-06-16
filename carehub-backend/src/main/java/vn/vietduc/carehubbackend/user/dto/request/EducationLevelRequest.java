package vn.vietduc.carehubbackend.user.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EducationLevelRequest {
    @NotBlank(message = "Education code is required")
    private String educationCode;

    @NotBlank(message = "Education level name is required")
    private String name;
}
