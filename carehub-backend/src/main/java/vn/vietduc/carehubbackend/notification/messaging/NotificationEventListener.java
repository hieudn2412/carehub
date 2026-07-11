package vn.vietduc.carehubbackend.notification.messaging;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import vn.vietduc.carehubbackend.notification.service.NotificationDispatcher;

@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationEventListener {
    private final NotificationDispatcher dispatcher;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onNotificationEvent(NotificationDispatchEvent event) {
        try {
            dispatcher.dispatch(event);
        } catch (Exception ex) {
            log.error("Failed to dispatch notification event {} for user {}", event.eventType(), event.userId(), ex);
        }
    }
}
