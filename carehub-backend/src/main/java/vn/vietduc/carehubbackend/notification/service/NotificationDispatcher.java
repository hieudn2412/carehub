package vn.vietduc.carehubbackend.notification.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.notification.messaging.EmailMessage;
import vn.vietduc.carehubbackend.notification.messaging.EmailProducer;
import vn.vietduc.carehubbackend.notification.messaging.NotificationDispatchEvent;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationDispatcher {
    private final NotificationPolicyService policyService;
    private final NotificationService notificationService;
    private final EmailTemplateService emailTemplateService;
    private final EmailProducer emailProducer;
    private final UserRepository userRepository;

    public void dispatch(NotificationDispatchEvent event) {
        if (event == null || event.eventType() == null || event.userId() == null) {
            return;
        }
        var policy = policyService.getPolicy(event.eventType());
        if (!policy.isEnabled()) {
            return;
        }
        User recipient = userRepository.findByIdAndIsDeletedFalse(event.userId()).orElse(null);
        if (recipient == null) {
            log.warn("Notification recipient {} is unavailable for {}", event.userId(), event.eventType());
            return;
        }
        String dedupKey = normalizedDedupKey(event);
        if (policy.isInAppEnabled()) {
            var created = notificationService.createInAppNotification(
                    recipient.getId(),
                    event.eventType(),
                    event.severity(),
                    event.title(),
                    event.content(),
                    event.deepLink(),
                    dedupKey
            );
            if (created == null) {
                return;
            }
        }
        if (!policy.isEmailEnabled() || recipient.getEmail() == null || recipient.getEmail().isBlank()) {
            return;
        }
        Map<String, String> variables = enrichVariables(event.variables(), recipient);
        emailTemplateService.renderActive(event.eventType(), event.audience(), variables)
                .ifPresentOrElse(rendered -> emailProducer.sendEmail(EmailMessage.builder()
                                .userId(recipient.getId())
                                .templateCode(rendered.templateCode())
                                .to(recipient.getEmail())
                                .subject(rendered.subject())
                                .content(rendered.body())
                                .type(event.severity())
                                .deepLink(event.deepLink())
                                .dedupKey(dedupKey)
                                .build()),
                        () -> log.warn("No active email template for {} / {}", event.eventType(), event.audience()));
    }

    private Map<String, String> enrichVariables(Map<String, String> input, User recipient) {
        Map<String, String> variables = new LinkedHashMap<>();
        if (input != null) {
            variables.putAll(input);
        }
        variables.putIfAbsent("recipient_name", recipient.getName());
        variables.putIfAbsent("employee_name", recipient.getName());
        variables.putIfAbsent("employee_code", recipient.getEmployeeCode());
        variables.putIfAbsent("department", recipient.getDepartment() == null ? "" : recipient.getDepartment().getName());
        variables.putIfAbsent("manager_name", recipient.getName());
        return variables;
    }

    private String normalizedDedupKey(NotificationDispatchEvent event) {
        String key = event.dedupKey();
        if (key == null || key.isBlank()) {
            key = event.eventType() + ":" + event.userId() + ":" + System.currentTimeMillis();
        }
        String scoped = event.userId() + ":" + key;
        return scoped.length() <= 220 ? scoped : scoped.substring(0, 220);
    }
}
