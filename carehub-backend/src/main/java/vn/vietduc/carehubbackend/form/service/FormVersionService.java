package vn.vietduc.carehubbackend.form.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vn.vietduc.carehubbackend.form.dto.request.CreateFormVersionRequest;
import vn.vietduc.carehubbackend.form.dto.response.FormVersionResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormVersionSummaryResponse;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;

public interface FormVersionService {
    Page<FormVersionSummaryResponse> search(Long formId, FormVersionStatus status, Pageable pageable);

    FormVersionResponse get(Long formId, Long versionId);

    FormVersionResponse create(Long formId, CreateFormVersionRequest request);

    FormVersionResponse update(Long formId, Long versionId, CreateFormVersionRequest request);

    FormVersionResponse publish(Long formId, Long versionId);

    void delete(Long formId, Long versionId);
}
