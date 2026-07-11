package vn.vietduc.carehubbackend.notification.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;

import java.math.BigDecimal;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "notification_policies",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_notification_policy_event_type",
                columnNames = "event_type"
        )
)
public class NotificationConfig extends BaseEntity {
    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 80)
    private NotificationEventType eventType;

    @Column(nullable = false)
    private boolean enabled;

    @Column(nullable = false)
    private boolean inAppEnabled;

    @Column(nullable = false)
    private boolean emailEnabled;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NotificationCadence cadence;

    @Column(name = "threshold_percent", precision = 5, scale = 2)
    private BigDecimal thresholdPercent;

    @Version
    @Column(name = "lock_version", nullable = false)
    private Long version;
}
