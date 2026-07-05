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
        name = "question_set_version_items",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_question_set_version_items_position",
                columnNames = {"question_set_version_id", "position"}
        )
)
public class QuestionSetVersionItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_set_version_id", nullable = false)
    private QuestionSetVersion questionSetVersion;

    @Column(name = "source_question_id", nullable = false)
    private Long sourceQuestionId;

    @Column(nullable = false)
    private Integer position;

    @Column(precision = 5, scale = 2)
    private BigDecimal points;

    @Column(nullable = false)
    private Boolean required;

    @Column(nullable = false, columnDefinition = "text")
    private String stem;

    @Column(name = "option_a", nullable = false, columnDefinition = "text")
    private String optionA;

    @Column(name = "option_b", nullable = false, columnDefinition = "text")
    private String optionB;

    @Column(name = "option_c", nullable = false, columnDefinition = "text")
    private String optionC;

    @Column(name = "option_d", nullable = false, columnDefinition = "text")
    private String optionD;

    @Column(name = "correct_answer", nullable = false, length = 1)
    private String correctAnswer;

    @Column(columnDefinition = "text")
    private String explanation;

    @Column(length = 32)
    private String difficulty;

    private String topic;

    @Column(name = "source_document")
    private String sourceDocument;
}
