package vn.vietduc.carehubbackend.user.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PositionRequest {
    @NotBlank(message = "Position name is required")
    private String name;
}
