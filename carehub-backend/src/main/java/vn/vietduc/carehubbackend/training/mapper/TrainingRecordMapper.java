package vn.vietduc.carehubbackend.training.mapper;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordFormRequest;
import vn.vietduc.carehubbackend.training.dto.response.EvidenceMetadataResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordChangeLogResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordListResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordReviewTimelineResponse;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingRecordChangeLog;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.entity.TrainingRecordReview;
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
                idOf(entity.getEmployeeDepartmentSnapshot()),
                entity.getEmployeeDepartmentSnapshot() == null ? null : entity.getEmployeeDepartmentSnapshot().getName(),
                activityType == null ? null : activityType.getId(),
                activityType == null ? null : activityType.getName(),
                entity.getProfessionalField() == null ? null : entity.getProfessionalField().getId(),
                entity.getProfessionalField() == null ? null : entity.getProfessionalField().getName(),
                entity.getTitle(),
                entity.getProvider(),
                entity.getStartDate(),
                entity.getEndDate(),
                entity.getDeclaredHours(),
                entity.getApprovedHours(),
                entity.getWorkflowStatus(),
                entity.getSourceType(),
                entity.getSubmittedAt(),
                entity.getUpdatedAt(),
                0,
                0,
                0,
                entity.getVersion()
        );
    }

    public TrainingRecordDetailResponse toDetailResponse(
            TrainingRecord entity,
            List<TrainingEvidenceFile> evidenceFiles,
            List<TrainingRecordReview> reviews,
            List<TrainingRecordChangeLog> changeLogs,
            long duplicateCandidateCount
    ) {
        User employee = entity.getEmployee();
        Department department = entity.getEmployeeDepartmentSnapshot();
        TrainingActivityType activityType = entity.getActivityType();
        ProfessionalField professionalField = entity.getProfessionalField();
        List<EvidenceMetadataResponse> evidences = evidenceFiles == null
                ? List.of()
                : evidenceFiles.stream().map(evidenceMapper::toMetadataResponse).toList();
        List<TrainingRecordReviewTimelineResponse> reviewTimeline = reviews == null
                ? List.of()
                : reviews.stream().map(this::toReviewTimelineResponse).toList();
        List<TrainingRecordChangeLogResponse> changeHistory = changeLogs == null
                ? List.of()
                : changeLogs.stream().map(this::toChangeLogResponse).toList();

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
                reviewTimeline,
                changeHistory,
                duplicateCandidateCount > 0,
                duplicateCandidateCount,
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getVersion()
        );
    }

    public TrainingRecordDetailResponse toDetailResponse(
            TrainingRecord entity,
            List<TrainingEvidenceFile> evidenceFiles,
            long duplicateCandidateCount
    ) {
        return toDetailResponse(entity, evidenceFiles, List.of(), List.of(), duplicateCandidateCount);
    }

    private TrainingRecordReviewTimelineResponse toReviewTimelineResponse(TrainingRecordReview review) {
        User reviewer = review.getReviewedByUser();
        return new TrainingRecordReviewTimelineResponse(
                review.getId(),
                review.getDecision(),
                review.getDeclaredHoursSnapshot(),
                review.getApprovedHours(),
                review.getReason(),
                idOf(reviewer),
                reviewer == null ? null : reviewer.getName(),
                review.getReviewedAt()
        );
    }

    private TrainingRecordChangeLogResponse toChangeLogResponse(TrainingRecordChangeLog changeLog) {
        User changedBy = changeLog.getChangedByUser();
        return new TrainingRecordChangeLogResponse(
                changeLog.getId(),
                changeLog.getVersionNo(),
                changeLog.getChangeType(),
                changeLog.getBeforeData(),
                changeLog.getAfterData(),
                idOf(changedBy),
                changedBy == null ? null : changedBy.getName(),
                changeLog.getChangedAt()
        );
    }

    private Long idOf(User user) {
        return user == null ? null : user.getId();
    }

    private Long idOf(Department department) {
        return department == null ? null : department.getId();
    }
}
