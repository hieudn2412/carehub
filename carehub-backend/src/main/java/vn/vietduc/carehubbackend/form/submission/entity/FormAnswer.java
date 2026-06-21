package vn.vietduc.carehubbackend.form.submission.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.form.entity.FormOption;
import vn.vietduc.carehubbackend.form.entity.FormQuestion;

import java.math.BigDecimal;
import java.util.Map;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "form_answers", uniqueConstraints = {
        @UniqueConstraint(name = "uk_form_answer_question", columnNames = {"submission_id", "question_id"})
})
public class FormAnswer extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_id", nullable = false)
    private FormSubmission submission;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private FormQuestion question;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "option_id")
    private FormOption selectedOption;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "answer_json", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> answerJson;

    @Column(name = "score", precision = 20, scale = 8)
    private BigDecimal scoreValue;

    @Column(name = "weight", precision = 20, scale = 8)
    private BigDecimal weight;

    @Column(name = "weighted_score", precision = 20, scale = 8)
    private BigDecimal weightedScore;

    @Column(nullable = false)
    private boolean critical;

    @Column(name = "excluded_from_score", nullable = false)
    private boolean excludedFromScore;
}
