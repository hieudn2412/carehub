package vn.vietduc.carehubbackend.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.systemsettings.service.SystemSettingsService;
import vn.vietduc.carehubbackend.training.dto.response.PersonalTrainingStatusResponse;
import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Component
@RequiredArgsConstructor
public class TrainingComplianceCalculator {
    private final TrainingRecordRepository recordRepository;
    private final SystemSettingsService settingsService;

    public PersonalTrainingStatusResponse calculate(User employee, Long ignoredProfessionalFieldId, LocalDate asOf) {
        LocalDate windowEnd = asOf == null ? LocalDate.now() : asOf;
        int cycleYears = settingsService.trainingWindowYears();
        LocalDate windowStart = windowEnd.minusYears(cycleYears);
        BigDecimal submittedHours = safe(recordRepository.sumApprovedHoursForEmployee(
                employee.getId(),
                windowStart,
                windowEnd
        ));
        BigDecimal requiredHours = safe(settingsService.globalTrainingHours());
        BigDecimal remainingHours = requiredHours.subtract(submittedHours).max(BigDecimal.ZERO);
        ComplianceStatus status = resolveStatus(requiredHours, submittedHours);

        return new PersonalTrainingStatusResponse(
                employee.getId(),
                employee.getEmployeeCode(),
                employee.getName(),
                status,
                requiredHours,
                submittedHours,
                remainingHours,
                progressPercentage(requiredHours, submittedHours),
                cycleYears,
                windowStart,
                windowEnd,
                null,
                "Mục tiêu giờ đào tạo toàn viện",
                warningMessage(status, remainingHours),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );
    }

    public ComplianceStatus resolveStatus(BigDecimal requiredHours, BigDecimal submittedHours) {
        return safe(submittedHours).compareTo(safe(requiredHours)) >= 0
                ? ComplianceStatus.COMPLIANT
                : ComplianceStatus.NON_COMPLIANT;
    }

    private BigDecimal safe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal progressPercentage(BigDecimal requiredHours, BigDecimal submittedHours) {
        if (requiredHours.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.valueOf(100);
        }
        return submittedHours
                .multiply(BigDecimal.valueOf(100))
                .divide(requiredHours, 2, RoundingMode.HALF_UP)
                .min(BigDecimal.valueOf(100));
    }

    private String warningMessage(ComplianceStatus status, BigDecimal remainingHours) {
        return status == ComplianceStatus.COMPLIANT
                ? "Đã đạt mục tiêu giờ đào tạo"
                : remainingHours.stripTrailingZeros().toPlainString() + " giờ còn thiếu";
    }
}
