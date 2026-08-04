package vn.vietduc.carehubbackend.form.compliance.dto;

import lombok.Builder;

import java.math.BigDecimal;
import java.util.List;

@Builder
public record ComplianceTargetResponse(
        Long formId,
        Target hospitalTarget,
        List<Target> departmentTargets
) {
    @Builder
    public record Target(
            Long id,
            Long departmentId,
            String departmentName,
            BigDecimal targetPercent,
            Long lockVersion
    ) {}
}
