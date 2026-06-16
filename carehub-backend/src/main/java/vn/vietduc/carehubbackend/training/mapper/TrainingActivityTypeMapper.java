package vn.vietduc.carehubbackend.training.mapper;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.training.dto.request.ActivityTypeFormRequest;
import vn.vietduc.carehubbackend.training.dto.response.ActivityTypeDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.ActivityTypeListResponse;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.user.entity.User;

@Component
public class TrainingActivityTypeMapper {
    public TrainingActivityType toEntity(ActivityTypeFormRequest request) {
        TrainingActivityType entity = new TrainingActivityType();
        applyForm(entity, request);
        return entity;
    }

    public void applyForm(TrainingActivityType entity, ActivityTypeFormRequest request) {
        entity.setCode(request.code());
        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setDefaultDurationUnit(request.defaultDurationUnit() == null ? DurationUnit.HOUR : request.defaultDurationUnit());
        entity.setRequiresEvidence(request.requiresEvidence());
        entity.setMaxCreditedHoursPerRecord(request.maxCreditedHoursPerRecord());
        entity.setSortOrder(request.sortOrder() == null ? 0 : request.sortOrder());
        entity.setActive(request.active() == null || request.active());
    }

    public ActivityTypeListResponse toListResponse(TrainingActivityType entity) {
        return new ActivityTypeListResponse(
                entity.getId(),
                entity.getCode(),
                entity.getName(),
                entity.getDefaultDurationUnit(),
                entity.isRequiresEvidence(),
                entity.getMaxCreditedHoursPerRecord(),
                entity.getSortOrder(),
                entity.isActive(),
                entity.getVersion()
        );
    }

    public ActivityTypeDetailResponse toDetailResponse(TrainingActivityType entity) {
        return new ActivityTypeDetailResponse(
                entity.getId(),
                entity.getCode(),
                entity.getName(),
                entity.getDescription(),
                entity.getDefaultDurationUnit(),
                entity.isRequiresEvidence(),
                entity.getMaxCreditedHoursPerRecord(),
                entity.getSortOrder(),
                entity.isActive(),
                idOf(entity.getCreatedByUser()),
                idOf(entity.getUpdatedByUser()),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getVersion()
        );
    }

    private Long idOf(User user) {
        return user == null ? null : user.getId();
    }
}
