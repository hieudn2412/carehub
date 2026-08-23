package vn.vietduc.carehubbackend.form.submission.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.exception.ForbiddenException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.form.assignment.repository.FormAssignmentItemRepository;
import vn.vietduc.carehubbackend.form.assignment.entity.FormAssignmentStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmission;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionStatus;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class FormHistoryAccessPolicy {
    private final SecurityUtils securityUtils;
    private final UserRepository userRepository;
    private final FormAssignmentItemRepository assignmentItemRepository;
    private final Clock clock;

    public Scope requireHistoryScope() {
        Set<String> roles = roles();
        Long actorId = securityUtils.getCurrentUserId();
        if (roles.contains("ADMIN")) {
            return new Scope(true, actorId, null);
        }
        if (!roles.contains("MANAGER")) {
            throw new ForbiddenException("Bạn không có quyền xem lịch sử đánh giá tổng hợp");
        }
        User actor = userRepository.findByIdAndIsDeletedFalse(actorId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng hiện tại"));
        if (actor.getDepartment() == null) {
            throw new ForbiddenException("Manager chưa được gán khoa/phòng");
        }
        return new Scope(false, actorId, actor.getDepartment().getId());
    }

    public void requireFormAccess(Long formId) {
        Scope scope = requireHistoryScope();
        if (!scope.admin() && !assignmentItemRepository.existsEverAssignedToManager(scope.actorId(), formId)) {
            throw new ResourceNotFoundException("Không tìm thấy bảng kiểm trong lịch sử được phân quyền");
        }
    }

    public Long resolveDepartmentScope(Long requestedDepartmentId) {
        Scope scope = requireHistoryScope();
        return scope.admin() ? requestedDepartmentId : scope.departmentId();
    }

    public DepartmentScope resolveDepartmentScope(Long formId, Long requestedDepartmentId) {
        Scope scope = requireAnyHistoryScope();
        if (scope.admin()) {
            return new DepartmentScope(requestedDepartmentId, false, List.of(-1L));
        }
        List<Long> allowedDepartmentIds = assignmentItemRepository.findActiveAllowedDepartmentIds(
                scope.actorId(),
                formId,
                FormAssignmentStatus.ACTIVE,
                FormStatus.PUBLISHED,
                FormVersionStatus.PUBLISHED,
                Instant.now(clock));
        if (allowedDepartmentIds.isEmpty()) {
            throw new ResourceNotFoundException("Không tìm thấy bảng kiểm trong lịch sử được phân quyền");
        }
        if (requestedDepartmentId != null) {
            if (allowedDepartmentIds.contains(requestedDepartmentId)) {
                return new DepartmentScope(requestedDepartmentId, true, List.of(requestedDepartmentId));
            }
            if (scope.departmentId() != null && allowedDepartmentIds.contains(scope.departmentId())) {
                return new DepartmentScope(scope.departmentId(), true, List.of(scope.departmentId()));
            }
            return new DepartmentScope(null, true, allowedDepartmentIds);
        }
        return new DepartmentScope(null, true, allowedDepartmentIds);
    }

    public boolean isAdmin() {
        return roles().contains("ADMIN");
    }

    public boolean isManager() {
        Set<String> currentRoles = roles();
        return !currentRoles.contains("ADMIN") && currentRoles.contains("MANAGER");
    }

    public boolean isRestrictedUser() {
        return !roles().contains("ADMIN");
    }

    public boolean managerCanRead(FormSubmission submission) {
        if (isAdmin() || submission.getStatus() != FormSubmissionStatus.SUBMITTED) return false;
        Scope scope = requireAnyHistoryScope();
        if (submission.getSubjectContext() == null
                || submission.getSubjectContext().getSubjectUser() == null
                || submission.getSubjectContext().getSubjectUser().getDepartment() == null) {
            return false;
        }
        Long formId = submission.getFormVersion().getForm().getId();
        Long departmentId = submission.getSubjectContext().getSubjectUser().getDepartment().getId();
        return assignmentItemRepository.findActiveAllowedDepartmentIds(
                scope.actorId(),
                formId,
                FormAssignmentStatus.ACTIVE,
                FormStatus.PUBLISHED,
                FormVersionStatus.PUBLISHED,
                Instant.now(clock)).contains(departmentId);
    }

    private Scope requireAnyHistoryScope() {
        Set<String> roles = roles();
        Long actorId = securityUtils.getCurrentUserId();
        if (roles.contains("ADMIN")) {
            return new Scope(true, actorId, null);
        }
        if (!roles.contains("MANAGER") && !roles.contains("USER") && !roles.contains("STAFF")) {
            throw new ForbiddenException("Bạn không có quyền xem lịch sử đánh giá tổng hợp");
        }
        User actor = userRepository.findByIdAndIsDeletedFalse(actorId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng hiện tại"));
        return new Scope(false, actorId, actor.getDepartment() == null ? null : actor.getDepartment().getId());
    }

    private Set<String> roles() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ForbiddenException("Thiếu thông tin xác thực");
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .map(value -> value.startsWith("ROLE_") ? value.substring(5) : value)
                .collect(Collectors.toSet());
    }

    public record Scope(boolean admin, Long actorId, Long departmentId) {}

    public record DepartmentScope(Long requestedDepartmentId, boolean filterDepartmentIds, List<Long> departmentIds) {}
}
