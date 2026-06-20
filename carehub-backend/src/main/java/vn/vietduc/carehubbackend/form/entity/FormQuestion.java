package vn.vietduc.carehubbackend.form.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import tools.jackson.databind.JsonNode;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.form.entity.enums.FormFieldType;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(
        name = "checklist_questions",
        indexes = {
                @Index(name = "idx_question_metric", columnList = "metric_code"),
                @Index(name = "idx_question_item", columnList = "form_item_id")
        }
)
public class ChecklistQuestion extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "form_item_id")
    private ChecklistFormItem formItem;

    @Column(nullable = false)
    private UUID questionKey;

    @Column(nullable = false)
    private String code;

    private String metricCode;

    @Column(nullable = false, columnDefinition = "text")
    private String title;

    @Column(columnDefinition = "text")
    private String helpText;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FormFieldType fieldType;

    private boolean required;

    private boolean readOnly;

    private boolean critical;

    private boolean excludeFromScore;

    private BigDecimal weight;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "validation_config", columnDefinition = "jsonb")
    private JsonNode validationConfig;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "display_config", columnDefinition = "jsonb")
    private JsonNode displayConfig;
}
