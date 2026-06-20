package vn.vietduc.carehubbackend.training.mapper;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.training.dto.request.RequirementFormRequest;
import vn.vietduc.carehubbackend.training.dto.response.RequirementDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.RequirementListResponse;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.entity.TrainingRequirement;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Position;
import vn.vietduc.carehubbackend.user.entity.User;

@Component
public class TrainingRequirementMapper {
    public TrainingRequirement toEntity(RequirementFormRequest request) {
        TrainingRequirement entity = new TrainingRequirement();
        applyForm(entity, request);
        return entity;
    }

    public void applyForm(TrainingRequirement entity, RequirementFormRequest request) {
        entity.setCode(request.code());
        entity.setName(request.name());
        entity.setRequiredHours(request.requiredHours());
        entity.setCycleYears(request.cycleYears());
        entity.setWarningThresholdHours(request.warningThresholdHours());
        entity.setEffectiveFrom(request.effectiveFrom());
        entity.setEffectiveTo(request.effectiveTo());
        entity.setActive(request.active() == null || request.active());
    }

    public RequirementListResponse toListResponse(TrainingRequirement entity) {
        return toListResponse(entity, 0L);
    }

    public RequirementListResponse toListResponse(TrainingRequirement entity, long applicableEmployeeCount) {
        return new RequirementListResponse(
                entity.getId(),
                entity.getCode(),
                entity.getName(),
                entity.getRequiredHours(),
                entity.getCycleYears(),
                idOf(entity.getDepartment()),
                nameOf(entity.getDepartment()),
                idOf(entity.getJobPosition()),
                nameOf(entity.getJobPosition()),
                idOf(entity.getProfessionalField()),
                nameOf(entity.getProfessionalField()),
                entity.getWarningThresholdHours(),
                entity.getEffectiveFrom(),
                entity.getEffectiveTo(),
                entity.isActive(),
                applicableEmployeeCount,
                entity.getUpdatedAt(),
                entity.getVersion()
        );
    }

    public RequirementDetailResponse toDetailResponse(TrainingRequirement entity) {
        return toDetailResponse(entity, 0L);
    }

    public RequirementDetailResponse toDetailResponse(TrainingRequirement entity, long applicableEmployeeCount) {
        return new RequirementDetailResponse(
                entity.getId(),
                entity.getCode(),
                entity.getName(),
                entity.getRequiredHours(),
                entity.getCycleYears(),
                idOf(entity.getDepartment()),
                nameOf(entity.getDepartment()),
                idOf(entity.getJobPosition()),
                nameOf(entity.getJobPosition()),
                idOf(entity.getProfessionalField()),
                nameOf(entity.getProfessionalField()),
                entity.getWarningThresholdHours(),
                entity.getEffectiveFrom(),
                entity.getEffectiveTo(),
                entity.isActive(),
                applicableEmployeeCount,
                idOf(entity.getCreatedByUser()),
                idOf(entity.getUpdatedByUser()),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getVersion()
        );
    }

    private Long idOf(Department department) {
        return department == null ? null : department.getId();
    }

    private Long idOf(Position position) {
        return position == null ? null : position.getId();
    }

    private Long idOf(ProfessionalField professionalField) {
        return professionalField == null ? null : professionalField.getId();
    }

    private Long idOf(User user) {
        return user == null ? null : user.getId();
    }

    private String nameOf(Department department) {
        return department == null ? null : department.getName();
    }

    private String nameOf(Position position) {
        return position == null ? null : position.getName();
    }

    private String nameOf(ProfessionalField professionalField) {
        return professionalField == null ? null : professionalField.getName();
    }
}
