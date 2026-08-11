package vn.vietduc.carehubbackend.training.dto.response;

import java.math.BigDecimal;

public record ProfessionalFieldHoursItemResponse(
        Long professionalFieldId,
        String professionalFieldName,
        BigDecimal submittedHours
) {
}
