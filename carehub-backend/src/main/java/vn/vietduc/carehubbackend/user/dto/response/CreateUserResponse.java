package vn.vietduc.carehubbackend.user.dto.response;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import vn.vietduc.carehubbackend.user.entity.UserStatus;

@Builder
@Getter
@Setter
public class CreateUserResponse {
    private String email;
    private String employeeCode;
    private String fullName;
    private UserStatus status;
}
