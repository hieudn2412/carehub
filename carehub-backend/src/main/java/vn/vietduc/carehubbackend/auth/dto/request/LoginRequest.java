package vn.vietduc.carehubbackend.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginRequest {
    @NotBlank(message = "Employee Code is required")
    private String employeeCode;

    @NotBlank(message = "Password is required")
    private String password;
}
