package vn.vietduc.carehubbackend.questiongeneration.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "questions")
public class QuestionBankQuestion extends BaseEntity {

    @Column(nullable = false, columnDefinition = "text")
    private String stem;

    /** Canonical taxonomy link. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private QuestionCategory category;

    /** The examination domain is owned by the question, not by its category. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "professional_field_id", nullable = false)
    private ProfessionalField professionalField;

    @Enumerated(EnumType.STRING)
    @Column(name = "cognitive_level", length = 48)
    private CognitiveLevel cognitiveLevel;

    @Column(name = "cognitive_verified_at")
    private LocalDateTime cognitiveVerifiedAt;

    @Column(name = "cognitive_verified_by", length = 100)
    private String cognitiveVerifiedBy;

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

    @Column(nullable = false, length = 16)
    private String language;

    @Column(name = "source_document")
    private String sourceDocument;

    /** Stable provenance link; sourceDocument remains as the legacy label/audit value. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_document_id")
    private QuestionDocument sourceDocumentRef;

    @Enumerated(EnumType.STRING)
    @Column(name = "question_type", nullable = false, length = 16)
    private QuestionType questionType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_question_id")
    private QuestionBankQuestion parentQuestion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private QuestionBankStatus status;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "reviewed_by", length = 100)
    private String reviewedBy;
}
