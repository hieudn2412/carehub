package vn.vietduc.carehubbackend.form.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vn.vietduc.carehubbackend.form.dto.request.CreateFormRequest;
import vn.vietduc.carehubbackend.form.dto.request.UpdateFormRequest;
import vn.vietduc.carehubbackend.form.dto.response.FormResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormComplianceTargetResponse;
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;

public interface FormService {
    Page<FormResponse> search(
            String keyword,
            FormStatus status,
            FormSubjectType subjectType,
            Long ownerDepartmentId,
            Pageable pageable
    );

    FormResponse get(Long id);

    FormResponse create(CreateFormRequest request);

    FormResponse update(Long id, UpdateFormRequest request);

    FormComplianceTargetResponse updateComplianceTarget(Long id, java.math.BigDecimal targetPercent);

    void delete(Long id);

    FormResponse restore(Long id);
}
