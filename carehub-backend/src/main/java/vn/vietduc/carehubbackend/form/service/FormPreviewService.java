package vn.vietduc.carehubbackend.form.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vn.vietduc.carehubbackend.form.dto.response.FormPreviewDetailResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormPreviewSummaryResponse;
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;

public interface FormPreviewService {
    Page<FormPreviewSummaryResponse> search(
            String keyword,
            FormStatus status,
            FormSubjectType subjectType,
            Long ownerDepartmentId,
            Pageable pageable
    );

    FormPreviewDetailResponse get(Long formId, Long versionId);
}
