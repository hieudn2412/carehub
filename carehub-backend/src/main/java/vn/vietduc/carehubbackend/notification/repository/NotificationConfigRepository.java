package vn.vietduc.carehubbackend.notification.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.notification.entity.NotificationConfig;

public interface NotificationConfigRepository extends JpaRepository<NotificationConfig, Long> {
}
