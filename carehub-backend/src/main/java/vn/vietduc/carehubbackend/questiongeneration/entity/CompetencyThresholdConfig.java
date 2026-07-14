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
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CompetencyLevel;

import java.math.BigDecimal;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "competency_threshold_configs",
        uniqueConstraints = @UniqueConstraint(name = "uq_competency_level_category", columnNames = {"competency_level", "category_id"})
)
public class CompetencyThresholdConfig extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "competency_level", nullable = false, length = 24)
    private CompetencyLevel competencyLevel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private QuestionCategory category;

    @Column(name = "min_score", nullable = false, precision = 6, scale = 2)
    private BigDecimal minScore;

    @Column(name = "max_score", nullable = false, precision = 6, scale = 2)
    private BigDecimal maxScore;

    @Column(nullable = false, length = 100)
    private String label;

    @Column(name = "color_hex", length = 7)
    private String colorHex;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;
}
