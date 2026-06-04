package vn.vietduc.carehubbackend.auth.dto.response;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import vn.vietduc.carehubbackend.auth.entity.Role;

@Getter
@Setter
@Builder
public class UserProfileResponse {
    private Long id;
    private String email;
    private String fullName;
    private Role role;
}
