package vn.vietduc.carehubbackend.training.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;
import vn.vietduc.carehubbackend.notification.messaging.NotificationDispatchEvent;
import vn.vietduc.carehubbackend.notification.messaging.NotificationEventPublisher;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.event.ExamAttemptPassedEvent;
import vn.vietduc.carehubbackend.questiongeneration.service.QuestionGenerationLabels;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingSourceType;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class ExamPassedTrainingListener {

    private final TrainingRecordRepository trainingRecordRepository;
    private final TrainingActivityTypeRepository activityTypeRepository;
    private final NotificationEventPublisher notificationEventPublisher;
    private final TrainingComplianceCalculator complianceCalculator;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onExamPassed(ExamAttemptPassedEvent event) {
        ExamAttempt attempt = event.attempt();
        User user = attempt.getUser();
        String examName = attempt.getAssignment() != null
                ? attempt.getAssignment().getName()
                : (attempt.getExamPaper() != null ? attempt.getExamPaper().getName() : "Bài kiểm tra");

        try {
            // Find or create a "Kiểm tra năng lực" activity type for auto-created records
            TrainingActivityType examActivityType = activityTypeRepository
                    .findByCode("EXAM_PASSED")
                    .orElseGet(() -> createExamActivityType());

            // Create a training record for the passed exam
            TrainingRecord record = TrainingRecord.builder()
                    .employee(user)
                    .employeeDepartmentSnapshot(user.getDepartment())
                    .activityType(examActivityType)
                    .professionalField(null)
                    .title("Đạt: " + examName)
                    .description("Tự động ghi nhận từ bài kiểm tra năng lực \"" + examName
                            + "\" với điểm số " + (attempt.getScore() != null ? attempt.getScore().toPlainString() : "N/A")
                            + " - Phân loại: "
                            + (attempt.getClassification() != null
                            ? QuestionGenerationLabels.competencyLevel(attempt.getClassification())
                            : "Không xác định"))
                    .startDate(LocalDate.now())
                    .endDate(LocalDate.now())
                    .durationValue(BigDecimal.valueOf(attempt.getExamPaper() != null
                            ? attempt.getExamPaper().getTimeLimitMinutes() / 60.0
                            : 1.0))
                    .durationUnit(DurationUnit.HOUR)
                    .declaredHours(BigDecimal.valueOf(1.0)) // Default 1 CME hour per passed exam
                    .workflowStatus(TrainingRecordStatus.SUBMITTED)
                    .sourceType(TrainingSourceType.MANUAL)
                    .sourceReference("EXAM_ATTEMPT:" + attempt.getId())
                    .createdByUser(user)
                    .submittedAt(LocalDateTime.now())
                    .build();
            trainingRecordRepository.save(record);
            log.info("Created training record for exam passed: userId={}, attemptId={}, recordId={}",
                    user.getId(), attempt.getId(), record.getId());

            // Calculate new compliance and send notification
            sendExamPassedNotification(attempt, user, examName);

        } catch (Exception e) {
            log.error("Failed to process exam passed event for attemptId={}: {}", attempt.getId(), e.getMessage(), e);
        }
    }

    private void sendExamPassedNotification(ExamAttempt attempt, User user, String examName) {
        String classification = attempt.getClassification() != null
                ? QuestionGenerationLabels.competencyLevel(attempt.getClassification())
                : "Không xác định";
        String score = attempt.getScore() != null ? attempt.getScore().toPlainString() : "N/A";

        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("recipient_name", user.getName());
        variables.put("employee_name", user.getName());
        variables.put("employee_code", user.getEmployeeCode());
        variables.put("exam_name", examName);
        variables.put("score", score);
        variables.put("classification", classification);
        variables.put("compliance_percent", "N/A");
        variables.put("department", user.getDepartment() != null ? user.getDepartment().getName() : "");

        notificationEventPublisher.publish(new NotificationDispatchEvent(
                NotificationEventType.EXAM_PASSED,
                user.getId(),
                NotificationAudience.EMPLOYEE,
                "SUCCESS",
                "Bạn đã đạt bài kiểm tra " + examName,
                "Chúc mừng! Bạn đã đạt bài kiểm tra \"" + examName
                        + "\" với điểm số " + score
                        + " - Phân loại: " + classification + ".",
                "/staff/exam/history",
                "EXAM_PASSED:" + attempt.getId() + ":" + user.getId(),
                variables
        ));
    }

    private TrainingActivityType createExamActivityType() {
        TrainingActivityType type = TrainingActivityType.builder()
                .code("EXAM_PASSED")
                .name("Đạt bài kiểm tra năng lực")
                .description("Tự động ghi nhận khi nhân viên đạt bài kiểm tra năng lực")
                .defaultDurationUnit(DurationUnit.HOUR)
                .requiresEvidence(false)
                .maxCreditedHoursPerRecord(BigDecimal.valueOf(2.0))
                .sortOrder(100)
                .active(true)
                .build();
        return activityTypeRepository.save(type);
    }
}
