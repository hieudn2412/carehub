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

import java.math.BigDecimal;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "question_set_items",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_question_set_items_question", columnNames = {"question_set_id", "question_id"}),
                @UniqueConstraint(name = "uq_question_set_items_position", columnNames = {"question_set_id", "position"})
        }
)
public class QuestionSetItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_set_id", nullable = false)
    private QuestionSet questionSet;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private QuestionBankQuestion question;

    @Column(nullable = false)
    private Integer position;

    @Column(precision = 5, scale = 2)
    private BigDecimal points;

    @Column(nullable = false)
    private Boolean required;
}
