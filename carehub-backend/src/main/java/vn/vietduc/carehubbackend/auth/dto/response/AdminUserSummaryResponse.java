package vn.vietduc.carehubbackend.auth.dto.response;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import vn.vietduc.carehubbackend.auth.entity.Role;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
public class AdminUserSummaryResponse {
    private Long id;
    private String email;
    private String fullName;
    private Role role;
    private Boolean enabled;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
