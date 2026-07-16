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
import java.util.Set;

@Component
@RequiredArgsConstructor
public class TrainingComplianceCalculator {
    private final TrainingRequirementRepository requirementRepository;
    private final TrainingRecordRepository recordRepository;
    private final CmeScopeService cmeScopeService;

    public PersonalTrainingStatusResponse calculate(User employee, Long professionalFieldId, LocalDate asOf) {
        return calculate(employee, professionalFieldId, asOf, cmeScopeService.getApplicableDepartmentIds());
    }

    public PersonalTrainingStatusResponse calculate(
            User employee,
            Long professionalFieldId,
            LocalDate asOf,
            Set<Long> applicableDepartmentIds
    ) {
        LocalDate windowEnd = asOf == null ? LocalDate.now() : asOf;
        if (!cmeScopeService.isApplicable(employee, applicableDepartmentIds)) {
            return notConfigured(employee, windowEnd, "CME requirements are not configured for this department");
        }
        Optional<TrainingRequirement> requirement = selectRequirement(
                employee,
                professionalFieldId,
                windowEnd,
                applicableDepartmentIds
        );

        if (requirement.isEmpty()) {
            return notConfigured(employee, windowEnd, "Chưa có yêu cầu đào tạo đang hoạt động");
        }

        TrainingRequirement matchedRequirement = requirement.get();
        LocalDate windowStart = windowEnd.minusYears(matchedRequirement.getCycleYears());
        BigDecimal submittedHours = safe(recordRepository.sumApprovedHoursForEmployee(
                employee.getId(),
                windowStart,
                windowEnd
        ));
        BigDecimal requiredHours = safe(matchedRequirement.getRequiredHours());
        BigDecimal remainingHours = requiredHours.subtract(submittedHours).max(BigDecimal.ZERO);
        ComplianceStatus status = resolveStatus(matchedRequirement, submittedHours);
        BigDecimal progressPercentage = progressPercentage(requiredHours, submittedHours);

        return new PersonalTrainingStatusResponse(
                employee.getId(),
                employee.getEmployeeCode(),
                employee.getName(),
                status,
                requiredHours,
                submittedHours,
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

    public ComplianceStatus resolveStatus(TrainingRequirement requirement, BigDecimal submittedHours) {
        if (requirement == null) {
            return ComplianceStatus.NOT_CONFIGURED;
        }
        BigDecimal submitted = safe(submittedHours);
        BigDecimal required = safe(requirement.getRequiredHours());
        if (submitted.compareTo(required) >= 0) {
            return ComplianceStatus.COMPLIANT;
        }
        BigDecimal warningThreshold = requirement.getWarningThresholdHours();
        if (warningThreshold != null && submitted.compareTo(warningThreshold) >= 0) {
            return ComplianceStatus.AT_RISK;
        }
        return ComplianceStatus.NON_COMPLIANT;
    }

    public BigDecimal sumSubmittedHours(List<TrainingRecord> records) {
        if (records == null || records.isEmpty()) {
            return BigDecimal.ZERO;
        }
        return records.stream()
                .filter(record -> record.getWorkflowStatus() == TrainingRecordStatus.SUBMITTED)
                .map(TrainingRecord::getDeclaredHours)
                .map(this::safe)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public Optional<TrainingRequirement> selectRequirement(User employee, Long professionalFieldId, LocalDate asOf) {
        return selectRequirement(employee, professionalFieldId, asOf, cmeScopeService.getApplicableDepartmentIds());
    }

    public Optional<TrainingRequirement> selectRequirement(
            User employee,
            Long professionalFieldId,
            LocalDate asOf,
            Set<Long> applicableDepartmentIds
    ) {
        if (!cmeScopeService.isApplicable(employee, applicableDepartmentIds)) {
            return Optional.empty();
        }
        Long departmentId = employee.getDepartment() == null ? null : employee.getDepartment().getId();
        Long positionId = employee.getPosition() == null ? null : employee.getPosition().getId();
        List<TrainingRequirement> candidates = requirementRepository.findActiveCandidates(
                departmentId,
                positionId,
                professionalFieldId,
                asOf
        );
        return selectRequirementFromCandidates(employee, professionalFieldId, candidates, applicableDepartmentIds);
    }

    public Optional<TrainingRequirement> selectRequirementFromCandidates(
            User employee,
            Long professionalFieldId,
            List<TrainingRequirement> candidates
    ) {
        return selectRequirementFromCandidates(
                employee,
                professionalFieldId,
                candidates,
                cmeScopeService.getApplicableDepartmentIds()
        );
    }

    public Optional<TrainingRequirement> selectRequirementFromCandidates(
            User employee,
            Long professionalFieldId,
            List<TrainingRequirement> candidates,
            Set<Long> applicableDepartmentIds
    ) {
        if (!cmeScopeService.isApplicable(employee, applicableDepartmentIds)) {
            return Optional.empty();
        }
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

    private PersonalTrainingStatusResponse notConfigured(User employee, LocalDate windowEnd, String message) {
        return new PersonalTrainingStatusResponse(
                employee.getId(),
                employee.getEmployeeCode(),
                employee.getName(),
                ComplianceStatus.NOT_CONFIGURED,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                null,
                null,
                windowEnd,
                null,
                null,
                message,
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );
    }

    private BigDecimal progressPercentage(BigDecimal requiredHours, BigDecimal submittedHours) {
        if (requiredHours == null || requiredHours.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.valueOf(100);
        }
        return submittedHours
                .multiply(BigDecimal.valueOf(100))
                .divide(requiredHours, 2, RoundingMode.HALF_UP)
                .min(BigDecimal.valueOf(100));
    }

    private String warningMessage(ComplianceStatus status, BigDecimal remainingHours) {
        return switch (status) {
            case NOT_CONFIGURED -> "Chưa có yêu cầu đào tạo đang hoạt động";
            case COMPLIANT -> "Training requirement is met";
            case AT_RISK, NON_COMPLIANT -> remainingHours.stripTrailingZeros().toPlainString()
                    + " giờ còn thiếu";
        };
    }
}
