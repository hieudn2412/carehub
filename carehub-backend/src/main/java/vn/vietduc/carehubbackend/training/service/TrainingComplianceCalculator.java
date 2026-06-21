package vn.vietduc.carehubbackend.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.training.dto.response.PersonalTrainingStatusResponse;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.entity.TrainingRequirement;
import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRequirementRepository;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class TrainingComplianceCalculator {
    private final TrainingRequirementRepository requirementRepository;
    private final TrainingRecordRepository recordRepository;

    public PersonalTrainingStatusResponse calculate(User employee, Long professionalFieldId, LocalDate asOf) {
        LocalDate windowEnd = asOf == null ? LocalDate.now() : asOf;
        Optional<TrainingRequirement> requirement = selectRequirement(employee, professionalFieldId, windowEnd);

        if (requirement.isEmpty()) {
            return new PersonalTrainingStatusResponse(
                    employee.getId(),
                    employee.getEmployeeCode(),
                    employee.getName(),
                    ComplianceStatus.NOT_CONFIGURED,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    null,
                    null,
                    windowEnd,
                    null,
                    null,
                    "No active training requirement is configured",
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of()
            );
        }

        TrainingRequirement matchedRequirement = requirement.get();
        LocalDate windowStart = windowEnd.minusYears(matchedRequirement.getCycleYears());
        BigDecimal approvedHours = safe(recordRepository.sumApprovedHoursForEmployee(
                employee.getId(),
                windowStart,
                windowEnd
        ));
        BigDecimal requiredHours = safe(matchedRequirement.getRequiredHours());
        BigDecimal remainingHours = requiredHours.subtract(approvedHours).max(BigDecimal.ZERO);
        ComplianceStatus status = resolveStatus(matchedRequirement, approvedHours);
        BigDecimal progressPercentage = progressPercentage(requiredHours, approvedHours);

        return new PersonalTrainingStatusResponse(
                employee.getId(),
                employee.getEmployeeCode(),
                employee.getName(),
                status,
                requiredHours,
                approvedHours,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                remainingHours,
                progressPercentage,
                matchedRequirement.getCycleYears(),
                windowStart,
                windowEnd,
                matchedRequirement.getId(),
                matchedRequirement.getName(),
                warningMessage(status, remainingHours),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );
    }

    public ComplianceStatus resolveStatus(TrainingRequirement requirement, BigDecimal approvedHours) {
        if (requirement == null) {
            return ComplianceStatus.NOT_CONFIGURED;
        }
        BigDecimal approved = safe(approvedHours);
        BigDecimal required = safe(requirement.getRequiredHours());
        if (approved.compareTo(required) >= 0) {
            return ComplianceStatus.COMPLIANT;
        }
        BigDecimal warningThreshold = requirement.getWarningThresholdHours();
        if (warningThreshold != null && approved.compareTo(warningThreshold) >= 0) {
            return ComplianceStatus.AT_RISK;
        }
        return ComplianceStatus.NON_COMPLIANT;
    }

    public BigDecimal sumApprovedHours(List<TrainingRecord> records) {
        if (records == null || records.isEmpty()) {
            return BigDecimal.ZERO;
        }
        return records.stream()
                .filter(record -> record.getWorkflowStatus() == TrainingRecordStatus.APPROVED)
                .map(TrainingRecord::getApprovedHours)
                .map(this::safe)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public Optional<TrainingRequirement> selectRequirement(User employee, Long professionalFieldId, LocalDate asOf) {
        Long departmentId = employee.getDepartment() == null ? null : employee.getDepartment().getId();
        Long positionId = employee.getPosition() == null ? null : employee.getPosition().getId();
        List<TrainingRequirement> candidates = requirementRepository.findActiveCandidates(
                departmentId,
                positionId,
                professionalFieldId,
                asOf
        );
        return selectRequirementFromCandidates(employee, professionalFieldId, candidates);
    }

    public Optional<TrainingRequirement> selectRequirementFromCandidates(
            User employee,
            Long professionalFieldId,
            List<TrainingRequirement> candidates
    ) {
        return candidates.stream()
                .filter(requirement -> matchesEmployee(requirement, employee, professionalFieldId))
                .max(Comparator.comparingInt((TrainingRequirement requirement) -> specificityScore(requirement, professionalFieldId))
                        .thenComparing(TrainingRequirement::getEffectiveFrom));
    }

    private boolean matchesEmployee(TrainingRequirement requirement, User employee, Long professionalFieldId) {
        Long departmentId = employee.getDepartment() == null ? null : employee.getDepartment().getId();
        Long positionId = employee.getPosition() == null ? null : employee.getPosition().getId();
        Long requirementDepartmentId = requirement.getDepartment() == null ? null : requirement.getDepartment().getId();
        Long requirementPositionId = requirement.getJobPosition() == null ? null : requirement.getJobPosition().getId();
        Long requirementProfessionalFieldId = requirement.getProfessionalField() == null
                ? null
                : requirement.getProfessionalField().getId();
        return (requirementDepartmentId == null || requirementDepartmentId.equals(departmentId))
                && (requirementPositionId == null || requirementPositionId.equals(positionId))
                && (requirementProfessionalFieldId == null || requirementProfessionalFieldId.equals(professionalFieldId));
    }

    private int specificityScore(TrainingRequirement requirement, Long professionalFieldId) {
        int score = 0;
        if (requirement.getDepartment() != null) {
            score += 4;
        }
        if (requirement.getJobPosition() != null) {
            score += 2;
        }
        if (professionalFieldId != null && requirement.getProfessionalField() != null) {
            score += 1;
        }
        return score;
    }

    private BigDecimal safe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal progressPercentage(BigDecimal requiredHours, BigDecimal approvedHours) {
        if (requiredHours == null || requiredHours.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.valueOf(100);
        }
        return approvedHours
                .multiply(BigDecimal.valueOf(100))
                .divide(requiredHours, 2, RoundingMode.HALF_UP)
                .min(BigDecimal.valueOf(100));
    }

    private String warningMessage(ComplianceStatus status, BigDecimal remainingHours) {
        return switch (status) {
            case NOT_CONFIGURED -> "No active training requirement is configured";
            case COMPLIANT -> "Training requirement is met";
            case AT_RISK, NON_COMPLIANT -> remainingHours.stripTrailingZeros().toPlainString()
                    + " approved hours remaining";
        };
    }
}
