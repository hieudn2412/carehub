package vn.vietduc.carehubbackend.training.repository.projection;

import java.math.BigDecimal;

public interface ProfessionalFieldHoursProjection {
    Long getProfessionalFieldId();

    String getProfessionalFieldName();

    BigDecimal getSubmittedHours();
}
