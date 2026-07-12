package vn.vietduc.carehubbackend.notification.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.UnprocessableEntityException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.notification.entity.Notification;
import vn.vietduc.carehubbackend.notification.repository.NotificationRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {
    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SecurityUtils securityUtils;

    private NotificationService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new NotificationService(notificationRepository, userRepository, securityUtils);
        user = User.builder().id(4L).employeeCode("EMP004").name("Employee Four").build();
        lenient().when(securityUtils.getCurrentUserId()).thenReturn(4L);
    }

    @Test
    void listNotificationsNormalizesQueryAndCapsSupportedPageSize() {
        Notification notification = notification("INFO", "Training due", "Please update");
        when(notificationRepository.findScoped(eq(4L), isNull(), eq(false), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(notification), PageRequest.of(0, 20), 1));

        var page = service.getCurrentUserNotifications("%", false, PageRequest.of(0, 20));

        assertEquals(1, page.getTotalElements());
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(notificationRepository).findScoped(eq(4L), isNull(), eq(false), pageableCaptor.capture());
        assertEquals(20, pageableCaptor.getValue().getPageSize());
        assertTrue(pageableCaptor.getValue().getSort().getOrderFor("createdAt").isDescending());

        assertThrows(
                ValidationException.class,
                () -> service.getCurrentUserNotifications(null, null, PageRequest.of(0, 101))
        );
    }

    @Test
    void readActionsAreScopedToCurrentUser() {
        Notification notification = notification("INFO", "Training due", "Please update");
        when(notificationRepository.findByIdAndUser_Id(12L, 4L)).thenReturn(Optional.of(notification));

        var response = service.setCurrentUserNotificationRead(12L, true);

        assertTrue(response.read());
        assertNotNull(notification.getReadAt());

        service.setCurrentUserNotificationRead(12L, false);
        assertFalse(notification.isRead());
        assertNull(notification.getReadAt());
    }

    @Test
    void actionRejectsUnsupportedAction() {
        assertThrows(
                UnprocessableEntityException.class,
                () -> service.actionCurrentUserNotification(12L, "ARCHIVE")
        );
    }

    @Test
    void createInAppNotificationSkipsDuplicateDedupKey() {
        when(notificationRepository.existsByDedupKey("dedup-1")).thenReturn(true);

        assertNull(service.createInAppNotification(4L, "INFO", "Title", "Body", null, "dedup-1"));

        verify(notificationRepository, never()).save(any());
    }

    @Test
    void createInAppNotificationUsesInfoTypeByDefaultAndPersistsUnreadNotification() {
        when(notificationRepository.existsByDedupKey("dedup-2")).thenReturn(false);
        when(userRepository.findById(4L)).thenReturn(Optional.of(user));
        when(notificationRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.createInAppNotification(4L, null, "Title", "Body", "/deep", "dedup-2");

        assertEquals("INFO", response.type());
        assertFalse(response.read());
        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(captor.capture());
        assertSame(user, captor.getValue().getUser());
        assertEquals("dedup-2", captor.getValue().getDedupKey());
    }

    @Test
    void createInAppNotificationFailsWhenRecipientMissing() {
        when(userRepository.findById(4L)).thenReturn(Optional.empty());

        assertThrows(
                ResourceNotFoundException.class,
                () -> service.createInAppNotification(4L, "INFO", "Title", "Body", null, null)
        );
    }

    private Notification notification(String type, String title, String content) {
        return Notification.builder()
                .id(12L)
                .user(user)
                .type(type)
                .title(title)
                .content(content)
                .read(false)
                .build();
    }
}
