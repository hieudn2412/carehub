package vn.vietduc.carehubbackend.form.assignment.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.*;
import vn.vietduc.carehubbackend.form.assignment.dto.*;
import vn.vietduc.carehubbackend.form.assignment.entity.*;
import vn.vietduc.carehubbackend.form.assignment.repository.*;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.form.mapper.FormMapper;
import vn.vietduc.carehubbackend.form.repository.FormRepository;
import vn.vietduc.carehubbackend.form.repository.FormVersionRepository;
import vn.vietduc.carehubbackend.user.entity.*;
import vn.vietduc.carehubbackend.user.repository.*;
import vn.vietduc.carehubbackend.utils.SecurityUtils;
import vn.vietduc.carehubbackend.notification.service.NotificationService;

import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class FormAssignmentService {
    private static final int MAX_PAGE_SIZE = 100;
    private final FormAssignmentRepository assignmentRepository;
    private final FormAssignmentItemRepository itemRepository;
    private final FormRepository formRepository;
    private final FormVersionRepository versionRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final SecurityUtils securityUtils;
    private final FormAssignmentAccessService accessService;
    private final FormMapper formMapper;
    private final Clock clock;
    private final NotificationService notificationService;

    @Transactional
    public FormAssignmentResponse create(CreateFormAssignmentRequest request) {
        Instant now = Instant.now(clock);
        Instant from = request.validFrom() == null ? now : request.validFrom();
        if (request.validUntil() != null && !request.validUntil().isAfter(from)) {
            throw ValidationException.field("validUntil", "validUntil must be after validFrom");
        }
        List<Long> assigneeIds = request.effectiveAssigneeIds().stream().distinct().toList();
        if (assigneeIds.isEmpty()) {
            throw ValidationException.field("assigneeIds", "Vui lòng chọn ít nhất một người nhận");
        }
        if (assigneeIds.size() != request.effectiveAssigneeIds().size()) {
            throw ValidationException.field("assigneeIds", "Danh sách người nhận không được trùng lặp");
        }
        List<User> assignees = assigneeIds.stream()
                .map(id -> activeUser(id, "Không tìm thấy người nhận đang hoạt động"))
                .toList();

        List<Long> distinctVersionIds = request.formVersionIds().stream().distinct().toList();
        if (distinctVersionIds.size() != request.formVersionIds().size()) {
            throw ValidationException.field("formVersionIds", "Duplicate form version ids are not allowed");
        }
        List<FormVersion> versions = versionRepository.findAllById(distinctVersionIds);
        if (versions.size() != distinctVersionIds.size()) {
            throw ValidationException.field("formVersionIds", "One or more form versions do not exist");
        }
        for (FormVersion version : versions) {
            if (version.getStatus() != FormVersionStatus.PUBLISHED
                    || version.getForm().isDeleted()
                    || version.getForm().getStatus() != FormStatus.PUBLISHED) {
                throw ValidationException.field("formVersionIds", "Only published form versions can be assigned");
            }
        }

        User assignedBy = activeUser(securityUtils.getCurrentUserId(), "Không tìm thấy tài khoản hiện tại");
        FormAssignmentResponse firstResponse = null;
        for (User assignee : assignees) {
            List<FormVersion> newVersions = versions.stream()
                    .filter(version -> !hasOverlappingActiveAssignment(assignee.getId(), version.getId(), from, request.validUntil()))
                    .toList();
            if (newVersions.isEmpty()) {
                if (firstResponse == null) {
                    firstResponse = itemRepository
                            .findFirstByAssignment_Manager_IdAndFormVersion_IdAndStatusOrderByIdDesc(
                                    assignee.getId(), versions.get(0).getId(), FormAssignmentStatus.ACTIVE)
                            .map(item -> toResponse(item.getAssignment())).orElse(null);
                }
                continue;
            }
            FormAssignment assignment = FormAssignment.builder()
                    .manager(assignee).assignedBy(assignedBy).assignedAt(now).effectiveFrom(from)
                    .effectiveTo(request.validUntil()).status(FormAssignmentStatus.ACTIVE).build();
            newVersions.forEach(version -> assignment.getItems().add(FormAssignmentItem.builder()
                    .assignment(assignment).form(version.getForm()).formVersion(version)
                    .status(FormAssignmentStatus.ACTIVE).build()));
            FormAssignment savedAssignment = assignmentRepository.saveAndFlush(assignment);
            FormAssignmentResponse response = toResponse(savedAssignment);
            if (firstResponse == null) firstResponse = response;

            List<Role> userRoles = userRoleRepository.findRolesByUserId(assignee.getId());
            boolean isManager = userRoles.stream().anyMatch(role -> "MANAGER".equalsIgnoreCase(role.getCode()));
            String deepLink = isManager ? "/manager/quality/checklists" : "/staff/checklists";
            for (FormAssignmentItem item : savedAssignment.getItems()) {
                notificationService.createInAppNotification(
                        assignee.getId(),
                        "INFO",
                        "Bạn được phân công bảng kiểm mới",
                        "Bạn đã được phân công thực hiện bảng kiểm: " + item.getFormVersion().getTitle(),
                        deepLink,
                        "form_assignment_item:" + item.getId()
                );
            }
        }
        if (firstResponse == null) throw new ConflictException("Không thể tạo phân công biểu mẫu");
        return firstResponse;
    }

    @Transactional(readOnly = true)
    public Page<FormAssignmentResponse> search(Long managerId, Pageable pageable) {
        return assignmentRepository.search(managerId, normalize(pageable)).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<FormManagerAssignmentResponse> searchByForm(Long formId, FormAssignmentStatus status, Pageable pageable) {
        formRepository.findByIdAndDeletedFalse(formId)
                .orElseThrow(() -> new ResourceNotFoundException("Form not found"));
        return itemRepository.findByFormId(formId, status, normalize(pageable)).map(this::toFormManagerResponse);
    }

    @Transactional(readOnly = true)
    public FormAssignmentResponse get(Long id) {
        return toResponse(assignmentRepository.findDetailById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Form assignment not found")));
    }

    @Transactional
    public void revoke(Long id) {
        FormAssignment assignment = assignmentRepository.findDetailById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Form assignment not found"));
        if (assignment.getStatus() != FormAssignmentStatus.ACTIVE) return;
        assignment.setStatus(FormAssignmentStatus.REVOKED);
        assignment.setRevokedAt(Instant.now(clock));
        assignment.getItems().stream().filter(i -> i.getStatus() == FormAssignmentStatus.ACTIVE)
                .forEach(i -> i.setStatus(FormAssignmentStatus.REVOKED));
    }

    @Transactional
    public void revokeItem(Long id) {
        FormAssignmentItem item = itemRepository.findDetailById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy mục phân công biểu mẫu"));
        if (item.getStatus() == FormAssignmentStatus.ACTIVE) item.setStatus(FormAssignmentStatus.REVOKED);
    }

    @Transactional(readOnly = true)
    public Page<AssignedFormResponse> assignedForms(Pageable pageable) {
        long managerId = securityUtils.getCurrentUserId();
        return itemRepository.findActiveForManager(managerId, FormAssignmentStatus.ACTIVE,
                FormStatus.PUBLISHED, FormVersionStatus.PUBLISHED, Instant.now(clock),
                normalize(pageable)).map(item -> toAssigned(item, false));
    }

    @Transactional(readOnly = true)
    public AssignedFormResponse assignedForm(Long itemId) {
        return toAssigned(accessService.requireActiveOwnedItem(itemId, securityUtils.getCurrentUserId()), true);
    }

    private User activeUser(Long id, String message) {
        return userRepository.findById(id).filter(u -> !u.isDeleted() && u.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException(message));
    }

    private boolean hasOverlappingActiveAssignment(Long managerId, Long versionId, Instant from, Instant until) {
        if (until == null) {
            return itemRepository.existsOpenEndedOverlappingActiveAssignment(
                    managerId, versionId, FormAssignmentStatus.ACTIVE, from);
        }
        return itemRepository.existsBoundedOverlappingActiveAssignment(
                managerId, versionId, FormAssignmentStatus.ACTIVE, from, until);
    }

    private AssignedFormResponse toAssigned(FormAssignmentItem item, boolean detail) {
        FormAssignment assignment = item.getAssignment();
        return AssignedFormResponse.builder().assignmentItemId(item.getId())
                .formId(item.getForm().getId()).formCode(item.getForm().getCode()).title(item.getFormVersion().getTitle())
                .complianceTargetPercent(item.getForm().getComplianceTargetPercent())
                .validFrom(assignment.getEffectiveFrom()).validUntil(assignment.getEffectiveTo())
                .version(detail ? formMapper.toResponse(item.getFormVersion()) : null).build();
    }

    private FormAssignmentResponse toResponse(FormAssignment assignment) {
        return FormAssignmentResponse.builder().id(assignment.getId())
                .manager(user(assignment.getManager())).assignedBy(user(assignment.getAssignedBy()))
                .assignedAt(assignment.getAssignedAt()).validFrom(assignment.getEffectiveFrom())
                .validUntil(assignment.getEffectiveTo()).revokedAt(assignment.getRevokedAt())
                .status(effectiveStatus(assignment)).items(assignment.getItems().stream().map(item ->
                        FormAssignmentResponse.ItemSummary.builder().assignmentItemId(item.getId())
                                .formId(item.getForm().getId()).formCode(item.getForm().getCode())
                                .title(item.getFormVersion().getTitle()).formVersionId(item.getFormVersion().getId())
                                .versionNumber(item.getFormVersion().getVersionNumber()).status(item.getStatus()).build()).toList())
                .build();
    }

    private FormManagerAssignmentResponse toFormManagerResponse(FormAssignmentItem item) {
        FormAssignment assignment = item.getAssignment();
        return FormManagerAssignmentResponse.builder()
                .assignmentId(assignment.getId())
                .assignmentItemId(item.getId())
                .manager(userSummary(assignment.getManager()))
                .assignedBy(userSummary(assignment.getAssignedBy()))
                .assignedAt(assignment.getAssignedAt())
                .validFrom(assignment.getEffectiveFrom())
                .validUntil(assignment.getEffectiveTo())
                .revokedAt(assignment.getRevokedAt())
                .assignmentStatus(assignment.getStatus())
                .effectiveStatus(effectiveStatus(assignment))
                .itemStatus(item.getStatus())
                .formVersionId(item.getFormVersion().getId())
                .versionNumber(item.getFormVersion().getVersionNumber())
                .title(item.getFormVersion().getTitle())
                .build();
    }

    private FormAssignmentStatus effectiveStatus(FormAssignment assignment) {
        return assignment.getStatus() == FormAssignmentStatus.ACTIVE && assignment.getEffectiveTo() != null
                && assignment.getEffectiveTo().isBefore(Instant.now(clock)) ? FormAssignmentStatus.EXPIRED : assignment.getStatus();
    }

    private FormAssignmentResponse.UserSummary user(User user) {
        return new FormAssignmentResponse.UserSummary(user.getId(), user.getEmployeeCode(), user.getName());
    }

    private FormManagerAssignmentResponse.UserSummary userSummary(User user) {
        return new FormManagerAssignmentResponse.UserSummary(user.getId(), user.getEmployeeCode(), user.getName());
    }

    private Pageable normalize(Pageable pageable) {
        if (pageable.getPageSize() < 1 || pageable.getPageSize() > MAX_PAGE_SIZE) {
            throw ValidationException.field("size", "Page size must be between 1 and " + MAX_PAGE_SIZE);
        }
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by("id").descending());
    }
}
