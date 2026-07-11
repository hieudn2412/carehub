package vn.vietduc.carehubbackend.notification.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import vn.vietduc.carehubbackend.notification.entity.EmailTemplate;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;

import java.util.List;
import java.util.Optional;

public interface EmailTemplateRepository extends JpaRepository<EmailTemplate, Long>, JpaSpecificationExecutor<EmailTemplate> {
    Optional<EmailTemplate> findByCode(String code);

    boolean existsByCode(String code);

    boolean existsByCodeAndIdNot(String code, Long id);

    List<EmailTemplate> findByEventTypeAndAudienceAndActiveTrue(
            NotificationEventType eventType,
            NotificationAudience audience
    );

    Optional<EmailTemplate> findFirstByEventTypeAndAudienceAndActiveTrueOrderByUpdatedAtDesc(
            NotificationEventType eventType,
            NotificationAudience audience
    );
}
