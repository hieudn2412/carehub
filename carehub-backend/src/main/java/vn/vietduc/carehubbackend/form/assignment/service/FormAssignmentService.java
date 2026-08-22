package vn.vietduc.carehubbackend.form.assignment.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.*;
import vn.vietduc.carehubbackend.form.assignment.dto.*;
import vn.vietduc.carehubbackend.form.assignment.entity.*;
import vn.vietduc.carehubbackend.form.assignment.repository.*;
import vn.vietduc.carehubbackend.form.compliance.service.FormComplianceTargetService;
import vn.vietduc.carehubbackend.form.entity.Form;
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
    private final FormComplianceTargetService complianceTargetService;
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
            boolean isManager = userRoles.stream().anyMatch(role -> hasAssignableRoleCode(role.getCode(), "MANAGER"));
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
    public FormAssignmentOverviewResponse overview() {
        Instant now = Instant.now(clock);
        var projection = itemRepository.overview(
                FormAssignmentStatus.ACTIVE,
                FormStatus.PUBLISHED,
                FormVersionStatus.PUBLISHED,
                now,
                now.plus(Duration.ofDays(7)));
        if (projection == null) {
            return FormAssignmentOverviewResponse.builder().build();
        }
        return FormAssignmentOverviewResponse.builder()
                .assignedFormCount(projection.getAssignedFormCount())
                .recipientCount(projection.getRecipientCount())
                .activePairCount(projection.getActivePairCount())
                .expiringSoonCount(projection.getExpiringSoonCount())
                .build();
    }

    @Transactional(readOnly = true)
    public Page<FormAssignmentFormRowResponse> assignedFormsDashboard(
            String keyword,
            Long ownerDepartmentId,
            boolean expiringSoon,
            Pageable pageable) {
        Instant now = Instant.now(clock);
        return itemRepository.searchAssignedForms(
                like(keyword),
                ownerDepartmentId,
                expiringSoon,
                FormAssignmentStatus.ACTIVE,
                FormStatus.PUBLISHED,
                FormVersionStatus.PUBLISHED,
                now,
                now.plus(Duration.ofDays(7)),
                normalizeUnsorted(pageable))
                .map(row -> FormAssignmentFormRowResponse.builder()
                        .formId(row.getFormId())
                        .formCode(row.getFormCode())
                        .formTitle(row.getFormTitle())
                        .formVersionId(row.getFormVersionId())
                        .versionNumber(row.getVersionNumber())
                        .ownerDepartmentId(row.getOwnerDepartmentId())
                        .ownerDepartmentName(row.getOwnerDepartmentName())
                        .recipientCount(row.getRecipientCount())
                        .nearestExpiry(row.getNearestExpiry())
                        .build());
    }

    @Transactional(readOnly = true)
    public Page<FormAssignmentAssigneeRowResponse> assignedAssigneesDashboard(
            String keyword,
            Long departmentId,
            String roleCode,
            boolean expiringSoon,
            Pageable pageable) {
        Instant now = Instant.now(clock);
        return itemRepository.searchAssignedAssignees(
                like(keyword),
                departmentId,
                cleanRole(roleCode),
                expiringSoon,
                FormAssignmentStatus.ACTIVE,
                FormStatus.PUBLISHED,
                FormVersionStatus.PUBLISHED,
                now,
                now.plus(Duration.ofDays(7)),
                normalizeUnsorted(pageable))
                .map(row -> FormAssignmentAssigneeRowResponse.builder()
                        .assigneeId(row.getAssigneeId())
                        .employeeCode(row.getEmployeeCode())
                        .fullName(row.getFullName())
                        .departmentId(row.getDepartmentId())
                        .departmentName(row.getDepartmentName())
                        .roleCodes(roleCodes(row.getAssigneeId()))
                        .formCount(row.getFormCount())
                        .nearestExpiry(row.getNearestExpiry())
                        .build());
    }

    @Transactional(readOnly = true)
    public Page<FormAssignmentItemRowResponse> activeItems(Long formId, Long assigneeId, Pageable pageable) {
        if ((formId == null && assigneeId == null) || (formId != null && assigneeId != null)) {
            throw ValidationException.field("scope", "Vui lòng truyền đúng một trong formId hoặc assigneeId");
        }
        return itemRepository.searchActiveItems(
                formId,
                assigneeId,
                FormAssignmentStatus.ACTIVE,
                FormStatus.PUBLISHED,
                FormVersionStatus.PUBLISHED,
                Instant.now(clock),
                normalizeUnsorted(pageable))
                .map(this::toItemRow);
    }

    @Transactional(readOnly = true)
    public Page<FormAssignmentCandidateResponse> formCandidates(String keyword, Long ownerDepartmentId, Pageable pageable) {
        return formRepository.search(
                keyword == null ? "" : keyword.trim(),
                FormStatus.PUBLISHED,
                null,
                ownerDepartmentId,
                normalize(pageable))
                .map(form -> FormAssignmentCandidateResponse.builder()
                        .id(form.getId())
                        .code(form.getCode())
                        .title(form.getTitle())
                        .versionId(form.getCurrentPublishedVersion() == null ? null : form.getCurrentPublishedVersion().getId())
                        .versionNumber(form.getCurrentPublishedVersion() == null ? null : form.getCurrentPublishedVersion().getVersionNumber())
                        .departmentId(form.getOwnerDepartment() == null ? null : form.getOwnerDepartment().getId())
                        .departmentName(form.getOwnerDepartment() == null ? null : form.getOwnerDepartment().getName())
                        .build());
    }

    @Transactional(readOnly = true)
    public Page<FormAssignmentCandidateResponse> assigneeCandidates(
            String keyword,
            Long departmentId,
            String roleCode,
            Pageable pageable) {
        return userRepository.searchFormAssignmentAssigneeCandidates(
                like(keyword),
                departmentId,
                cleanRole(roleCode),
                normalize(pageable))
                .map(user -> FormAssignmentCandidateResponse.builder()
                        .id(user.getId())
                        .employeeCode(user.getEmployeeCode())
                        .fullName(user.getName())
                        .departmentId(user.getDepartment() == null ? null : user.getDepartment().getId())
                        .departmentName(user.getDepartment() == null ? null : user.getDepartment().getName())
                        .roleCodes(roleCodes(user.getId()))
                        .build());
    }

    @Transactional(readOnly = true)
    public BulkFormAssignmentPreviewResponse previewBulk(BulkFormAssignmentRequest request) {
        AssignmentMatrix matrix = buildMatrix(request, false);
        return previewFrom(matrix);
    }

    @Transactional
    public BulkFormAssignmentResponse bulkAssign(BulkFormAssignmentRequest request) {
        AssignmentMatrix matrix = buildMatrix(request, true);
        User assignedBy = activeUser(securityUtils.getCurrentUserId(), "Không tìm thấy tài khoản hiện tại");
        Instant now = Instant.now(clock);
        long created = 0;
        long updated = 0;
        long restored = 0;
        long unchanged = 0;
        Map<Long, List<FormVersion>> newVersionsByAssignee = new LinkedHashMap<>();

        for (PairDecision decision : matrix.decisions()) {
            switch (decision.action()) {
                case NEW -> {
                    created++;
                    newVersionsByAssignee
                            .computeIfAbsent(decision.assignee().getId(), ignored -> new ArrayList<>())
                            .add(decision.version());
                }
                case UPDATED -> {
                    updated++;
                    updateExistingItem(decision.item(), assignedBy, decision.version(), matrix.validUntil(), false, now);
                }
                case RESTORED -> {
                    restored++;
                    updateExistingItem(decision.item(), assignedBy, decision.version(), matrix.validUntil(), true, now);
                }
                case UNCHANGED -> unchanged++;
            }
        }

        Map<Long, User> assigneesById = new HashMap<>();
        matrix.assignees().forEach(user -> assigneesById.put(user.getId(), user));
        newVersionsByAssignee.forEach((assigneeId, versions) -> {
            User assignee = assigneesById.get(assigneeId);
            FormAssignment assignment = FormAssignment.builder()
                    .manager(assignee)
                    .assignedBy(assignedBy)
                    .assignedAt(now)
                    .effectiveFrom(now)
                    .effectiveTo(matrix.validUntil())
                    .status(FormAssignmentStatus.ACTIVE)
                    .build();
            versions.forEach(version -> assignment.getItems().add(FormAssignmentItem.builder()
                    .assignment(assignment)
                    .form(version.getForm())
                    .formVersion(version)
                    .status(FormAssignmentStatus.ACTIVE)
                    .build()));
            assignmentRepository.save(assignment);
            notifyNewAssignments(assignee, versions, now);
        });

        return BulkFormAssignmentResponse.builder()
                .formCount(matrix.forms().size())
                .assigneeCount(matrix.assignees().size())
                .totalPairs(matrix.decisions().size())
                .createdCount(created)
                .updatedCount(updated)
                .restoredCount(restored)
                .unchangedCount(unchanged)
                .build();
    }

    @Transactional
    public int updateItemValidity(BulkFormAssignmentValidityRequest request) {
        Instant now = Instant.now(clock);
        if (request.validUntil() != null && !request.validUntil().isAfter(now)) {
            throw ValidationException.field("validUntil", "Ngày hết hạn phải sau thời điểm hiện tại");
        }
        User assignedBy = activeUser(securityUtils.getCurrentUserId(), "Không tìm thấy tài khoản hiện tại");
        List<FormAssignmentItem> items = loadItemsForMutation(request.assignmentItemIds());
        for (FormAssignmentItem item : items) {
            isolateItemIfNeeded(item, assignedBy, item.getAssignment().getEffectiveFrom(), now);
            item.getAssignment().setEffectiveTo(request.validUntil());
        }
        return items.size();
    }

    @Transactional
    public int revokeItems(BulkFormAssignmentItemIdsRequest request) {
        List<FormAssignmentItem> items = loadItemsForMutation(request.assignmentItemIds());
        for (FormAssignmentItem item : items) {
            item.setStatus(FormAssignmentStatus.REVOKED);
        }
        return items.size();
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

    private AssignmentMatrix buildMatrix(BulkFormAssignmentRequest request, boolean lockForms) {
        validateBulkRequestShape(request);
        Instant now = Instant.now(clock);
        List<Long> formIds = request.formIds().stream().distinct().toList();
        List<Long> assigneeIds = request.assigneeIds().stream().distinct().toList();
        Map<Long, Form> formsById = new LinkedHashMap<>();
        for (Long formId : formIds) {
            Form form = (lockForms ? formRepository.findActiveByIdForUpdate(formId) : formRepository.findByIdAndDeletedFalse(formId))
                    .orElseThrow(() -> ValidationException.field("formIds", "Không tìm thấy bảng kiểm id=" + formId));
            if (form.getStatus() != FormStatus.PUBLISHED || form.getCurrentPublishedVersion() == null
                    || form.getCurrentPublishedVersion().getStatus() != FormVersionStatus.PUBLISHED) {
                throw ValidationException.field("formIds", "Bảng kiểm \"" + form.getTitle() + "\" chưa có phiên bản đang công bố");
            }
            formsById.put(form.getId(), form);
        }

        Map<Long, User> assigneesById = new LinkedHashMap<>();
        for (Long assigneeId : assigneeIds) {
            User assignee = userRepository.findByIdAndIsDeletedFalse(assigneeId)
                    .orElseThrow(() -> ValidationException.field("assigneeIds", "Không tìm thấy người nhận id=" + assigneeId));
            validateAssignee(assignee);
            assigneesById.put(assignee.getId(), assignee);
        }

        List<PairDecision> decisions = new ArrayList<>();
        for (User assignee : assigneesById.values()) {
            Map<Long, FormAssignmentItem> latestByForm = new HashMap<>();
            itemRepository.findHistoryByAssigneeAndForms(assignee.getId(), formIds).forEach(item -> {
                latestByForm.putIfAbsent(item.getForm().getId(), item);
            });
            for (Form form : formsById.values()) {
                FormAssignmentItem latest = latestByForm.get(form.getId());
                FormVersion currentVersion = form.getCurrentPublishedVersion();
                PairAction action = classify(latest, request.validUntil(), now);
                decisions.add(new PairDecision(form, currentVersion, assignee, latest, action));
            }
        }
        return new AssignmentMatrix(List.copyOf(formsById.values()), List.copyOf(assigneesById.values()),
                request.validUntil(), decisions);
    }

    private void validateBulkRequestShape(BulkFormAssignmentRequest request) {
        if (request.validUntil() != null && !request.validUntil().isAfter(Instant.now(clock))) {
            throw ValidationException.field("validUntil", "Ngày hết hạn phải sau thời điểm hiện tại");
        }
        if (request.formIds().stream().distinct().count() != request.formIds().size()) {
            throw ValidationException.field("formIds", "Danh sách bảng kiểm không được trùng lặp");
        }
        if (request.assigneeIds().stream().distinct().count() != request.assigneeIds().size()) {
            throw ValidationException.field("assigneeIds", "Danh sách người nhận không được trùng lặp");
        }
    }

    private void validateAssignee(User assignee) {
        if (assignee.getStatus() != UserStatus.ACTIVE || assignee.isDeleted()) {
            throw ValidationException.field("assigneeIds", "Người nhận \"" + assignee.getName() + "\" không còn hoạt động");
        }
        List<String> roles = roleCodes(assignee.getId());
        if (roles.stream().anyMatch(this::isAdminRoleCode)) {
            throw ValidationException.field("assigneeIds", "Tài khoản ADMIN không thể nhận bảng kiểm");
        }
        boolean eligible = roles.stream().anyMatch(role ->
                hasEmployeeRoleCode(role) || hasAssignableRoleCode(role, "MANAGER"));
        if (!eligible) {
            throw ValidationException.field("assigneeIds", "Người nhận \"" + assignee.getName() + "\" cần có vai trò nhân viên hoặc quản lý");
        }
    }

    private PairAction classify(FormAssignmentItem latest, Instant validUntil, Instant now) {
        if (latest == null) return PairAction.NEW;
        if (!isItemCurrentlyActive(latest, now)) return PairAction.RESTORED;
        Instant currentUntil = latest.getAssignment().getEffectiveTo();
        return Objects.equals(currentUntil, validUntil) ? PairAction.UNCHANGED : PairAction.UPDATED;
    }

    private boolean isItemCurrentlyActive(FormAssignmentItem item, Instant now) {
        FormAssignment assignment = item.getAssignment();
        return item.getStatus() == FormAssignmentStatus.ACTIVE
                && assignment.getStatus() == FormAssignmentStatus.ACTIVE
                && (assignment.getEffectiveFrom() == null || !assignment.getEffectiveFrom().isAfter(now))
                && (assignment.getEffectiveTo() == null || !assignment.getEffectiveTo().isBefore(now));
    }

    private BulkFormAssignmentPreviewResponse previewFrom(AssignmentMatrix matrix) {
        return BulkFormAssignmentPreviewResponse.builder()
                .formCount(matrix.forms().size())
                .assigneeCount(matrix.assignees().size())
                .totalPairs(matrix.decisions().size())
                .newCount(countActions(matrix, PairAction.NEW))
                .updatedCount(countActions(matrix, PairAction.UPDATED))
                .restoredCount(countActions(matrix, PairAction.RESTORED))
                .unchangedCount(countActions(matrix, PairAction.UNCHANGED))
                .pairs(matrix.decisions().stream().map(decision -> BulkFormAssignmentPreviewResponse.PairPreview.builder()
                        .formId(decision.form().getId())
                        .formCode(decision.form().getCode())
                        .formTitle(decision.form().getTitle())
                        .assigneeId(decision.assignee().getId())
                        .assigneeCode(decision.assignee().getEmployeeCode())
                        .assigneeName(decision.assignee().getName())
                        .action(decision.action().name())
                        .build()).toList())
                .build();
    }

    private long countActions(AssignmentMatrix matrix, PairAction action) {
        return matrix.decisions().stream().filter(decision -> decision.action() == action).count();
    }

    private void updateExistingItem(FormAssignmentItem item, User assignedBy, FormVersion currentVersion,
                                    Instant validUntil, boolean restored, Instant now) {
        Instant effectiveFrom = restored ? now : item.getAssignment().getEffectiveFrom();
        isolateItemIfNeeded(item, assignedBy, effectiveFrom, now);
        FormAssignment assignment = item.getAssignment();
        assignment.setAssignedBy(assignedBy);
        if (restored) {
            assignment.setAssignedAt(now);
            assignment.setEffectiveFrom(now);
        }
        assignment.setEffectiveTo(validUntil);
        assignment.setRevokedAt(null);
        assignment.setStatus(FormAssignmentStatus.ACTIVE);
        item.setStatus(FormAssignmentStatus.ACTIVE);
        item.setForm(currentVersion.getForm());
        item.setFormVersion(currentVersion);
    }

    private void isolateItemIfNeeded(FormAssignmentItem item, User assignedBy, Instant effectiveFrom, Instant now) {
        if (itemRepository.countByAssignment_Id(item.getAssignment().getId()) <= 1) {
            return;
        }
        FormAssignment source = item.getAssignment();
        FormAssignment isolated = FormAssignment.builder()
                .manager(source.getManager())
                .assignedBy(assignedBy)
                .assignedAt(source.getAssignedAt() == null ? now : source.getAssignedAt())
                .effectiveFrom(effectiveFrom)
                .effectiveTo(source.getEffectiveTo())
                .status(source.getStatus())
                .revokedAt(source.getRevokedAt())
                .build();
        FormAssignment saved = assignmentRepository.saveAndFlush(isolated);
        item.setAssignment(saved);
        itemRepository.saveAndFlush(item);
    }

    private List<FormAssignmentItem> loadItemsForMutation(List<Long> ids) {
        List<Long> distinct = ids.stream().distinct().toList();
        if (distinct.size() != ids.size()) {
            throw ValidationException.field("assignmentItemIds", "Danh sách quyền không được trùng lặp");
        }
        List<FormAssignmentItem> items = itemRepository.findByIdIn(distinct);
        if (items.size() != distinct.size()) {
            throw ValidationException.field("assignmentItemIds", "Một hoặc nhiều quyền không tồn tại");
        }
        return items;
    }

    private void notifyNewAssignments(User assignee, List<FormVersion> versions, Instant now) {
        List<Role> roles = userRoleRepository.findRolesByUserId(assignee.getId());
        boolean isManager = roles.stream().anyMatch(role -> hasAssignableRoleCode(role.getCode(), "MANAGER"));
        String deepLink = isManager ? "/manager/quality/checklists" : "/staff/checklists";
        String title = versions.size() == 1 ? "Bạn được phân công bảng kiểm mới" : "Bạn được phân công nhiều bảng kiểm mới";
        String content = versions.size() == 1
                ? "Bạn đã được phân công thực hiện bảng kiểm: " + versions.get(0).getTitle()
                : "Bạn đã được phân công thực hiện " + versions.size() + " bảng kiểm mới.";
        notificationService.createInAppNotification(
                assignee.getId(),
                "INFO",
                title,
                content,
                deepLink,
                "form_assignment_bulk:" + assignee.getId() + ":" + now.toEpochMilli()
        );
    }

    private FormAssignmentItemRowResponse toItemRow(FormAssignmentItem item) {
        FormAssignment assignment = item.getAssignment();
        User assignee = assignment.getManager();
        FormVersion displayVersion = currentPublishedVersion(item);
        return FormAssignmentItemRowResponse.builder()
                .assignmentId(assignment.getId())
                .assignmentItemId(item.getId())
                .formId(item.getForm().getId())
                .formCode(item.getForm().getCode())
                .formTitle(item.getForm().getTitle())
                .formVersionId(displayVersion.getId())
                .versionNumber(displayVersion.getVersionNumber())
                .assigneeId(assignee.getId())
                .employeeCode(assignee.getEmployeeCode())
                .fullName(assignee.getName())
                .departmentId(assignee.getDepartment() == null ? null : assignee.getDepartment().getId())
                .departmentName(assignee.getDepartment() == null ? null : assignee.getDepartment().getName())
                .roleCodes(roleCodes(assignee.getId()))
                .assignedAt(assignment.getAssignedAt())
                .validFrom(assignment.getEffectiveFrom())
                .validUntil(assignment.getEffectiveTo())
                .build();
    }

    private List<String> roleCodes(Long userId) {
        return userRoleRepository.findRolesByUserId(userId).stream()
                .map(Role::getCode)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private String cleanRole(String roleCode) {
        if (roleCode == null || roleCode.isBlank() || "all".equalsIgnoreCase(roleCode)) return null;
        String normalized = roleCode.trim().toUpperCase(Locale.ROOT);
        if (normalized.endsWith("USER")) return "USER";
        if (normalized.endsWith("STAFF")) return "STAFF";
        if (normalized.endsWith("MANAGER")) return "MANAGER";
        return null;
    }

    private boolean isAdminRoleCode(String roleCode) {
        return normalizeRoleCode(roleCode).endsWith("ADMIN");
    }

    private boolean hasAssignableRoleCode(String roleCode, String expected) {
        return normalizeRoleCode(roleCode).endsWith(expected);
    }

    private boolean hasEmployeeRoleCode(String roleCode) {
        String normalized = normalizeRoleCode(roleCode);
        return normalized.endsWith("USER") || normalized.endsWith("STAFF");
    }

    private String normalizeRoleCode(String roleCode) {
        return roleCode == null ? "" : roleCode.trim().toUpperCase(Locale.ROOT);
    }

    private String like(String keyword) {
        if (keyword == null || keyword.isBlank()) return null;
        return "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
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
        FormVersion displayVersion = currentPublishedVersion(item);
        Long departmentId = assignment.getManager().getDepartment() == null
                ? null
                : assignment.getManager().getDepartment().getId();
        FormComplianceTargetService.AppliedTarget appliedTarget =
                complianceTargetService.resolveAppliedTarget(item.getForm().getId(), departmentId);
        return AssignedFormResponse.builder().assignmentItemId(item.getId())
                .formId(item.getForm().getId()).formCode(item.getForm().getCode()).title(displayVersion.getTitle())
                .complianceTargetPercent(appliedTarget.targetPercent())
                .complianceTargetSource(appliedTarget.targetSource())
                .validFrom(assignment.getEffectiveFrom()).validUntil(assignment.getEffectiveTo())
                .version(detail ? formMapper.toResponse(displayVersion) : null).build();
    }

    private FormAssignmentResponse toResponse(FormAssignment assignment) {
        return FormAssignmentResponse.builder().id(assignment.getId())
                .manager(user(assignment.getManager())).assignedBy(user(assignment.getAssignedBy()))
                .assignedAt(assignment.getAssignedAt()).validFrom(assignment.getEffectiveFrom())
                .validUntil(assignment.getEffectiveTo()).revokedAt(assignment.getRevokedAt())
                .status(effectiveStatus(assignment)).items(assignment.getItems().stream().map(item ->
                        {
                            FormVersion displayVersion = currentPublishedVersion(item);
                            return FormAssignmentResponse.ItemSummary.builder().assignmentItemId(item.getId())
                                .formId(item.getForm().getId()).formCode(item.getForm().getCode())
                                .title(displayVersion.getTitle()).formVersionId(displayVersion.getId())
                                .versionNumber(displayVersion.getVersionNumber()).status(item.getStatus()).build();
                        }).toList())
                .build();
    }

    private FormManagerAssignmentResponse toFormManagerResponse(FormAssignmentItem item) {
        FormAssignment assignment = item.getAssignment();
        FormVersion displayVersion = currentPublishedVersion(item);
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
                .formVersionId(displayVersion.getId())
                .versionNumber(displayVersion.getVersionNumber())
                .title(displayVersion.getTitle())
                .build();
    }

    private FormVersion currentPublishedVersion(FormAssignmentItem item) {
        return item.getForm().getCurrentPublishedVersion() == null
                ? item.getFormVersion()
                : item.getForm().getCurrentPublishedVersion();
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

    private Pageable normalizeUnsorted(Pageable pageable) {
        if (pageable.getPageSize() < 1 || pageable.getPageSize() > MAX_PAGE_SIZE) {
            throw ValidationException.field("size", "Page size must be between 1 and " + MAX_PAGE_SIZE);
        }
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.unsorted());
    }

    private enum PairAction {
        NEW,
        UPDATED,
        RESTORED,
        UNCHANGED
    }

    private record AssignmentMatrix(
            List<Form> forms,
            List<User> assignees,
            Instant validUntil,
            List<PairDecision> decisions
    ) {
    }

    private record PairDecision(
            Form form,
            FormVersion version,
            User assignee,
            FormAssignmentItem item,
            PairAction action
    ) {
    }
}
