package vn.vietduc.carehubbackend.systemsettings.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
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
@Table(name = "system_settings")
public class SystemSetting extends BaseEntity {
    public static final String GLOBAL_SCOPE = "GLOBAL";
    public static final BigDecimal DEFAULT_TRAINING_HOURS = new BigDecimal("120");
    public static final int DEFAULT_TRAINING_WINDOW_YEARS = 5;

    @Column(name = "scope_key", nullable = false, unique = true, updatable = false, length = 30)
    private String scopeKey;

    @Column(name = "global_training_hours", nullable = false, precision = 8, scale = 2)
    private BigDecimal globalTrainingHours;

    // Kept nullable at the ORM level so ddl-auto can add this column safely to
    // databases that already contain the singleton settings row. The manual
    // migration backfills 5 and then enforces NOT NULL at the database level.
    @Column(name = "training_window_years")
    private Integer trainingWindowYears;

    @Version
    @Column(name = "lock_version", nullable = false)
    private Long lockVersion;
}
