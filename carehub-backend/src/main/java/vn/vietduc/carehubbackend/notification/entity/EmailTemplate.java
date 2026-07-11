package vn.vietduc.carehubbackend.notification.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "email_templates",
        indexes = @Index(
                name = "idx_email_templates_binding_active",
                columnList = "event_type,audience,active"
        )
)
public class EmailTemplate extends BaseEntity {
    @Column(nullable = false, unique = true, length = 80)
    private String code;

    @Column(length = 160)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private NotificationCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", length = 80)
    private NotificationEventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private NotificationAudience audience;

    @Column(nullable = false, length = 200)
    private String subject;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Column(nullable = false)
    private boolean mandatory;

    @Column(nullable = false)
    private boolean active;

    @Version
    @Column(name = "lock_version", nullable = false, columnDefinition = "BIGINT DEFAULT 0")
    private Long version;
}
