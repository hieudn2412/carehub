package vn.vietduc.carehubbackend.notification.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.user.entity.User;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "notifications",
        indexes = {
                @Index(name = "idx_notifications_user_read", columnList = "user_id,is_read"),
                @Index(name = "idx_notifications_dedup", columnList = "dedup_key")
        },
        uniqueConstraints = @UniqueConstraint(name = "uq_notifications_dedup", columnNames = "dedup_key")
)
public class Notification extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 60)
    private String type;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", length = 80)
    private NotificationEventType eventType;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    private String deepLink;

    @Column(name = "is_read", nullable = false)
    private boolean read;

    private LocalDateTime readAt;

    @Column(length = 220)
    private String dedupKey;
}
