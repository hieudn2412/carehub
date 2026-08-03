package vn.vietduc.carehubbackend.form.dto.response;

import java.math.BigDecimal;

public record FormComplianceTargetResponse(
        Long formId,
        String formName,
        BigDecimal configuredTargetPercent,
        BigDecimal effectiveTargetPercent,
        String targetSource
) {
}
