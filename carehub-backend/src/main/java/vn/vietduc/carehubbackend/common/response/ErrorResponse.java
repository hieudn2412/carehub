package vn.vietduc.carehubbackend.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;

@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(
        @JsonProperty("error_code")
        String errorCode,
        String message,
        @JsonProperty("correlation_id")
        String correlationId,
        Object details
) {
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record FieldErrorDetail(
            String field,
            String message
    ) {
    }
}
