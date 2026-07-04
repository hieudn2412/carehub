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
        name = "exam_paper_questions",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_exam_paper_questions_position", columnNames = {"exam_paper_id", "position"}),
                @UniqueConstraint(name = "uq_exam_paper_questions_question", columnNames = {"exam_paper_id", "question_id"})
        }
)
public class ExamPaperQuestion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_paper_id", nullable = false)
    private ExamPaper examPaper;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private QuestionBankQuestion question;

    @Column(nullable = false)
    private Integer position;

    @Column(precision = 5, scale = 2)
    private BigDecimal points;

    @Column(name = "option_order_json", columnDefinition = "text")
    private String optionOrderJson;
}
