package vn.vietduc.carehubbackend.training.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ForbiddenException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordFormRequest;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordSubmitRequest;
import vn.vietduc.carehubbackend.training.dto.response.TrainingActivityTypeOptionResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingProfessionalFieldOptionResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordOptionsResponse;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordChangeType;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingSourceType;
import vn.vietduc.carehubbackend.training.mapper.TrainingRecordMapper;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingEvidenceFileRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.service.TrainingAccessPolicy;
import vn.vietduc.carehubbackend.training.service.TrainingAuditService;
import vn.vietduc.carehubbackend.training.service.TrainingRecordService;
import vn.vietduc.carehubbackend.training.service.TrainingRecordStateMachine;
import vn.vietduc.carehubbackend.training.validation.TrainingDomainValidator;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TrainingRecordServiceImpl implements TrainingRecordService {
    private final TrainingRecordRepository recordRepository;
    private final TrainingActivityTypeRepository activityTypeRepository;
    private final ProfessionalFieldRepository professionalFieldRepository;
    private final TrainingEvidenceFileRepository evidenceFileRepository;
    private final UserRepository userRepository;
    private final TrainingRecordMapper mapper;
    private final TrainingAccessPolicy accessPolicy;
    private final TrainingRecordStateMachine stateMachine;
    private final TrainingDomainValidator validator;
    private final TrainingAuditService auditService;

    @Value("${app.training.records.max-edit-count:2}")
    private int maxEditCount;

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
        ProfessionalField professionalField = resolveProfessionalField(request.professionalFieldId());
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
        auditService.logRecordChange(saved, TrainingRecordChangeType.CREATED, null, snapshot(saved), actor);
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
        ProfessionalField professionalField = resolveProfessionalField(request.professionalFieldId());
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
        TrainingRecord record = findScopedRecord(id);
        requireEditable(record);
        requireFreshVersion(record, request == null ? null : request.version());
        validateSubmitEvidence(record);
        User actor = accessPolicy.currentActor();
        Map<String, Object> before = snapshot(record);

        stateMachine.requireTransition(record.getWorkflowStatus(), TrainingRecordStatus.PENDING_REVIEW, isAdmin());
        record.setWorkflowStatus(TrainingRecordStatus.PENDING_REVIEW);
        record.setSubmittedAt(LocalDateTime.now());
        record.setUpdatedByUser(actor);

        TrainingRecord saved = recordRepository.save(record);
        auditService.logRecordChange(saved, TrainingRecordChangeType.SUBMITTED, before, snapshot(saved), actor);
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

    private ProfessionalField resolveProfessionalField(Long id) {
        if (id == null) {
            return null;
        }
        ProfessionalField professionalField = professionalFieldRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Professional field not found"));
        if (!professionalField.isActive()) {
            throw ValidationException.field("professionalFieldId", "Professional field must be active");
        }
        return professionalField;
    }

    private void requireFreshVersion(TrainingRecord record, Long requestVersion) {
        if (requestVersion != null && !requestVersion.equals(record.getVersion())) {
            throw new ConflictException("Training record has been updated by another user");
        }
    }

    private void requireEditable(TrainingRecord record) {
        if (record.getWorkflowStatus() != TrainingRecordStatus.DRAFT
                && record.getWorkflowStatus() != TrainingRecordStatus.REJECTED) {
            throw new ConflictException("Training record is not editable in status " + record.getWorkflowStatus());
        }
    }

    private void validateSubmitEvidence(TrainingRecord record) {
        long failedFiles = evidenceFileRepository.countByTrainingRecord_IdAndActiveTrueAndModerationStatus(
                record.getId(),
                EvidenceModerationStatus.FAILED
        );
        long errorFiles = evidenceFileRepository.countByTrainingRecord_IdAndActiveTrueAndModerationStatus(
                record.getId(),
                EvidenceModerationStatus.ERROR
        );
        if (failedFiles > 0 || errorFiles > 0) {
            throw new ConflictException("Training record has evidence files that did not pass moderation");
        }
        if (record.getActivityType().isRequiresEvidence()) {
            long passedFiles = evidenceFileRepository.countByTrainingRecord_IdAndActiveTrueAndModerationStatus(
                    record.getId(),
                    EvidenceModerationStatus.PASSED
            );
            if (passedFiles == 0) {
                throw ValidationException.field("evidence", "At least one passed evidence file is required");
            }
        }
    }

    private TrainingRecordDetailResponse detailResponse(TrainingRecord record, long duplicateCount) {
        List<TrainingEvidenceFile> evidences = evidenceFileRepository.findByTrainingRecord_IdAndActiveTrue(record.getId());
        return mapper.toDetailResponse(record, evidences, duplicateCount);
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
}
