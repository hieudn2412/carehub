package vn.vietduc.carehubbackend.form.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.user.entity.User;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "form_versions",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_form_version",
                        columnNames = {"form_template_id", "version_no"}
                )
        }
)
public class FormVersion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "form_template_id")
    private Form form;

    @Column(name = "version_no", nullable = false)
    private Integer versionNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FormVersionStatus status;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "schema_json", columnDefinition = "jsonb")
    private Map<String, Object> schemaJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "settings_json", columnDefinition = "jsonb")
    private Map<String, Object> settingsJson;

    @Column(name = "passing_score_override", precision = 4, scale = 1)
    private BigDecimal passingScoreOverride;

    @Column(length = 64)
    private String schemaHash;

    private Instant publishedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User publishedBy;

    @Builder.Default
    @BatchSize(size = 50)
    @OrderBy("displayOrder ASC")
    @OneToMany(mappedBy = "formVersion", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<FormSection> sections = new ArrayList<>();

    @Version
    private Long lockVersion;
}
