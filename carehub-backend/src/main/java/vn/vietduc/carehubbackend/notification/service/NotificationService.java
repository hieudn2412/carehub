package vn.vietduc.carehubbackend.notification.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.UnprocessableEntityException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.notification.dto.NotificationResponse;
import vn.vietduc.carehubbackend.notification.entity.Notification;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;
import vn.vietduc.carehubbackend.notification.repository.NotificationRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private static final int MAX_PAGE_SIZE = 100;

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SecurityUtils securityUtils;

    @Transactional(readOnly = true)
    public Page<NotificationResponse> getCurrentUserNotifications(String q, Boolean read, Pageable pageable) {
        Long userId = securityUtils.getCurrentUserId();
        String normalizedQ = q == null || q.isBlank() || "%".equals(q.trim()) ? null : q.trim();
        return notificationRepository.findScoped(userId, normalizedQ, read, normalizePageable(pageable))
                .map(NotificationResponse::from);
    }

    @Transactional(readOnly = true)
    public NotificationResponse getCurrentUserNotification(Long id) {
        return NotificationResponse.from(findCurrentUserNotification(id));
    }

    @Transactional
    public NotificationResponse setCurrentUserNotificationRead(Long id, boolean read) {
        Notification notification = findCurrentUserNotification(id);
        applyReadStatus(notification, read);
        return NotificationResponse.from(notification);
    }

    @Transactional
    public NotificationResponse actionCurrentUserNotification(Long id, String action) {
        if ("MARK_READ".equalsIgnoreCase(action)) {
            return setCurrentUserNotificationRead(id, true);
        }
        if ("MARK_UNREAD".equalsIgnoreCase(action)) {
            return setCurrentUserNotificationRead(id, false);
        }
        throw new UnprocessableEntityException("Unsupported notification action");
    }

    @Transactional
    public int setAllCurrentUserNotificationsRead(boolean read) {
        Long userId = securityUtils.getCurrentUserId();
        return notificationRepository.updateReadStatusForUser(
                userId,
                read,
                read ? LocalDateTime.now() : null
        );
    }

    @Transactional(readOnly = true)
    public long countCurrentUserUnreadNotifications() {
        return notificationRepository.countByUser_IdAndReadFalse(securityUtils.getCurrentUserId());
    }

    @Transactional
    public void deleteCurrentUserNotification(Long id) {
        notificationRepository.delete(findCurrentUserNotification(id));
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
        return createInAppNotification(userId, null, type, title, content, deepLink, dedupKey);
    }

    @Transactional
    public NotificationResponse createInAppNotification(
            Long userId,
            NotificationEventType eventType,
            String type,
            String title,
            String content,
            String deepLink,
            String dedupKey
    ) {
        if (dedupKey != null && !dedupKey.isBlank() && notificationRepository.existsByDedupKey(dedupKey)) {
            return null;
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification recipient not found"));
        Notification notification = Notification.builder()
                .user(user)
                .eventType(eventType)
                .type(type == null || type.isBlank() ? "INFO" : type)
                .title(title)
                .content(content)
                .deepLink(deepLink)
                .dedupKey(dedupKey)
                .read(false)
                .build();
        return NotificationResponse.from(notificationRepository.save(notification));
    }

    private void applyReadStatus(Notification notification, boolean read) {
        notification.setRead(read);
        notification.setReadAt(read ? LocalDateTime.now() : null);
    }

    private Notification findCurrentUserNotification(Long id) {
        return notificationRepository.findByIdAndUser_Id(id, securityUtils.getCurrentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
    }

    private Pageable normalizePageable(Pageable pageable) {
        int size = pageable.getPageSize();
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw ValidationException.field("size", "Page size must be between 1 and " + MAX_PAGE_SIZE);
        }
        return PageRequest.of(Math.max(0, pageable.getPageNumber()), size, Sort.by(Sort.Order.desc("createdAt")));
    }
}
