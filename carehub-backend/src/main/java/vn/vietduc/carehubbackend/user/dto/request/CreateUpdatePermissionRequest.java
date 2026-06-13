package vn.vietduc.carehubbackend.user.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateUpdatePermissionRequest {
    @NotBlank(message = "Code is required")
    private String code;

    @NotBlank(message = "Permission name is required")
    private String name;
}
