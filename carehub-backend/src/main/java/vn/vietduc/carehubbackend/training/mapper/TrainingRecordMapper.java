package vn.vietduc.carehubbackend.training.mapper;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordFormRequest;
import vn.vietduc.carehubbackend.training.dto.response.EvidenceMetadataResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordListResponse;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;

import java.util.List;

@Component
@RequiredArgsConstructor
public class TrainingRecordMapper {
    private final TrainingEvidenceMapper evidenceMapper;

    public TrainingRecord toEntity(TrainingRecordFormRequest request) {
        TrainingRecord entity = new TrainingRecord();
        applyForm(entity, request);
        return entity;
    }

    public void applyForm(TrainingRecord entity, TrainingRecordFormRequest request) {
        entity.setTitle(request.title());
        entity.setProvider(request.provider());
        entity.setDescription(request.description());
        entity.setStartDate(request.startDate());
        entity.setEndDate(request.endDate());
        entity.setStartTime(request.startTime());
        entity.setEndTime(request.endTime());
        entity.setDurationValue(request.durationValue());
        entity.setDurationUnit(request.durationUnit());
        entity.setDurationRawText(request.durationRawText());
        entity.setDeclaredHours(request.declaredHours());
    }

    public TrainingRecordListResponse toListResponse(TrainingRecord entity) {
        User employee = entity.getEmployee();
        TrainingActivityType activityType = entity.getActivityType();
        return new TrainingRecordListResponse(
                entity.getId(),
                idOf(employee),
                employee == null ? null : employee.getEmployeeCode(),
                employee == null ? null : employee.getName(),
                activityType == null ? null : activityType.getName(),
                entity.getTitle(),
                entity.getStartDate(),
                entity.getEndDate(),
                entity.getDeclaredHours(),
                entity.getApprovedHours(),
                entity.getWorkflowStatus(),
                entity.getSubmittedAt(),
                entity.getVersion()
        );
    }

    public TrainingRecordDetailResponse toDetailResponse(
            TrainingRecord entity,
            List<TrainingEvidenceFile> evidenceFiles
    ) {
        User employee = entity.getEmployee();
        Department department = entity.getEmployeeDepartmentSnapshot();
        TrainingActivityType activityType = entity.getActivityType();
        ProfessionalField professionalField = entity.getProfessionalField();
        List<EvidenceMetadataResponse> evidences = evidenceFiles == null
                ? List.of()
                : evidenceFiles.stream().map(evidenceMapper::toMetadataResponse).toList();

        return new TrainingRecordDetailResponse(
                entity.getId(),
                idOf(employee),
                employee == null ? null : employee.getEmployeeCode(),
                employee == null ? null : employee.getName(),
                idOf(department),
                department == null ? null : department.getName(),
                activityType == null ? null : activityType.getId(),
                activityType == null ? null : activityType.getName(),
                professionalField == null ? null : professionalField.getId(),
                professionalField == null ? null : professionalField.getName(),
                entity.getTitle(),
                entity.getProvider(),
                entity.getDescription(),
                entity.getStartDate(),
                entity.getEndDate(),
                entity.getStartTime(),
                entity.getEndTime(),
                entity.getDurationValue(),
                entity.getDurationUnit(),
                entity.getDurationRawText(),
                entity.getDeclaredHours(),
                entity.getApprovedHours(),
                entity.getWorkflowStatus(),
                entity.getEditCount(),
                entity.getSubmittedAt(),
                idOf(entity.getLatestReviewedByUser()),
                entity.getLatestReviewedAt(),
                entity.getLatestRejectionReason(),
                entity.getSourceType(),
                entity.getSourceReference(),
                entity.getSourceSubmittedAt(),
                evidences,
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getVersion()
        );
    }

    private Long idOf(User user) {
        return user == null ? null : user.getId();
    }

    private Long idOf(Department department) {
        return department == null ? null : department.getId();
    }
}
