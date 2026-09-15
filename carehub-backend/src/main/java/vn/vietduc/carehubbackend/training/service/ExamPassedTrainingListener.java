package vn.vietduc.carehubbackend.training.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;
import vn.vietduc.carehubbackend.notification.messaging.NotificationDispatchEvent;
import vn.vietduc.carehubbackend.notification.messaging.NotificationEventPublisher;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.event.ExamAttemptPassedEvent;
import vn.vietduc.carehubbackend.questiongeneration.service.QuestionGenerationLabels;
import vn.vietduc.carehubbackend.user.entity.User;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class ExamPassedTrainingListener {

    private final NotificationEventPublisher notificationEventPublisher;
    private final PlatformTransactionManager transactionManager;

    /**
     * Chạy sau khi transaction chấm bài commit, và BẮT BUỘC phải mở transaction MỚI —
     * xem lịch sử ở NotificationDispatcher cho lý do (AFTER_COMMIT + @Transactional
     * thường không join transaction nào cả).
     *
     * <p>Chỉ gửi thông báo chúc mừng. Giờ đào tạo CME luôn do nhân viên tự khai báo
     * thủ công (TrainingRecordServiceImpl) — thi đạt bài kiểm tra năng lực KHÔNG được
     * tự động quy đổi thành giờ CME.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onExamPassed(ExamAttemptPassedEvent event) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        template.executeWithoutResult(status -> handleExamPassed(event));
    }

    private void handleExamPassed(ExamAttemptPassedEvent event) {
        ExamAttempt attempt = event.attempt();
        User user = attempt.getUser();
        String examName = attempt.getAssignment() != null
                ? attempt.getAssignment().getName()
                : (attempt.getExamPaper() != null ? attempt.getExamPaper().getName() : "Bài kiểm tra");

        try {
            sendExamPassedNotification(attempt, user, examName);
        } catch (Exception e) {
            log.error("Failed to process exam passed event for attemptId={}: {}", attempt.getId(), e.getMessage(), e);
        }
    }

    private void sendExamPassedNotification(ExamAttempt attempt, User user, String examName) {
        // Listener chỉ chạy cho bài đã đạt điểm sàn của đề, nên kết luận luôn là "Đạt".
        String classification = "Đạt";
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
}
