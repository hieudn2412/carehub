package vn.vietduc.carehubbackend.questiongeneration.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
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
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;

import java.math.BigDecimal;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "exam_blueprint_fields",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_exam_blueprint_fields_config_field",
                columnNames = {"exam_config_id", "professional_field_id"}
        )
)
public class ExamBlueprintField extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_config_id", nullable = false)
    private ExamConfig examConfig;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "professional_field_id", nullable = false)
    private ProfessionalField professionalField;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal percentage;

    @Column(name = "question_count", nullable = false)
    private Integer questionCount;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "passing_threshold", precision = 5, scale = 2)
    private BigDecimal passingThreshold;
}
