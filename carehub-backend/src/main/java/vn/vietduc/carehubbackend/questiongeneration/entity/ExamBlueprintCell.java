package vn.vietduc.carehubbackend.questiongeneration.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;

import java.math.BigDecimal;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "exam_blueprint_cells",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_exam_blueprint_cells_field_cognitive",
                columnNames = {"blueprint_field_id", "cognitive_level"}
        )
)
public class ExamBlueprintCell extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "blueprint_field_id", nullable = false)
    private ExamBlueprintField blueprintField;

    @Enumerated(EnumType.STRING)
    @Column(name = "cognitive_level", nullable = false, length = 48)
    private CognitiveLevel cognitiveLevel;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal percentage;

    @Column(name = "question_count", nullable = false)
    private Integer questionCount;
}
