package vn.vietduc.carehubbackend.notification.service;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.notification.entity.EmailTemplate;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationCategory;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;
import vn.vietduc.carehubbackend.notification.repository.EmailTemplateRepository;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.notification", name = "seed-enabled", havingValue = "true", matchIfMissing = true)
public class NotificationBootstrap implements ApplicationRunner {
    private final NotificationPolicyService policyService;
    private final EmailTemplateRepository templateRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        policyService.initializeDefaults();
        seedTemplate(
                "CME_DEFICIT_EMPLOYEE",
                "Nhắc nhở thiếu giờ CME cho nhân viên",
                NotificationCategory.TRAINING,
                NotificationEventType.CME_HOURS_BELOW_REQUIREMENT,
                NotificationAudience.EMPLOYEE,
                "[VietDuc] Nhắc nhở: Bạn còn thiếu {{missing_hours}} giờ CME",
                """
                        Kính gửi {{recipient_name}},

                        Tổng giờ CME hiện tại của bạn là {{current_hours}}/{{required_hours}} giờ.
                        Bạn còn thiếu {{missing_hours}} giờ. Vui lòng bổ sung trước {{deadline}}.

                        Trân trọng,
                        Hệ thống VietDuc
                        """
        );
        seedTemplate(
                "CME_DEFICIT_MANAGER",
                "Cảnh báo thiếu giờ CME cho quản lý",
                NotificationCategory.TRAINING,
                NotificationEventType.CME_HOURS_BELOW_REQUIREMENT,
                NotificationAudience.MANAGER,
                "[VietDuc] Cảnh báo CME: {{employee_name}} còn thiếu {{missing_hours}} giờ",
                """
                        Kính gửi {{manager_name}},

                        Nhân viên {{employee_name}} ({{employee_code}}), khoa/phòng {{department}},
                        hiện còn thiếu {{missing_hours}} giờ CME và cần hoàn thành trước {{deadline}}.

                        Trân trọng,
                        Hệ thống VietDuc
                        """
        );
        seedTemplate(
                "EXAM_ASSIGNED_EMPLOYEE",
                "Thông báo giao bài thi mới",
                NotificationCategory.EVALUATION,
                NotificationEventType.EXAM_ASSIGNED,
                NotificationAudience.EMPLOYEE,
                "[VietDuc] Bạn được giao bài thi: {{exam_name}}",
                """
                        Kính gửi {{recipient_name}},

                        Bạn đã được giao bài thi {{exam_name}}.
                        Hạn hoàn thành: {{due_at}}. Số lần làm tối đa: {{max_attempts}}.

                        Trân trọng,
                        Hệ thống VietDuc
                        """
        );
        seedTemplate(
                "QUALITY_LOW_COMPLIANCE_MANAGER",
                "Cảnh báo tỷ lệ tuân thủ thấp",
                NotificationCategory.QUALITY,
                NotificationEventType.QUALITY_COMPLIANCE_BELOW_TARGET,
                NotificationAudience.MANAGER,
                "[VietDuc] Cảnh báo: Tỷ lệ tuân thủ {{department}} dưới mục tiêu",
                """
                        Kính gửi {{manager_name}},

                        Tỷ lệ tuân thủ của {{department}} trong {{period}} là {{compliance_rate}}%,
                        thấp hơn mức mục tiêu {{target_rate}}%.

                        Trân trọng,
                        Hệ thống VietDuc
                        """
        );
        seedTemplate(
                "PERSONAL_COMPLIANCE_EMPLOYEE",
                "Thông báo vấn đề tuân thủ cá nhân",
                NotificationCategory.QUALITY,
                NotificationEventType.PERSONAL_COMPLIANCE_ISSUE,
                NotificationAudience.EMPLOYEE,
                "[VietDuc] Kết quả tuân thủ cần lưu ý: {{form_name}}",
                """
                        Kính gửi {{recipient_name}},

                        Kết quả đánh giá {{form_name}} của bạn là {{result}}, điểm {{score}}.
                        Thời điểm ghi nhận: {{submitted_at}}. Vui lòng liên hệ quản lý để được hướng dẫn.

                        Trân trọng,
                        Hệ thống VietDuc
                        """
        );
    }

    private void seedTemplate(
            String code,
            String name,
            NotificationCategory category,
            NotificationEventType eventType,
            NotificationAudience audience,
            String subject,
            String body
    ) {
        if (templateRepository.existsByCode(code)) {
            return;
        }
        templateRepository.save(EmailTemplate.builder()
                .code(code)
                .name(name)
                .category(category)
                .eventType(eventType)
                .audience(audience)
                .subject(subject)
                .body(body)
                .mandatory(true)
                .active(true)
                .build());
    }
}
