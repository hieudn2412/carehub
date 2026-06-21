package vn.vietduc.carehubbackend.training.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vn.vietduc.carehubbackend.training.dto.request.RequirementFormRequest;
import vn.vietduc.carehubbackend.training.dto.request.RequirementSearchRequest;
import vn.vietduc.carehubbackend.training.dto.request.RequirementStatusRequest;
import vn.vietduc.carehubbackend.training.dto.response.RequirementDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.RequirementListResponse;

public interface TrainingRequirementService {
    Page<RequirementListResponse> search(RequirementSearchRequest request, Pageable pageable);

    RequirementDetailResponse getDetail(Long id);

    RequirementDetailResponse create(RequirementFormRequest request);

    RequirementDetailResponse update(Long id, RequirementFormRequest request);

    RequirementDetailResponse updateStatus(Long id, RequirementStatusRequest request);
}
