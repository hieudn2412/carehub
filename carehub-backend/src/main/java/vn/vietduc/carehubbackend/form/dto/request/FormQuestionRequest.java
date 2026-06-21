package vn.vietduc.carehubbackend.form.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import vn.vietduc.carehubbackend.form.entity.enums.FormFieldType;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Builder
public record FormQuestionRequest(
        UUID questionKey,

        @NotBlank(message = "Question code is required")
        @Size(max = 100, message = "Question code must not exceed 100 characters")
        @Pattern(regexp = "[A-Za-z0-9_.-]+", message = "Question code contains unsupported characters")
        String code,

        @Size(max = 100, message = "Metric code must not exceed 100 characters")
        String metricCode,

        @NotBlank(message = "Question title is required")
        @Size(max = 2000, message = "Question title must not exceed 2000 characters")
        String title,

        @Size(max = 4000, message = "Help text must not exceed 4000 characters")
        String helpText,

        @NotNull(message = "Field type is required")
        FormFieldType fieldType,

        Boolean required,
        Boolean readOnly,
        Boolean critical,
        Boolean excludeFromScore,

        @DecimalMin(value = "0.0", inclusive = false, message = "Weight must be greater than 0")
        BigDecimal weight,

        Map<String, Object> validationConfig,
        Map<String, Object> displayConfig,

        @Valid
        List<FormOptionRequest> options
) {
}
