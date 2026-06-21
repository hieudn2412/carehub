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
import vn.vietduc.carehubbackend.form.entity.enums.FormFieldType;
import vn.vietduc.carehubbackend.form.entity.enums.FormItemType;

import java.math.BigDecimal;
import java.util.UUID;
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
        name = "form_questions",
        indexes = {
                @Index(name = "idx_question_metric", columnList = "metadata_key"),
                @Index(name = "idx_question_version", columnList = "form_version_id")
        }
)
public class FormQuestion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "form_version_id", nullable = false)
    private FormVersion formVersion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "section_id", nullable = false)
    private FormSection section;

    @Column(nullable = false)
    private UUID itemKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private FormItemType itemType;

    @Column(name = "sort_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "item_title", length = 1000)
    private String itemTitle;

    @Column(length = 2000)
    private String description;

    @Column(length = 2000)
    private String mediaUrl;

    @Column(nullable = false)
    private UUID questionKey;

    @Column(nullable = false, length = 120)
    private String code;

    @Column(name = "metadata_key", length = 120)
    private String metricCode;

    @Column(nullable = false, length = 2000)
    private String title;

    @Column(columnDefinition = "text")
    private String helpText;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private FormFieldType fieldType;

    @Column(nullable = false)
    private boolean required;

    @Column(nullable = false)
    private boolean readOnly;

    @Column(nullable = false)
    private boolean critical;

    @Column(nullable = false)
    private boolean excludeFromScore;

    @Column(precision = 12, scale = 4)
    private BigDecimal weight;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "validation_json", columnDefinition = "jsonb")
    private Map<String, Object> validationConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "display_config", columnDefinition = "jsonb")
    private Map<String, Object> displayConfig;

    @Builder.Default
    @BatchSize(size = 50)
    @OrderBy("displayOrder ASC")
    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<FormOption> options = new ArrayList<>();
}
