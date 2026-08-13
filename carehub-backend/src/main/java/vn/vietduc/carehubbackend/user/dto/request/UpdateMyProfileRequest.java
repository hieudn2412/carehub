package vn.vietduc.carehubbackend.user.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record UpdateMyProfileRequest(
        @NotBlank(message = "Họ và tên không được để trống")
        @Size(max = 150, message = "Họ và tên không được vượt quá 150 ký tự")
        String fullName,

        @NotBlank(message = "Email không được để trống")
        @Email(message = "Email không hợp lệ")
        @Size(max = 255, message = "Email không được vượt quá 255 ký tự")
        String email,

        @Pattern(regexp = "^$|^[0-9+().\\s-]{8,20}$", message = "Số điện thoại không hợp lệ")
        String phone,

        @Past(message = "Ngày sinh phải nhỏ hơn ngày hiện tại")
        LocalDate birthday,

        Boolean gender
) {
}
