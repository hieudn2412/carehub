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
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateLabel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "document_question_candidates")
public class DocumentQuestionCandidate extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_id", nullable = false)
    private DocumentQuestionJob job;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id", nullable = false)
    private QuestionDocument document;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chunk_id", nullable = false)
    private DocumentChunk chunk;

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

    private String topic;

    @Column(length = 32)
    private String difficulty;

    @Column(name = "source_excerpt", columnDefinition = "text")
    private String sourceExcerpt;

    @Column(name = "knowledge_point_key", length = 64)
    private String knowledgePointKey;

    @Column(name = "generation_key", length = 128)
    private String generationKey;

    @Column(name = "raw_json", nullable = false, columnDefinition = "text")
    private String rawJson;

    @Column(name = "quality_score")
    private Double qualityScore;

    @Column(name = "llm_validation", columnDefinition = "text")
    private String llmValidation;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private CandidateLabel label;

    @Column(nullable = false, columnDefinition = "text")
    private String warnings;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CandidateStatus status;

    @Column(name = "duplicate_max_similarity")
    private Double duplicateMaxSimilarity;

    @Column(name = "duplicate_question_id")
    private Long duplicateQuestionId;

    @Column(name = "duplicate_question_stem_snapshot", columnDefinition = "text")
    private String duplicateQuestionStemSnapshot;

    @Column(name = "reviewer_notes", columnDefinition = "text")
    private String reviewerNotes;

    @Column(name = "saved_question_id")
    private Long savedQuestionId;
}
