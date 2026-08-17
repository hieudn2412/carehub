package vn.vietduc.carehubbackend.training.repository.projection;

import java.math.BigDecimal;
import vn.vietduc.carehubbackend.training.enums.ProfessionalFieldModerationStatus;

public interface ProfessionalFieldHoursProjection {
    Long getProfessionalFieldId();

    String getProfessionalFieldName();

    ProfessionalFieldModerationStatus getProfessionalFieldModerationStatus();

    BigDecimal getSubmittedHours();
}
