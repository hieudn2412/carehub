package vn.vietduc.carehubbackend.training.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.training.dto.request.RequirementFormRequest;
import vn.vietduc.carehubbackend.training.dto.request.RequirementSearchRequest;
import vn.vietduc.carehubbackend.training.dto.request.RequirementStatusRequest;
import vn.vietduc.carehubbackend.training.dto.response.RequirementDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.RequirementListResponse;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.entity.TrainingRequirement;
import vn.vietduc.carehubbackend.training.mapper.TrainingRequirementMapper;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRequirementRepository;
import vn.vietduc.carehubbackend.training.service.TrainingAccessPolicy;
import vn.vietduc.carehubbackend.training.service.CmeScopeService;
import vn.vietduc.carehubbackend.training.service.TrainingRequirementService;
import vn.vietduc.carehubbackend.training.validation.TrainingDomainValidator;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Position;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.PositionRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class TrainingRequirementServiceImpl implements TrainingRequirementService {
    private static final int MAX_PAGE_SIZE = 100;

    private final TrainingRequirementRepository requirementRepository;
    private final DepartmentRepository departmentRepository;
    private final PositionRepository positionRepository;
    private final ProfessionalFieldRepository professionalFieldRepository;
    private final UserRepository userRepository;
    private final TrainingRequirementMapper mapper;
    private final TrainingDomainValidator validator;
    private final TrainingAccessPolicy accessPolicy;
    private final CmeScopeService cmeScopeService;

    @Override
    @Transactional(readOnly = true)
    public Page<RequirementListResponse> search(RequirementSearchRequest request, Pageable pageable) {
        RequirementSearchRequest criteria = request == null
                ? new RequirementSearchRequest(null, null, null, null, null, null)
                : request;
        return requirementRepository.search(
                normalizeKeywordPattern(criteria.keyword()),
                criteria.active(),
                criteria.departmentId(),
                criteria.jobPositionId(),
                criteria.professionalFieldId(),
                criteria.effectiveOn(),
                normalizePageable(pageable)
        ).map(requirement -> mapper.toListResponse(requirement, applicableEmployeeCount(requirement)));
    }

    @Override
    @Transactional(readOnly = true)
    public RequirementDetailResponse getDetail(Long id) {
        TrainingRequirement requirement = findById(id);
        return mapper.toDetailResponse(requirement, applicableEmployeeCount(requirement));
    }

    @Override
    @Transactional
    public RequirementDetailResponse create(RequirementFormRequest request) {
        validator.validateRequirementForm(request);
        String code = normalizeCode(request.code());
        if (requirementRepository.existsByCode(code)) {
            throw new ConflictException("Training requirement code already exists");
        }

        TrainingRequirement requirement = mapper.toEntity(request);
        applyScope(requirement, request);
        requirement.setCode(code);
        User actor = accessPolicy.currentActor();
        requirement.setCreatedByUser(actor);
        requirement.setUpdatedByUser(actor);
        validateNoActiveOverlap(requirement, null);
        TrainingRequirement saved = requirementRepository.save(requirement);
        return mapper.toDetailResponse(saved, applicableEmployeeCount(saved));
    }

    @Override
    @Transactional
    public RequirementDetailResponse update(Long id, RequirementFormRequest request) {
        validator.validateRequirementForm(request);
        TrainingRequirement requirement = findById(id);
        requireFreshVersion(requirement, request.version());
        String code = normalizeCode(request.code());
        if (!requirement.getCode().equals(code) && requirementRepository.existsByCodeAndIdNot(code, requirement.getId())) {
            throw new ConflictException("Training requirement code already exists");
        }

        mapper.applyForm(requirement, request);
        applyScope(requirement, request);
        requirement.setCode(code);
        requirement.setUpdatedByUser(accessPolicy.currentActor());
        validateNoActiveOverlap(requirement, requirement.getId());
        TrainingRequirement saved = requirementRepository.save(requirement);
        return mapper.toDetailResponse(saved, applicableEmployeeCount(saved));
    }

    @Override
    @Transactional
    public RequirementDetailResponse updateStatus(Long id, RequirementStatusRequest request) {
        TrainingRequirement requirement = findById(id);
        requireFreshVersion(requirement, request.version());
        requirement.setActive(Boolean.TRUE.equals(request.active()));
        requirement.setUpdatedByUser(accessPolicy.currentActor());
        validateNoActiveOverlap(requirement, requirement.getId());
        TrainingRequirement saved = requirementRepository.save(requirement);
        return mapper.toDetailResponse(saved, applicableEmployeeCount(saved));
    }

    private void applyScope(TrainingRequirement requirement, RequirementFormRequest request) {
        requirement.setDepartment(resolveDepartment(request.departmentId()));
        requirement.setJobPosition(resolvePosition(request.jobPositionId()));
        requirement.setProfessionalField(resolveProfessionalField(request.professionalFieldId()));
    }

    private void validateNoActiveOverlap(TrainingRequirement requirement, Long ignoredId) {
        if (!requirement.isActive()) {
            return;
        }
        Long departmentId = requirement.getDepartment() == null ? null : requirement.getDepartment().getId();
        Long positionId = requirement.getJobPosition() == null ? null : requirement.getJobPosition().getId();
        Long professionalFieldId = requirement.getProfessionalField() == null
                ? null
                : requirement.getProfessionalField().getId();
        if (!requirementRepository.findOverlappingActiveRequirements(
                ignoredId,
                departmentId,
                positionId,
                professionalFieldId,
                requirement.getEffectiveFrom(),
                requirement.getEffectiveTo()
        ).isEmpty()) {
            throw new ConflictException("Active training requirement overlaps an existing requirement for the same scope");
        }
    }

    private TrainingRequirement findById(Long id) {
        return requirementRepository.findDetailById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Training requirement not found"));
    }

    private Department resolveDepartment(Long id) {
        if (id == null) {
            return null;
        }
        return departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found"));
    }

    private Position resolvePosition(Long id) {
        if (id == null) {
            return null;
        }
        return positionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Position not found"));
    }

    private ProfessionalField resolveProfessionalField(Long id) {
        if (id == null) {
            return null;
        }
        return professionalFieldRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Professional field not found"));
    }

    private long applicableEmployeeCount(TrainingRequirement requirement) {
        var applicableDepartmentIds = cmeScopeService.getApplicableDepartmentIds();
        if (applicableDepartmentIds.isEmpty()) {
            return 0;
        }
        Long departmentId = requirement.getDepartment() == null ? null : requirement.getDepartment().getId();
        Long positionId = requirement.getJobPosition() == null ? null : requirement.getJobPosition().getId();
        return userRepository.countScopedTrainingRequirementCandidates(
                applicableDepartmentIds,
                departmentId,
                positionId
        );
    }

    private void requireFreshVersion(TrainingRequirement requirement, Long requestVersion) {
        if (requestVersion != null && !requestVersion.equals(requirement.getVersion())) {
            throw new ConflictException("Training requirement has been updated by another user");
        }
    }

    private Pageable normalizePageable(Pageable pageable) {
        int size = Math.min(Math.max(pageable.getPageSize(), 1), MAX_PAGE_SIZE);
        Sort sort = pageable.getSort().isSorted()
                ? Sort.by(pageable.getSort().stream().map(this::normalizeOrder).toList())
                : Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.asc("code"));
        return PageRequest.of(pageable.getPageNumber(), size, sort);
    }

    private Sort.Order normalizeOrder(Sort.Order order) {
        Map<String, String> allowedSorts = Map.of(
                "code", "code",
                "name", "name",
                "requiredHours", "requiredHours",
                "cycleYears", "cycleYears",
                "effectiveFrom", "effectiveFrom",
                "effectiveTo", "effectiveTo",
                "updatedAt", "updatedAt",
                "active", "active"
        );
        String property = allowedSorts.get(order.getProperty());
        if (property == null) {
            throw new IllegalArgumentException("Unsupported sort property: " + order.getProperty());
        }
        return new Sort.Order(order.getDirection(), property);
    }

    private String normalizeKeywordPattern(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return "%" + keyword.trim().toLowerCase() + "%";
    }

    private String normalizeCode(String code) {
        return code == null ? null : code.trim().toUpperCase();
    }
}
