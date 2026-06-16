package vn.vietduc.carehubbackend.notification.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
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
@Table(name = "notification_configs")
public class NotificationConfig extends BaseEntity {
    @Column(nullable = false)
    private boolean inAppEnabled;

    @Column(nullable = false)
    private boolean emailEnabled;

    @Column(nullable = false)
    private int dedupWindowMinutes;

    @Column(nullable = false)
    private String alertSchedule;
}
