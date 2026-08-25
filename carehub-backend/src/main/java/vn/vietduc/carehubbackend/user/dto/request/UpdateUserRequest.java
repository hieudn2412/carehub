package vn.vietduc.carehubbackend.user.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.validation.ValidAge;

import java.time.LocalDate;

@Getter
@Setter
public class UpdateUserRequest {
    private String employeeCode;

    private String fullName;

    @Email(message = "Email is invalid")
    private String email;

    @Pattern(regexp = "^$|^\\+84[0-9]{9}$", message = "Số điện thoại không hợp lệ")
    private String phone;

    private Long departmentId;

    private Long positionId;

    private Long educationLevelId;

    @ValidAge(min = 18, max = 100, message = "Độ tuổi không hợp lệ. Nhân viên phải từ 18 đến 100 tuổi.")
    private LocalDate birthday;

    private Boolean gender;

    private UserStatus status;
}
