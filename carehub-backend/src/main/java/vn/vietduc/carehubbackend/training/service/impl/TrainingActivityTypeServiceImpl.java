package vn.vietduc.carehubbackend.training.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.common.response.ErrorResponse;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.training.dto.request.ActivityTypeFormRequest;
import vn.vietduc.carehubbackend.training.dto.request.ActivityTypeStatusRequest;
import vn.vietduc.carehubbackend.training.dto.response.ActivityTypeDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.ActivityTypeListResponse;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityTypeChangeLog;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.enums.TrainingActivityTypeChangeType;
import vn.vietduc.carehubbackend.training.mapper.TrainingActivityTypeMapper;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeChangeLogRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.service.TrainingAccessPolicy;
import vn.vietduc.carehubbackend.training.service.TrainingActivityTypeService;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TrainingActivityTypeServiceImpl implements TrainingActivityTypeService {
    private static final int DETAIL_RECENT_RECORD_LIMIT = 10;

    private final TrainingActivityTypeRepository activityTypeRepository;
    private final TrainingRecordRepository recordRepository;
    private final TrainingActivityTypeChangeLogRepository changeLogRepository;
    private final TrainingActivityTypeMapper mapper;
    private final TrainingAccessPolicy accessPolicy;

    @Override
    @Transactional(readOnly = true)
    public Page<ActivityTypeListResponse> search(
            String keyword,
            Boolean active,
            Boolean requiresEvidence,
            DurationUnit durationUnit,
            Pageable pageable
    ) {
        Page<TrainingActivityType> page = activityTypeRepository.search(
                normalizeKeywordPattern(keyword),
                active,
                requiresEvidence,
                durationUnit,
                normalizePageable(pageable)
        );
        Map<Long, Long> usageCounts = usageCounts(page.getContent().stream().map(TrainingActivityType::getId).toList());

        return page.map(activityType -> mapper.toListResponse(
                activityType,
                usageCounts.getOrDefault(activityType.getId(), 0L)
        ));
    }

    @Override
    @Transactional(readOnly = true)
    public ActivityTypeDetailResponse getDetail(Long id) {
        TrainingActivityType activityType = findById(id);
        return detailResponse(activityType);
    }

    @Override
    @Transactional
    public ActivityTypeDetailResponse create(ActivityTypeFormRequest request) {
        validateForm(request);
        User actor = accessPolicy.currentActor();
        String code = normalizeCode(request.code());
        if (activityTypeRepository.existsByCode(code)) {
            throw new ConflictException("Training activity type code already exists");
        }

        TrainingActivityType activityType = mapper.toEntity(request);
        activityType.setCode(code);
        activityType.setCreatedByUser(actor);
        activityType.setUpdatedByUser(actor);
        TrainingActivityType saved = activityTypeRepository.save(activityType);
        audit(saved, TrainingActivityTypeChangeType.CREATED, null, snapshot(saved), actor);
        return detailResponse(saved);
    }

    @Override
    @Transactional
    public ActivityTypeDetailResponse update(Long id, ActivityTypeFormRequest request) {
        validateForm(request);
        TrainingActivityType activityType = findById(id);
        requireFreshVersion(activityType, request.version());
        User actor = accessPolicy.currentActor();
        Map<String, Object> before = snapshot(activityType);
        String requestedCode = normalizeCode(request.code());
        long usageCount = recordRepository.countByActivityType_Id(activityType.getId());

        if (!activityType.getCode().equals(requestedCode)) {
            if (usageCount > 0) {
                throw new ConflictException("Cannot change code of an activity type that is already referenced");
            }
            if (activityTypeRepository.existsByCodeAndIdNot(requestedCode, activityType.getId())) {
                throw new ConflictException("Training activity type code already exists");
            }
        }

        mapper.applyForm(activityType, request);
        activityType.setCode(requestedCode);
        activityType.setUpdatedByUser(actor);
        TrainingActivityType saved = activityTypeRepository.save(activityType);
        audit(saved, TrainingActivityTypeChangeType.UPDATED, before, snapshot(saved), actor);
        return detailResponse(saved);
    }

    @Override
    @Transactional
    public ActivityTypeDetailResponse updateStatus(Long id, ActivityTypeStatusRequest request) {
        TrainingActivityType activityType = findById(id);
        requireFreshVersion(activityType, request.version());
        User actor = accessPolicy.currentActor();
        Map<String, Object> before = snapshot(activityType);
        boolean newStatus = request.active();
        activityType.setActive(newStatus);
        activityType.setUpdatedByUser(actor);
        TrainingActivityType saved = activityTypeRepository.save(activityType);
        audit(
                saved,
                newStatus ? TrainingActivityTypeChangeType.ACTIVATED : TrainingActivityTypeChangeType.DEACTIVATED,
                before,
                snapshot(saved),
                actor
        );
        return detailResponse(saved);
    }

    private ActivityTypeDetailResponse detailResponse(TrainingActivityType activityType) {
        long usageCount = recordRepository.countByActivityType_Id(activityType.getId());
        List<TrainingRecord> recentRecords = recordRepository
                .findByActivityType_IdOrderByStartDateDesc(
                        activityType.getId(),
                        PageRequest.of(0, DETAIL_RECENT_RECORD_LIMIT)
                )
                .getContent();
        List<TrainingActivityTypeChangeLog> auditLogs = changeLogRepository
                .findTop20ByActivityType_IdOrderByChangedAtDesc(activityType.getId());
        return mapper.toDetailResponse(activityType, usageCount, recentRecords, auditLogs);
    }

    private TrainingActivityType findById(Long id) {
        return activityTypeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Training activity type not found"));
    }

    private void validateForm(ActivityTypeFormRequest request) {
        String code = normalizeCode(request.code());
        if (code == null || code.length() < 2 || code.length() > 50) {
            throw ValidationException.field("code", "Code must be 2-50 characters");
        }
        if (request.name() == null || request.name().trim().isEmpty()) {
            throw ValidationException.field("name", "Name is required");
        }
        if (request.name().trim().length() > 255) {
            throw ValidationException.field("name", "Name must not exceed 255 characters");
        }
        if (request.description() != null && request.description().trim().length() > 2000) {
            throw ValidationException.field("description", "Description must not exceed 2000 characters");
        }
        BigDecimal maxHours = request.maxCreditedHoursPerRecord();
        if (maxHours != null && maxHours.compareTo(BigDecimal.ZERO) <= 0) {
            throw ValidationException.field("maxCreditedHoursPerRecord", "Max credited hours must be greater than 0");
        }
        if (request.sortOrder() == null || request.sortOrder() < 0) {
            throw ValidationException.field("sortOrder", "Sort order must be greater than or equal to 0");
        }
    }

    private void requireFreshVersion(TrainingActivityType activityType, Long requestVersion) {
        if (requestVersion != null && !requestVersion.equals(activityType.getVersion())) {
            throw new ConflictException("Training activity type has been updated by another user");
        }
    }

    private void audit(
            TrainingActivityType activityType,
            TrainingActivityTypeChangeType changeType,
            Map<String, Object> before,
            Map<String, Object> after,
            User actor
    ) {
        TrainingActivityTypeChangeLog log = TrainingActivityTypeChangeLog.builder()
                .activityType(activityType)
                .versionNo(activityType.getVersion() == null ? 0 : activityType.getVersion())
                .changeType(changeType)
                .beforeData(before)
                .afterData(after)
                .changedByUser(actor)
                .changedAt(LocalDateTime.now())
                .build();
        changeLogRepository.save(log);
    }

    private Map<String, Object> snapshot(TrainingActivityType activityType) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", activityType.getId());
        data.put("code", activityType.getCode());
        data.put("name", activityType.getName());
        data.put("description", activityType.getDescription());
        data.put("defaultDurationUnit", activityType.getDefaultDurationUnit());
        data.put("requiresEvidence", activityType.isRequiresEvidence());
        data.put("maxCreditedHoursPerRecord", activityType.getMaxCreditedHoursPerRecord());
        data.put("sortOrder", activityType.getSortOrder());
        data.put("active", activityType.isActive());
        data.put("version", activityType.getVersion());
        return data;
    }

    private Map<Long, Long> usageCounts(Collection<Long> activityTypeIds) {
        if (activityTypeIds.isEmpty()) {
            return Map.of();
        }
        return activityTypeRepository.countUsageByActivityTypeIds(activityTypeIds)
                .stream()
                .collect(Collectors.toMap(
                        TrainingActivityTypeRepository.ActivityTypeUsageCount::getActivityTypeId,
                        TrainingActivityTypeRepository.ActivityTypeUsageCount::getUsageCount
                ));
    }

    private Pageable normalizePageable(Pageable pageable) {
        Sort sort = pageable.getSort().isSorted()
                ? Sort.by(pageable.getSort().stream().map(this::normalizeOrder).toList())
                : Sort.by(Sort.Order.asc("sortOrder"), Sort.Order.asc("code"));
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), sort);
    }

    private Sort.Order normalizeOrder(Sort.Order order) {
        Map<String, String> allowedSorts = Map.of(
                "code", "code",
                "name", "name",
                "sortOrder", "sortOrder",
                "updatedAt", "updatedAt",
                "updatedDate", "updatedAt"
        );
        String property = allowedSorts.get(order.getProperty());
        if (property == null) {
            throw ValidationException.field("sort", "Unsupported sort field: " + order.getProperty());
        }
        return new Sort.Order(order.getDirection(), property);
    }

    private String normalizeKeywordPattern(String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return null;
        }
        return "%" + keyword.trim().toLowerCase() + "%";
    }

    private String normalizeCode(String code) {
        return code == null ? null : code.trim().toUpperCase();
    }
}
