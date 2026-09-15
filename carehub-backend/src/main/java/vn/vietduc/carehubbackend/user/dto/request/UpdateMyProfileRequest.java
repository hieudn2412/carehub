package vn.vietduc.carehubbackend.user.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import vn.vietduc.carehubbackend.user.validation.ValidAge;

import java.time.LocalDate;

public record UpdateMyProfileRequest(
        @NotBlank(message = "Họ và tên không được để trống")
        @Size(max = 150, message = "Họ và tên không được vượt quá 150 ký tự")
        String fullName,

        @Email(message = "Email không hợp lệ")
        @Size(max = 255, message = "Email không được vượt quá 255 ký tự")
        String email,

        @Pattern(regexp = "^$|^\\+84[0-9]{9}$", message = "Số điện thoại không hợp lệ")
        String phone,

        @ValidAge(min = 18, max = 100, message = "Độ tuổi không hợp lệ. Nhân viên phải từ 18 đến 100 tuổi.")
        LocalDate birthday,

        Boolean gender
) {
}
