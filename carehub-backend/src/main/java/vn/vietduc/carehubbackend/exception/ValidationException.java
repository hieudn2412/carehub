package vn.vietduc.carehubbackend.exception;

import lombok.Getter;
import vn.vietduc.carehubbackend.common.response.ErrorResponse;

import java.util.List;

@Getter
public class ValidationException extends RuntimeException {
    private final List<ErrorResponse.FieldErrorDetail> fieldErrors;

    public ValidationException(String message, List<ErrorResponse.FieldErrorDetail> fieldErrors) {
        super(message);
        this.fieldErrors = fieldErrors;
    }

    public static ValidationException field(String field, String message) {
        return new ValidationException(
                "Validation failed",
                List.of(ErrorResponse.FieldErrorDetail.builder()
                        .field(field)
                        .message(message)
                        .build())
        );
    }
}
