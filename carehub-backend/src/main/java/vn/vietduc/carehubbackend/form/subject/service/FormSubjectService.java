package vn.vietduc.carehubbackend.form.subject.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.form.subject.dto.FormSubjectUserResponse;
import vn.vietduc.carehubbackend.form.assignment.service.FormAssignmentAccessService;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

@Service
@RequiredArgsConstructor
public class FormSubjectService {
    private final UserRepository userRepository;
    private final SecurityUtils securityUtils;
    private final FormAssignmentAccessService assignmentAccessService;

    @Transactional(readOnly = true)
    public FormSubjectUserResponse findByEmployeeCode(Long assignmentItemId, String employeeCode) {
        if (!isAdmin()) {
            if (assignmentItemId == null) throw notFound();
            var item = assignmentAccessService.requireActiveOwnedItem(assignmentItemId, securityUtils.getCurrentUserId());
            if (item.getForm().getSubjectType() != FormSubjectType.USER) throw notFound();
        }
        User target = userRepository.findByEmployeeCodeIgnoreCaseAndIsDeletedFalseAndStatus(
                        employeeCode.trim(), UserStatus.ACTIVE)
                .orElseThrow(this::notFound);
        return FormSubjectUserResponse.builder()
                .employeeCode(target.getEmployeeCode()).fullName(target.getName())
                .position(target.getPosition() == null ? null : target.getPosition().getName())
                .department(target.getDepartment() == null ? null : target.getDepartment().getName()).build();
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
