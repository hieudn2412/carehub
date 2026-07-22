package vn.vietduc.carehubbackend.training.service.impl;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ForbiddenException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordFormRequest;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordSearchRequest;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordSubmitRequest;
import vn.vietduc.carehubbackend.training.dto.response.TrainingActivityTypeOptionResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingProfessionalFieldOptionResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordListResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordOptionsResponse;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordChangeType;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingSourceType;
import vn.vietduc.carehubbackend.training.mapper.TrainingRecordMapper;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingEvidenceFileRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordChangeLogRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.service.TrainingAccessPolicy;
import vn.vietduc.carehubbackend.training.service.TrainingAuditService;
import vn.vietduc.carehubbackend.training.service.TrainingRecordService;
import vn.vietduc.carehubbackend.training.service.TrainingRecordStateMachine;
import vn.vietduc.carehubbackend.training.validation.TrainingDomainValidator;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserRole;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.repository.UserRoleRepository;
import vn.vietduc.carehubbackend.notification.service.NotificationService;

import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TrainingRecordServiceImpl implements TrainingRecordService {
    private static final Logger log = LoggerFactory.getLogger(TrainingRecordServiceImpl.class);

    private final TrainingRecordRepository recordRepository;
    private final TrainingActivityTypeRepository activityTypeRepository;
    private final ProfessionalFieldRepository professionalFieldRepository;
    private final TrainingEvidenceFileRepository evidenceFileRepository;
    private final TrainingRecordChangeLogRepository changeLogRepository;
    private final UserRepository userRepository;
    private final TrainingRecordMapper mapper;
    private final TrainingAccessPolicy accessPolicy;
    private final TrainingRecordStateMachine stateMachine;
    private final TrainingDomainValidator validator;
    private final TrainingAuditService auditService;
    private final NotificationService notificationService;
    private final UserRoleRepository userRoleRepository;

    @Value("${app.training.records.max-edit-count:2}")
    private int maxEditCount;

    @Override
    @Transactional(readOnly = true)
    public Page<TrainingRecordListResponse> search(TrainingRecordSearchRequest request, Pageable pageable) {
        TrainingRecordSearchRequest criteria = request == null
                ? new TrainingRecordSearchRequest(null, null, null, null, null, null, null, null, null, null, null)
                : request;
        if (criteria.dateFrom() != null && criteria.dateTo() != null && criteria.dateTo().isBefore(criteria.dateFrom())) {
            throw new BadRequestException("dateTo must be greater than or equal to dateFrom");
        }

        User actor = accessPolicy.currentActor();
        Collection<String> roles = accessPolicy.currentRoleCodes();
        Long scopeEmployeeId = null;
        Long scopeDepartmentId = null;

        if (roles.contains(TrainingAccessPolicy.ROLE_ADMIN) || roles.contains(TrainingAccessPolicy.ROLE_SYSTEM_JOB)) {
            scopeDepartmentId = null;
        } else if (roles.contains(TrainingAccessPolicy.ROLE_MANAGER)) {
            scopeDepartmentId = actor.getDepartment() == null ? -1L : actor.getDepartment().getId();
        } else {
            scopeEmployeeId = actor.getId();
        }

        return recordRepository.searchRecords(
                scopeEmployeeId,
                scopeDepartmentId,
                normalizeKeywordPattern(criteria.keyword()),
                criteria.dateFrom(),
                criteria.dateTo(),
                criteria.activityTypeId(),
                criteria.professionalFieldId(),
                criteria.workflowStatus(),
                criteria.hasEvidence(),
                criteria.moderationStatus(),
                criteria.employeeId(),
                criteria.departmentId(),
                criteria.sourceType(),
                normalizePageable(pageable)
        );
    }

    @Override
    @Transactional(readOnly = true)
    public TrainingRecordDetailResponse getDetail(Long id) {
        return detailResponse(findScopedRecord(id), 0);
    }

    @Override
    @Transactional(readOnly = true)
    public TrainingRecordOptionsResponse getOptions() {
        List<TrainingActivityTypeOptionResponse> activityTypes = activityTypeRepository
                .findByActiveTrueOrderBySortOrderAscNameAsc()
                .stream()
                .map(activityType -> new TrainingActivityTypeOptionResponse(
                        activityType.getId(),
                        activityType.getCode(),
                        activityType.getName(),
                        activityType.getDefaultDurationUnit(),
                        activityType.isRequiresEvidence(),
                        activityType.getMaxCreditedHoursPerRecord()
                ))
                .toList();
        List<TrainingProfessionalFieldOptionResponse> professionalFields = professionalFieldRepository
                .findByActiveTrueOrderByNameAsc()
                .stream()
                .map(field -> new TrainingProfessionalFieldOptionResponse(
                        field.getId(),
                        field.getCode(),
                        field.getName()
                ))
                .toList();
        return new TrainingRecordOptionsResponse(activityTypes, professionalFields);
    }

    @Override
    @Transactional
    public TrainingRecordDetailResponse create(TrainingRecordFormRequest request) {
        User actor = accessPolicy.currentActor();
        Collection<String> roles = accessPolicy.currentRoleCodes();
        User employee = resolveTargetEmployee(actor, roles, request.employeeId());
        TrainingActivityType activityType = resolveActiveActivityType(request.activityTypeId());
        ProfessionalField professionalField = resolveProfessionalField(request.professionalFieldId(), request.customProfessionalField());
        validator.validateRecordForm(request, false);

        long duplicateCount = duplicateCount(employee.getId(), request, null);
        TrainingRecord record = mapper.toEntity(request);
        record.setEmployee(employee);
        record.setEmployeeDepartmentSnapshot(employee.getDepartment());
        record.setActivityType(activityType);
        record.setProfessionalField(professionalField);
        record.setWorkflowStatus(TrainingRecordStatus.DRAFT);
        record.setSourceType(TrainingSourceType.MANUAL);
        record.setEditCount(0);
        record.setCreatedByUser(actor);
        record.setUpdatedByUser(actor);

        TrainingRecord saved = recordRepository.save(record);
        safeAuditLog(saved, TrainingRecordChangeType.CREATED, null, actor);
        return detailResponse(saved, duplicateCount);
    }

    @Override
    @Transactional
    public TrainingRecordDetailResponse update(Long id, TrainingRecordFormRequest request) {
        TrainingRecord record = findScopedRecord(id);
        requireEditable(record);
        requireFreshVersion(record, request.version());
        User actor = accessPolicy.currentActor();
        TrainingActivityType activityType = resolveActiveActivityType(request.activityTypeId());
        ProfessionalField professionalField = resolveProfessionalField(request.professionalFieldId(), request.customProfessionalField());
        validator.validateRecordForm(request, false);

        if (record.getWorkflowStatus() != TrainingRecordStatus.DRAFT && record.getEditCount() >= maxEditCount) {
            throw new ConflictException("Training record edit limit exceeded");
        }

        Map<String, Object> before = snapshot(record);
        mapper.applyForm(record, request);
        record.setActivityType(activityType);
        record.setProfessionalField(professionalField);
        if (record.getWorkflowStatus() != TrainingRecordStatus.DRAFT) {
            record.setEditCount(record.getEditCount() + 1);
        }
        record.setUpdatedByUser(actor);

        long duplicateCount = duplicateCount(record.getEmployee().getId(), request, record.getId());
        TrainingRecord saved = recordRepository.save(record);
        auditService.logRecordChange(saved, TrainingRecordChangeType.UPDATED, before, snapshot(saved), actor);
        return detailResponse(saved, duplicateCount);
    }

    @Override
    @Transactional
    public TrainingRecordDetailResponse submit(Long id, TrainingRecordSubmitRequest request) {
        log.info("Bắt đầu nộp hồ sơ id={}", id);
        try {
            TrainingRecord record = findScopedRecord(id);
            log.info("Đã tìm thấy hồ sơ id={}, status={}", id, record.getWorkflowStatus());
            requireEditable(record);
            log.info("Hồ sơ đang ở trạng thái có thể chỉnh sửa");
            requireFreshVersion(record, request == null ? null : request.version());
            User actor = accessPolicy.currentActor();
            log.info("Người nộp: userId={}", actor.getId());
            Map<String, Object> before = snapshot(record);
            log.info("Đã tạo snapshot trước khi nộp");

            stateMachine.requireTransition(record.getWorkflowStatus(), TrainingRecordStatus.SUBMITTED, isAdmin());
            log.info("Chuyển trạng thái thành công");
            record.setWorkflowStatus(TrainingRecordStatus.SUBMITTED);
            record.setSubmittedAt(LocalDateTime.now());
            record.setUpdatedByUser(actor);

            TrainingRecord saved = recordRepository.save(record);
            log.info("Đã lưu hồ sơ, version={}", saved.getVersion());
            safeAuditLog(saved, TrainingRecordChangeType.SUBMITTED, before, actor);
            log.info("Bắt đầu build detailResponse");
            TrainingRecordDetailResponse response = detailResponse(saved, 0);
            log.info("Nộp hồ sơ thành công id={}", id);
            return response;
        } catch (Exception e) {
            log.error("Lỗi khi nộp hồ sơ id={}: {}", id, e.getMessage(), e);
            throw e;
        }
    }

    @Override
    @Transactional
    public TrainingRecordDetailResponse returnToDraft(Long id) {
        TrainingRecord record = findScopedRecord(id);
        User actor = accessPolicy.currentActor();
        boolean isAdminUser = isAdmin();

        if (!isAdminUser && !record.getEmployee().getId().equals(actor.getId())) {
            throw new ForbiddenException("Bạn không có quyền trả hồ sơ này về nháp");
        }

        Map<String, Object> before = snapshot(record);
        stateMachine.requireTransition(record.getWorkflowStatus(), TrainingRecordStatus.DRAFT, isAdminUser);
        record.setWorkflowStatus(TrainingRecordStatus.DRAFT);
        record.setSubmittedAt(null);
        record.setUpdatedByUser(actor);

        TrainingRecord saved = recordRepository.save(record);
        safeAuditLog(saved, TrainingRecordChangeType.RETURNED_TO_DRAFT, before, actor);
        return detailResponse(saved, 0);
    }

    private TrainingRecord findScopedRecord(Long id) {
        TrainingRecord record = recordRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Training record not found"));
        accessPolicy.requireCanReadRecord(accessPolicy.currentActor(), accessPolicy.currentRoleCodes(), record);
        return record;
    }

    private User resolveTargetEmployee(User actor, Collection<String> roles, Long requestedEmployeeId) {
        User targetEmployee = actor;
        if (canSelectEmployee(roles) && requestedEmployeeId != null) {
            targetEmployee = userRepository.findById(requestedEmployeeId)
                    .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
        }
        if (!accessPolicy.canCreateRecordFor(actor, roles, targetEmployee)) {
            throw new ForbiddenException("You cannot create training records for this employee");
        }
        return targetEmployee;
    }

    private boolean canSelectEmployee(Collection<String> roles) {
        return roles.contains(TrainingAccessPolicy.ROLE_ADMIN)
                || roles.contains(TrainingAccessPolicy.ROLE_MANAGER)
                || roles.contains(TrainingAccessPolicy.ROLE_SYSTEM_JOB);
    }

    private boolean isAdmin() {
        return accessPolicy.currentRoleCodes().contains(TrainingAccessPolicy.ROLE_ADMIN)
                || accessPolicy.currentRoleCodes().contains(TrainingAccessPolicy.ROLE_SYSTEM_JOB);
    }

    private TrainingActivityType resolveActiveActivityType(Long id) {
        TrainingActivityType activityType = activityTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Training activity type not found"));
        if (!activityType.isActive()) {
            throw ValidationException.field("activityTypeId", "Activity type must be active");
        }
        return activityType;
    }

    private ProfessionalField resolveProfessionalField(Long id, String customName) {
        if (id != null) {
            ProfessionalField professionalField = professionalFieldRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Professional field not found"));
            if (!professionalField.isActive() && !professionalField.getCode().startsWith("CUSTOM_")) {
                throw ValidationException.field("professionalFieldId", "Professional field must be active");
            }
            return professionalField;
        }
        if (customName != null && !customName.trim().isEmpty()) {
            String trimmedName = customName.trim();
            if (trimmedName.length() > 255) {
                throw ValidationException.field("customProfessionalField", "Lĩnh vực chuyên môn không được vượt quá 255 ký tự");
            }
            User actor = accessPolicy.currentActor();
            ProfessionalField savedPf = professionalFieldRepository.findAll().stream()
                    .filter(pf -> pf.getName().equalsIgnoreCase(trimmedName))
                    .findFirst()
                    .orElseGet(() -> {
                        String cleanCode = "CUSTOM_" + System.currentTimeMillis();
                        ProfessionalField newPf = ProfessionalField.builder()
                                .code(cleanCode)
                                .name(trimmedName)
                                .description("Tự đề xuất bởi nhân viên: " + actor.getName() + " (Chờ duyệt)")
                                .active(false)
                                .version(0L)
                                .build();
                        return professionalFieldRepository.save(newPf);
                    });

            try {
                List<User> admins = userRoleRepository.findAll().stream()
                        .filter(ur -> ur.getRole() != null && "ADMIN".equals(ur.getRole().getCode()))
                        .map(ur -> ur.getUser())
                        .filter(u -> u != null && !u.isDeleted())
                        .toList();
                String title = "Đề xuất lĩnh vực chuyên môn mới";
                String content = "Nhân viên " + actor.getName() + " đã đề xuất lĩnh vực chuyên môn mới: \"" + trimmedName + "\". Vui lòng kiểm tra và duyệt.";
                String deepLink = "/admin/training/professional-fields?tab=pending";
                for (User admin : admins) {
                    notificationService.createInAppNotification(
                            admin.getId(),
                            "SYSTEM",
                            title,
                            content,
                            deepLink,
                            "CUSTOM_PF_" + savedPf.getId() + "_" + admin.getId()
                    );
                }
            } catch (Exception e) {
                log.error("Failed to send admin notifications for new professional field", e);
            }

            return savedPf;
        }
        return null;
    }

    private void requireFreshVersion(TrainingRecord record, Long requestVersion) {
        if (requestVersion != null && !requestVersion.equals(record.getVersion())) {
            throw new ConflictException("Training record has been updated by another user");
        }
    }

    private void requireEditable(TrainingRecord record) {
        stateMachine.requireEditable(record.getWorkflowStatus());
    }

    private TrainingRecordDetailResponse detailResponse(TrainingRecord record, long duplicateCount) {
        List<TrainingEvidenceFile> evidences = evidenceFileRepository.findByTrainingRecord_IdAndActiveTrue(record.getId());
        return mapper.toDetailResponse(
                record,
                evidences,
                changeLogRepository.findByTrainingRecord_IdOrderByChangedAtDesc(record.getId()),
                duplicateCount
        );
    }

    private String normalizeKeywordPattern(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return "%" + keyword.trim().toLowerCase() + "%";
    }

    private Pageable normalizePageable(Pageable pageable) {
        int page = pageable == null ? 0 : Math.max(pageable.getPageNumber(), 0);
        int size = pageable == null ? 20 : Math.min(Math.max(pageable.getPageSize(), 1), 100);
        Sort sort = pageable == null || pageable.getSort().isUnsorted()
                ? Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("startDate"), Sort.Order.desc("id"))
                : Sort.by(pageable.getSort().stream().map(this::normalizeOrder).toList());
        return PageRequest.of(page, size, sort);
    }

    private Sort.Order normalizeOrder(Sort.Order order) {
        Map<String, String> allowedSorts = Map.ofEntries(
                Map.entry("id", "id"),
                Map.entry("title", "title"),
                Map.entry("startDate", "startDate"),
                Map.entry("submittedAt", "submittedAt"),
                Map.entry("updatedAt", "updatedAt"),
                Map.entry("declaredHours", "declaredHours"),
                Map.entry("workflowStatus", "workflowStatus")
        );
        String property = allowedSorts.get(order.getProperty());
        if (property == null) {
            throw new BadRequestException("Thuộc tính sắp xếp không được hỗ trợ: " + order.getProperty());
        }
        return new Sort.Order(order.getDirection(), property);
    }

    private long duplicateCount(Long employeeId, TrainingRecordFormRequest request, Long excludeId) {
        if (request.declaredHours() == null || request.title() == null || request.startDate() == null) {
            return 0;
        }
        if (excludeId == null) {
            return recordRepository.countDuplicateCandidates(
                    employeeId,
                    request.title().trim(),
                    request.startDate(),
                    request.declaredHours()
            );
        }
        return recordRepository.countDuplicateCandidatesExcluding(
                employeeId,
                request.title().trim(),
                request.startDate(),
                request.declaredHours(),
                excludeId
        );
    }

    private Map<String, Object> snapshot(TrainingRecord record) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", record.getId());
        data.put("employeeId", record.getEmployee() == null ? null : record.getEmployee().getId());
        data.put("activityTypeId", record.getActivityType() == null ? null : record.getActivityType().getId());
        data.put("professionalFieldId", record.getProfessionalField() == null ? null : record.getProfessionalField().getId());
        data.put("title", record.getTitle());
        data.put("provider", record.getProvider());
        data.put("startDate", record.getStartDate() == null ? null : record.getStartDate().toString());
        data.put("endDate", record.getEndDate() == null ? null : record.getEndDate().toString());
        data.put("declaredHours", record.getDeclaredHours() == null ? null : record.getDeclaredHours().toPlainString());
        data.put("workflowStatus", record.getWorkflowStatus() == null ? null : record.getWorkflowStatus().name());
        data.put("editCount", record.getEditCount());
        data.put("version", record.getVersion());
        return data;
    }

    private void safeAuditLog(TrainingRecord record, TrainingRecordChangeType changeType,
                              Map<String, Object> before, User actor) {
        try {
            auditService.logRecordChange(record, changeType, before, snapshot(record), actor);
        } catch (Exception e) {
            log.warn("Không thể ghi nhật ký thay đổi hồ sơ {}: {}", record.getId(), e.getMessage());
        }
    }
}
