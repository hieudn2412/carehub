package vn.vietduc.carehubbackend.common.response;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class ErrorResponse {
    private final String code;
    private final String message;
    private final List<FieldErrorDetail> fieldErrors;
    private final String traceId;

    @Getter
    @Builder
    public static class FieldErrorDetail {
        private final String field;
        private final String message;
    }
}
