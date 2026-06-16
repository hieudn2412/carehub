package vn.vietduc.carehubbackend.notification.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.UnprocessableEntityException;
import vn.vietduc.carehubbackend.notification.dto.EmailTemplateRequest;
import vn.vietduc.carehubbackend.notification.dto.EmailTemplateResponse;
import vn.vietduc.carehubbackend.notification.dto.NotificationConfigRequest;
import vn.vietduc.carehubbackend.notification.dto.NotificationConfigResponse;
import vn.vietduc.carehubbackend.notification.dto.NotificationResponse;
import vn.vietduc.carehubbackend.notification.entity.EmailTemplate;
import vn.vietduc.carehubbackend.notification.entity.Notification;
import vn.vietduc.carehubbackend.notification.entity.NotificationConfig;
import vn.vietduc.carehubbackend.notification.messaging.EmailMessage;
import vn.vietduc.carehubbackend.notification.repository.EmailTemplateRepository;
import vn.vietduc.carehubbackend.notification.repository.NotificationConfigRepository;
import vn.vietduc.carehubbackend.notification.repository.NotificationRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private static final Set<String> SUPPORTED_PLACEHOLDERS = Set.of(
            "userName",
            "employeeCode",
            "otp",
            "resetLink",
            "title",
            "content",
            "deadline",
            "managerName"
    );
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_]+)\\s*}}");

    private final NotificationRepository notificationRepository;
    private final NotificationConfigRepository notificationConfigRepository;
    private final EmailTemplateRepository emailTemplateRepository;
    private final UserRepository userRepository;
    private final SecurityUtils securityUtils;

    @Transactional(readOnly = true)
    public Page<NotificationResponse> getCurrentUserNotifications(String q, Boolean read, Pageable pageable) {
        Long userId = securityUtils.getCurrentUserId();
        String normalizedQ = q == null || q.isBlank() ? null : q.trim();
        return notificationRepository.findScoped(userId, normalizedQ, read, pageable)
                .map(NotificationResponse::from);
    }

    @Transactional
    public NotificationResponse getCurrentUserNotification(Long id) {
        Notification notification = findCurrentUserNotification(id);
        if (!notification.isRead()) {
            notification.setRead(true);
            notification.setReadAt(LocalDateTime.now());
        }
        return NotificationResponse.from(notification);
    }

    @Transactional
    public NotificationResponse actionCurrentUserNotification(Long id, String action) {
        Notification notification = findCurrentUserNotification(id);
        if ("MARK_READ".equalsIgnoreCase(action)) {
            notification.setRead(true);
            notification.setReadAt(LocalDateTime.now());
        } else if ("MARK_UNREAD".equalsIgnoreCase(action)) {
            notification.setRead(false);
            notification.setReadAt(null);
        } else {
            throw new UnprocessableEntityException("Unsupported notification action");
        }
        return NotificationResponse.from(notification);
    }

    @Transactional
    public void deleteCurrentUserNotification(Long id) {
        Notification notification = findCurrentUserNotification(id);
        notificationRepository.delete(notification);
    }

    @Transactional
    public NotificationResponse createInAppNotification(
            Long userId,
            String type,
            String title,
            String content,
            String deepLink,
            String dedupKey
    ) {
        NotificationConfig config = getOrCreateConfigEntity();
        if (!config.isInAppEnabled()) {
            return null;
        }
        if (dedupKey != null && !dedupKey.isBlank() && notificationRepository.existsByDedupKey(dedupKey)) {
            return null;
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification recipient not found"));

        Notification notification = Notification.builder()
                .user(user)
                .type(type == null || type.isBlank() ? "SYSTEM" : type)
                .title(title)
                .content(content)
                .deepLink(deepLink)
                .dedupKey(dedupKey)
                .read(false)
                .build();

        return NotificationResponse.from(notificationRepository.save(notification));
    }

    @Transactional
    public boolean isEmailEnabled() {
        return getOrCreateConfigEntity().isEmailEnabled();
    }

    @Transactional
    public NotificationConfigResponse getConfig() {
        return NotificationConfigResponse.from(getOrCreateConfigEntity());
    }

    @Transactional
    public NotificationConfigResponse updateConfig(NotificationConfigRequest request) {
        NotificationConfig config = getOrCreateConfigEntity();
        config.setInAppEnabled(request.isInAppEnabled());
        config.setEmailEnabled(request.isEmailEnabled());
        config.setDedupWindowMinutes(request.getDedupWindowMinutes());
        config.setAlertSchedule(request.getAlertSchedule());
        return NotificationConfigResponse.from(notificationConfigRepository.save(config));
    }

    @Transactional(readOnly = true)
    public Page<EmailTemplateResponse> getEmailTemplates(String q, Pageable pageable) {
        if (q == null || q.isBlank()) {
            return emailTemplateRepository.findAll(pageable).map(EmailTemplateResponse::from);
        }
        return emailTemplateRepository.findByCodeContainingIgnoreCaseOrSubjectContainingIgnoreCase(q, q, pageable)
                .map(EmailTemplateResponse::from);
    }

    @Transactional(readOnly = true)
    public EmailTemplateResponse getEmailTemplate(Long id) {
        return EmailTemplateResponse.from(findEmailTemplate(id));
    }

    @Transactional
    public EmailTemplateResponse createEmailTemplate(EmailTemplateRequest request) {
        validatePlaceholders(request.getSubject());
        validatePlaceholders(request.getBody());
        if (emailTemplateRepository.existsByCode(request.getCode())) {
            throw new ConflictException("Email template code already exists");
        }

        EmailTemplate template = EmailTemplate.builder()
                .code(request.getCode())
                .subject(request.getSubject())
                .body(request.getBody())
                .mandatory(request.isMandatory())
                .active(request.isActive())
                .build();

        return EmailTemplateResponse.from(emailTemplateRepository.save(template));
    }

    @Transactional
    public EmailTemplateResponse updateEmailTemplate(Long id, EmailTemplateRequest request) {
        validatePlaceholders(request.getSubject());
        validatePlaceholders(request.getBody());

        EmailTemplate template = findEmailTemplate(id);
        if (!template.getCode().equals(request.getCode()) && emailTemplateRepository.existsByCode(request.getCode())) {
            throw new ConflictException("Email template code already exists");
        }
        if (template.isMandatory() && !request.isActive()) {
            throw new ConflictException("Mandatory email templates cannot be disabled");
        }

        template.setCode(request.getCode());
        template.setSubject(request.getSubject());
        template.setBody(request.getBody());
        template.setMandatory(request.isMandatory());
        template.setActive(request.isActive());

        return EmailTemplateResponse.from(emailTemplateRepository.save(template));
    }

    @Transactional
    public void deleteEmailTemplate(Long id) {
        EmailTemplate template = findEmailTemplate(id);
        if (template.isMandatory()) {
            throw new ConflictException("Mandatory email templates cannot be deleted");
        }
        emailTemplateRepository.delete(template);
    }

    public String defaultDedupKey(EmailMessage message) {
        if (message.getDedupKey() != null && !message.getDedupKey().isBlank()) {
            return message.getDedupKey();
        }
        if (message.getUserId() == null) {
            return null;
        }
        NotificationConfig config = getOrCreateConfigEntity();
        long window = Math.max(1, config.getDedupWindowMinutes());
        long bucket = System.currentTimeMillis() / (window * 60_000L);
        return message.getUserId() + ":" + safe(message.getTemplateCode()) + ":" + safe(message.getSubject()) + ":" + bucket;
    }

    private Notification findCurrentUserNotification(Long id) {
        Long userId = securityUtils.getCurrentUserId();
        return notificationRepository.findByIdAndUser_Id(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
    }

    private EmailTemplate findEmailTemplate(Long id) {
        return emailTemplateRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Email template not found"));
    }

    private NotificationConfig getOrCreateConfigEntity() {
        return notificationConfigRepository.findAll().stream()
                .findFirst()
                .orElseGet(() -> notificationConfigRepository.save(NotificationConfig.builder()
                        .inAppEnabled(true)
                        .emailEnabled(true)
                        .dedupWindowMinutes(60)
                        .alertSchedule("EVERY_15_MIN")
                        .build()));
    }

    private void validatePlaceholders(String value) {
        Matcher matcher = PLACEHOLDER_PATTERN.matcher(value);
        while (matcher.find()) {
            String placeholder = matcher.group(1);
            if (!SUPPORTED_PLACEHOLDERS.contains(placeholder)) {
                throw new UnprocessableEntityException("Unsupported placeholder: " + placeholder);
            }
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.replace(':', '_');
    }
}
