package vn.vietduc.carehubbackend.form.compliance.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.form.compliance.entity.FormComplianceTarget;

import java.util.List;
import java.util.Optional;

public interface FormComplianceTargetRepository extends JpaRepository<FormComplianceTarget, Long> {
    @EntityGraph(attributePaths = {"form", "department"})
    List<FormComplianceTarget> findAllByForm_IdOrderByDepartment_NameAsc(Long formId);

    Optional<FormComplianceTarget> findByForm_IdAndDepartmentIsNull(Long formId);

    Optional<FormComplianceTarget> findByForm_IdAndDepartment_Id(Long formId, Long departmentId);
}
