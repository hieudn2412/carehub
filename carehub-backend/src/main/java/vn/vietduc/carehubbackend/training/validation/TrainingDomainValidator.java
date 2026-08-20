package vn.vietduc.carehubbackend.training.validation;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordFormRequest;

import java.math.BigDecimal;
import java.time.LocalDate;

@Component
public class TrainingDomainValidator {
    private static final BigDecimal MIN_DIRECT_RECORD_HOURS = BigDecimal.valueOf(0.5);
    private static final BigDecimal MAX_DIRECT_RECORD_HOURS = BigDecimal.valueOf(999);
    public void validateRecordForm(TrainingRecordFormRequest request, boolean legacyImport) {
        LocalDate today = LocalDate.now();
        if (request.startDate() != null && request.startDate().isAfter(today)) {
            throw new BadRequestException("Ngày đào tạo không được vượt quá ngày hôm nay");
        }
        if (request.endDate() != null && request.endDate().isAfter(today)) {
            throw new BadRequestException("Ngày đào tạo không được vượt quá ngày hôm nay");
        }
        if (request.startDate() != null && request.endDate() != null && request.endDate().isBefore(request.startDate())) {
            throw new BadRequestException("End date must be greater than or equal to start date");
        }
        if (!legacyImport && request.declaredHours() != null) {
            if (request.declaredHours().compareTo(MIN_DIRECT_RECORD_HOURS) < 0) {
                throw new BadRequestException("Declared hours must be at least 0.5 for manual records");
            }
            if (request.declaredHours().compareTo(MAX_DIRECT_RECORD_HOURS) > 0) {
                throw new BadRequestException(
                        "Declared hours must not exceed " + MAX_DIRECT_RECORD_HOURS.toPlainString()
                                + " for manual records");
            }
        }
    }

}
