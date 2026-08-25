package vn.vietduc.carehubbackend.user.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class CreateUserRequest {
    @NotBlank(message = "Employee code is required")
    private String employeeCode;

    @NotNull(message = "Department id is required")
    private Long departmentId;

    @NotBlank(message = "Email is required")
    @Email(message = "Email is invalid")
    private String email;

    @NotEmpty(message = "At least one role is required")
    private List<Long> roleIds;

    @NotBlank(message = "FullName is required")
    private String fullName;

    @Pattern(regexp = "^$|^\\+84[0-9]{9}$", message = "Số điện thoại không hợp lệ")
    private String phone;
}
