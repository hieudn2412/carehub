package vn.vietduc.carehubbackend.notification.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.notification.entity.EmailTemplate;

import java.util.Optional;

public interface EmailTemplateRepository extends JpaRepository<EmailTemplate, Long> {
    Optional<EmailTemplate> findByCode(String code);

    boolean existsByCode(String code);

    Page<EmailTemplate> findByCodeContainingIgnoreCaseOrSubjectContainingIgnoreCase(String code, String subject, Pageable pageable);
}
