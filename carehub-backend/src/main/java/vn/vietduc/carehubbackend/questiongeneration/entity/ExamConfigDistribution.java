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

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "exam_config_distributions",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_exam_config_distributions_category_difficulty",
                columnNames = {"exam_config_id", "category_id", "difficulty"}
        )
)
public class ExamConfigDistribution extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_config_id", nullable = false)
    private ExamConfig examConfig;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private QuestionCategory category;

    @Column(length = 32)
    private String difficulty;

    @Column(name = "question_count", nullable = false)
    private Integer questionCount;

    @Column(nullable = false)
    private Boolean required;
}
