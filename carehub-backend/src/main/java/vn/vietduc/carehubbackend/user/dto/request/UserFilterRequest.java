package vn.vietduc.carehubbackend.user.dto.request;

import lombok.Getter;
import lombok.Setter;
import vn.vietduc.carehubbackend.user.entity.UserStatus;

@Getter
@Setter
public class UserFilterRequest {

    private String keyword;      // employeeCode, name

    private UserStatus status;

    private Long departmentId;

    private Long positionId;

    private Long roleId;
}
