package vn.vietduc.carehubbackend.training.dto.response;

import java.util.List;

public record CmeApplicableDepartmentsResponse(
        List<Long> departmentIds,
        Long version
) {
}
