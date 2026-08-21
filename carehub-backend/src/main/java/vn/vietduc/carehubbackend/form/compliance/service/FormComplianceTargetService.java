package vn.vietduc.carehubbackend.form.compliance.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ForbiddenException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.form.assignment.entity.FormAssignmentStatus;
import vn.vietduc.carehubbackend.form.assignment.repository.FormAssignmentItemRepository;
import vn.vietduc.carehubbackend.form.compliance.dto.ComplianceTargetRequest;
import vn.vietduc.carehubbackend.form.compliance.dto.ComplianceTargetResponse;
import vn.vietduc.carehubbackend.form.compliance.entity.FormComplianceTarget;
import vn.vietduc.carehubbackend.form.compliance.repository.FormComplianceTargetRepository;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.repository.FormRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FormComplianceTargetService {
    private static final BigDecimal DEFAULT_TARGET_PERCENT = new BigDecimal("80.00");

    private final FormComplianceTargetRepository targetRepository;
    private final FormRepository formRepository;
    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;
    private final FormAssignmentItemRepository assignmentItemRepository;
    private final SecurityUtils securityUtils;
    private final Clock clock;

    @Transactional(readOnly = true)
    public ComplianceTargetResponse get(Long formId) {
        requireForm(formId);
        Set<String> roles = roles();
        if (roles.contains("ADMIN")) return response(formId, targetRepository.findAllByForm_IdOrderByDepartment_NameAsc(formId));
        if (!roles.contains("MANAGER")) throw new ForbiddenException("Bạn không có quyền xem cấu hình mục tiêu");
        requireManagerAssignment(formId);
        Long departmentId = currentDepartment().getId();
        List<FormComplianceTarget> visible = targetRepository.findAllByForm_IdOrderByDepartment_NameAsc(formId).stream()
                .filter(item -> item.getDepartment() == null || departmentId.equals(item.getDepartment().getId()))
                .toList();
        return response(formId, visible);
    }

    @Transactional(readOnly = true)
    public AppliedTarget resolveAppliedTarget(Long formId, Long departmentId) {
        if (departmentId != null) {
            var departmentTarget = targetRepository.findByForm_IdAndDepartment_Id(formId, departmentId);
            if (departmentTarget.isPresent()) {
                return new AppliedTarget(departmentTarget.get().getTargetPercent(), "DEPARTMENT");
            }
        }
        return targetRepository.findByForm_IdAndDepartmentIsNull(formId)
                .map(target -> new AppliedTarget(target.getTargetPercent(), "HOSPITAL"))
                .orElseGet(() -> new AppliedTarget(DEFAULT_TARGET_PERCENT, "DEFAULT"));
    }

    @Transactional
    public ComplianceTargetResponse putHospital(Long formId, ComplianceTargetRequest request) {
        if (!roles().contains("ADMIN")) throw new ForbiddenException("Chỉ Admin được cấu hình mục tiêu bệnh viện");
        Form form = requireForm(formId);
        FormComplianceTarget target = targetRepository.findByForm_IdAndDepartmentIsNull(formId)
                .orElseGet(() -> FormComplianceTarget.builder().form(form).targetPercent(request.targetPercent()).build());
        verifyVersion(target, request.lockVersion());
        target.setTargetPercent(request.targetPercent());
        targetRepository.saveAndFlush(target);
        return get(formId);
    }

    @Transactional
    public ComplianceTargetResponse putDepartment(Long formId, Long departmentId, ComplianceTargetRequest request) {
        Form form = requireForm(formId);
        Department department = requireDepartmentAccess(departmentId, formId);
        FormComplianceTarget target = targetRepository.findByForm_IdAndDepartment_Id(formId, departmentId)
                .orElseGet(() -> FormComplianceTarget.builder().form(form).department(department)
                        .targetPercent(request.targetPercent()).build());
        verifyVersion(target, request.lockVersion());
        target.setTargetPercent(request.targetPercent());
        targetRepository.saveAndFlush(target);
        return get(formId);
    }

    @Transactional
    public ComplianceTargetResponse deleteDepartment(Long formId, Long departmentId, Long lockVersion) {
        requireForm(formId);
        requireDepartmentAccess(departmentId, formId);
        targetRepository.findByForm_IdAndDepartment_Id(formId, departmentId).ifPresent(target -> {
            verifyVersion(target, lockVersion);
            targetRepository.delete(target);
            targetRepository.flush();
        });
        return get(formId);
    }

    private Department requireDepartmentAccess(Long departmentId, Long formId) {
        Set<String> roles = roles();
        if (!roles.contains("ADMIN")) {
            throw new ForbiddenException("Chỉ Admin được cấu hình mục tiêu khoa/phòng");
        }
        return departmentRepository.findById(departmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khoa/phòng"));
    }

    private void verifyVersion(FormComplianceTarget target, Long requestedVersion) {
        if (target.getId() != null && (requestedVersion == null || !requestedVersion.equals(target.getLockVersion()))) {
            throw new ConflictException("Cấu hình mục tiêu đã được cập nhật bởi người khác. Vui lòng tải lại.");
        }
    }

    private Form requireForm(Long formId) {
        return formRepository.findByIdAndDeletedFalse(formId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bảng kiểm"));
    }

    private void requireManagerAssignment(Long formId) {
        Form form = requireForm(formId);
        if (form.getCurrentPublishedVersion() == null || !assignmentItemRepository.existsActiveForAssigneeAndVersion(
                securityUtils.getCurrentUserId(), form.getCurrentPublishedVersion().getId(),
                FormAssignmentStatus.ACTIVE, Instant.now(clock))) {
            throw new ForbiddenException("Bảng kiểm chưa được phân công cho Manager");
        }
    }

    private Department currentDepartment() {
        User user = userRepository.findByIdAndIsDeletedFalse(securityUtils.getCurrentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng hiện tại"));
        if (user.getDepartment() == null) throw new ForbiddenException("Tài khoản chưa được gán khoa/phòng");
        return user.getDepartment();
    }

    private ComplianceTargetResponse response(Long formId, List<FormComplianceTarget> targets) {
        ComplianceTargetResponse.Target hospital = targets.stream().filter(item -> item.getDepartment() == null)
                .findFirst().map(this::target).orElse(null);
        List<ComplianceTargetResponse.Target> departments = targets.stream().filter(item -> item.getDepartment() != null)
                .map(this::target).toList();
        return ComplianceTargetResponse.builder().formId(formId).hospitalTarget(hospital)
                .departmentTargets(departments).build();
    }

    private ComplianceTargetResponse.Target target(FormComplianceTarget item) {
        Department department = item.getDepartment();
        return ComplianceTargetResponse.Target.builder().id(item.getId())
                .departmentId(department == null ? null : department.getId())
                .departmentName(department == null ? null : department.getName())
                .targetPercent(item.getTargetPercent()).lockVersion(item.getLockVersion()).build();
    }

    private Set<String> roles() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) throw new ForbiddenException("Thiếu thông tin xác thực");
        return authentication.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .map(value -> value.startsWith("ROLE_") ? value.substring(5) : value)
                .collect(Collectors.toSet());
    }

    public record AppliedTarget(BigDecimal targetPercent, String targetSource) {}
}
