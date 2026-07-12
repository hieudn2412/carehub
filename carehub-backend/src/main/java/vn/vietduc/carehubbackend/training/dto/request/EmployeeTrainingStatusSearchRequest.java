package vn.vietduc.carehubbackend.training.dto.request;

import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

public record EmployeeTrainingStatusSearchRequest(
        String keyword,
        Long departmentId,
        Long jobPositionId,
        Long professionalFieldId,
        ComplianceStatus complianceStatus,
        BigDecimal submittedHoursMin,
        BigDecimal submittedHoursMax,
        Boolean requirementConfigured,
        LocalDate asOf
) {
}
