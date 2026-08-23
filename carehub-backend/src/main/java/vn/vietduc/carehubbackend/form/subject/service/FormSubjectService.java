package vn.vietduc.carehubbackend.form.subject.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.ForbiddenException;
import vn.vietduc.carehubbackend.form.subject.dto.FormSubjectUserResponse;
import vn.vietduc.carehubbackend.form.assignment.service.FormAssignmentAccessService;
import vn.vietduc.carehubbackend.form.assignment.entity.FormAssignmentItem;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FormSubjectService {
    private final UserRepository userRepository;
    private final SecurityUtils securityUtils;
    private final FormAssignmentAccessService assignmentAccessService;

    @Transactional(readOnly = true)
    public FormSubjectUserResponse findByEmployeeCode(Long assignmentItemId, String employeeCode) {
        FormAssignmentItem item = requireSearchAccess(assignmentItemId);
        long actorId = securityUtils.getCurrentUserId();
        Collection<Long> allowedDeptIds = determineAllowedDepartmentIds(item, actorId);
        User target = userRepository.findByEmployeeCodeIgnoreCaseAndIsDeletedFalse(employeeCode.trim())
                .filter(user -> user.getStatus() == vn.vietduc.carehubbackend.user.entity.UserStatus.ACTIVE)
                .filter(user -> !user.getId().equals(actorId))
                .filter(user -> allowedDeptIds == null || (user.getDepartment() != null
                        && allowedDeptIds.contains(user.getDepartment().getId())))
                .orElseThrow(this::notFound);
        return FormSubjectUserResponse.builder()
                .userId(target.getId())
                .employeeCode(target.getEmployeeCode()).fullName(target.getName())
                .position(target.getPosition() == null ? null : target.getPosition().getName())
                .department(target.getDepartment() == null ? null : target.getDepartment().getName()).build();
    }

    @Transactional(readOnly = true)
    public Page<FormSubjectUserResponse> search(Long assignmentItemId, String keyword, Pageable pageable) {
        FormAssignmentItem item = requireSearchAccess(assignmentItemId);
        long actorId = securityUtils.getCurrentUserId();
        Collection<Long> allowedDeptIds = determineAllowedDepartmentIds(item, actorId);
        String normalizedKeyword = keyword == null || keyword.isBlank()
                ? null
                : "%" + keyword.trim().toLowerCase() + "%";
        return userRepository.searchActiveFormSubjectsInDepartments(normalizedKeyword, actorId, allowedDeptIds, pageable)
                .map(this::toResponse);
    }

    private Collection<Long> determineAllowedDepartmentIds(FormAssignmentItem item, long actorId) {
        if (isAdmin()) {
            return null;
        }
        if (item != null) {
            Set<Long> assignedDepartmentIds = item.getAllowedDepartments().stream()
                    .map(Department::getId)
                    .collect(Collectors.toSet());
            if (assignedDepartmentIds.isEmpty()) {
                throw new ForbiddenException("Quyền giao bảng kiểm chưa có khoa/phòng được phép chấm");
            }
            return assignedDepartmentIds;
        }

        User actor = userRepository.findByIdAndIsDeletedFalse(actorId)
                .orElseThrow(() -> new ForbiddenException("Không tìm thấy tài khoản người đánh giá hiện tại"));
        if (actor.getDepartment() == null) {
            throw new ForbiddenException("Người đánh giá chưa được gán khoa/phòng");
        }
        Set<Long> allowedDepartmentIds = new HashSet<>();
        allowedDepartmentIds.add(actor.getDepartment().getId());
        return allowedDepartmentIds;
    }

    private FormAssignmentItem requireSearchAccess(Long assignmentItemId) {
        if (isAdmin()) return null;
        if (assignmentItemId == null) throw notFound();
        var item = assignmentAccessService.requireActiveOwnedItem(
                assignmentItemId, securityUtils.getCurrentUserId());
        if (item.getForm().getSubjectType() != FormSubjectType.USER) throw notFound();
        return item;
    }

    private FormSubjectUserResponse toResponse(User target) {
        return FormSubjectUserResponse.builder()
                .userId(target.getId())
                .employeeCode(target.getEmployeeCode())
                .fullName(target.getName())
                .position(target.getPosition() == null ? null : target.getPosition().getName())
                .department(target.getDepartment() == null ? null : target.getDepartment().getName())
                .build();
    }

    private boolean isAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }



    private ResourceNotFoundException notFound() {
        return new ResourceNotFoundException("Form subject user not found");
    }
}
