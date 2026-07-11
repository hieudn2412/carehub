package vn.vietduc.carehubbackend.notification.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.notification.entity.NotificationConfig;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;

import java.util.List;
import java.util.Optional;

public interface NotificationConfigRepository extends JpaRepository<NotificationConfig, Long> {
    Optional<NotificationConfig> findByEventType(NotificationEventType eventType);

    List<NotificationConfig> findAllByOrderByEventTypeAsc();
}
