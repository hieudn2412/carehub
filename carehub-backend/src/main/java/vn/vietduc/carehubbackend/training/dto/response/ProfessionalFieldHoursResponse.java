package vn.vietduc.carehubbackend.training.dto.response;

import java.util.List;

public record ProfessionalFieldHoursResponse(
        Integer year,
        List<Integer> availableYears,
        List<ProfessionalFieldHoursItemResponse> fields
) {
}
