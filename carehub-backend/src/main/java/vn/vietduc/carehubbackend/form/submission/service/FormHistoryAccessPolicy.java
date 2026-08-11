package vn.vietduc.carehubbackend.form.submission.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.exception.ForbiddenException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.form.assignment.repository.FormAssignmentItemRepository;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmission;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionStatus;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class FormHistoryAccessPolicy {
    private final SecurityUtils securityUtils;
    private final UserRepository userRepository;
    private final FormAssignmentItemRepository assignmentItemRepository;

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

    public boolean isAdmin() {
        return roles().contains("ADMIN");
    }

    public boolean isManager() {
        Set<String> currentRoles = roles();
        return !currentRoles.contains("ADMIN") && currentRoles.contains("MANAGER");
    }

    public boolean managerCanRead(FormSubmission submission) {
        if (!isManager() || submission.getStatus() != FormSubmissionStatus.SUBMITTED) return false;
        Scope scope = requireHistoryScope();
        if (!assignmentItemRepository.existsEverAssignedToManager(
                scope.actorId(), submission.getFormVersion().getForm().getId())) {
            return false;
        }
        return submission.getSubjectContext() != null
                && submission.getSubjectContext().getSubjectUser() != null
                && submission.getSubjectContext().getSubjectUser().getDepartment() != null
                && scope.departmentId().equals(
                        submission.getSubjectContext().getSubjectUser().getDepartment().getId());
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
}
