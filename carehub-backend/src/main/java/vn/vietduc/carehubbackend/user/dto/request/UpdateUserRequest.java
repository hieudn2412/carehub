package vn.vietduc.carehubbackend.user.dto.request;

import jakarta.validation.constraints.Email;
import lombok.Getter;
import lombok.Setter;
import vn.vietduc.carehubbackend.user.entity.UserStatus;

import java.time.LocalDate;

@Getter
@Setter
public class UpdateUserRequest {
    private String employeeCode;

    private String fullName;

    @Email(message = "Email is invalid")
    private String email;

    private String phone;

    private Long departmentId;

    private Long positionId;

    private Long educationLevelId;

    private LocalDate birthday;

    private Boolean gender;

    private UserStatus status;
}
