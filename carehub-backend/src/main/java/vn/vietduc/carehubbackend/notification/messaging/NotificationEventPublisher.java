package vn.vietduc.carehubbackend.notification.messaging;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class NotificationEventPublisher {
    private final ApplicationEventPublisher publisher;

    public void publish(NotificationDispatchEvent event) {
        publisher.publishEvent(event);
    }
}
