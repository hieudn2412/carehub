package vn.vietduc.carehubbackend.user.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;
import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

@Target({ FIELD })
@Retention(RUNTIME)
@Constraint(validatedBy = AgeValidator.class)
@Documented
public @interface ValidAge {
    String message() default "Độ tuổi không hợp lệ";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
    int min() default 18;
    int max() default 100;
}