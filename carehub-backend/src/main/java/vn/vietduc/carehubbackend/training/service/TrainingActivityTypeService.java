package vn.vietduc.carehubbackend.training.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vn.vietduc.carehubbackend.training.dto.request.ActivityTypeFormRequest;
import vn.vietduc.carehubbackend.training.dto.request.ActivityTypeStatusRequest;
import vn.vietduc.carehubbackend.training.dto.response.ActivityTypeDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.ActivityTypeListResponse;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;

public interface TrainingActivityTypeService {
    Page<ActivityTypeListResponse> search(
            String keyword,
            Boolean active,
            Boolean requiresEvidence,
            DurationUnit durationUnit,
            Pageable pageable
    );

    ActivityTypeDetailResponse getDetail(Long id);

    ActivityTypeDetailResponse create(ActivityTypeFormRequest request);

    ActivityTypeDetailResponse update(Long id, ActivityTypeFormRequest request);

    ActivityTypeDetailResponse updateStatus(Long id, ActivityTypeStatusRequest request);
}
