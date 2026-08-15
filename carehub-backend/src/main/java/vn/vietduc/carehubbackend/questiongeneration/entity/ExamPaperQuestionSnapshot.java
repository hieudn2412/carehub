package vn.vietduc.carehubbackend.questiongeneration.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "exam_paper_question_snapshots")
public class ExamPaperQuestionSnapshot extends BaseEntity {

    @Column(name = "source_question_id")
    private Long sourceQuestionId;

    @Column(name = "question_family_id")
    private Long questionFamilyId;

    @Column(name = "question_position")
    private Integer questionPosition;

    @Column(name = "option_order_json", columnDefinition = "text")
    private String optionOrderJson;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_paper_question_id", nullable = false, unique = true)
    private ExamPaperQuestion examPaperQuestion;

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

    @Column(name = "category_id")
    private Long categoryId;

    @Column(name = "category_code")
    private String categoryCode;

    @Column(name = "category_name")
    private String categoryName;

    @Column(name = "professional_field_id")
    private Long professionalFieldId;

    @Column(name = "professional_field_code")
    private String professionalFieldCode;

    @Column(name = "professional_field_name")
    private String professionalFieldName;

    @Column(name = "cognitive_level", length = 48)
    private String cognitiveLevel;

    @Column(name = "cognitive_label", length = 128)
    private String cognitiveLabel;

    @Column(name = "cognitive_verified_at")
    private LocalDateTime cognitiveVerifiedAt;

    @Column(name = "cognitive_verified_by", length = 100)
    private String cognitiveVerifiedBy;

    @Column(name = "source_document_id")
    private Long sourceDocumentId;

    @Column(name = "source_document_filename")
    private String sourceDocumentFilename;

    @Column(name = "source_document_title")
    private String sourceDocumentTitle;

    @Column(name = "source_document_content_hash", length = 64)
    private String sourceDocumentContentHash;

    @Column(name = "source_document")
    private String sourceDocument;

    @Column(name = "config_version")
    private Integer configVersion;

    @Column(name = "paper_seed")
    private Long paperSeed;

    @Column(name = "generation_algorithm_version", length = 48)
    private String generationAlgorithmVersion;

    @Column(name = "generation_pool_checksum", length = 128)
    private String generationPoolChecksum;

    @Column(name = "generated_by", length = 100)
    private String generatedBy;

    @Column(name = "generated_at")
    private LocalDateTime generatedAt;

    @Column(name = "snapshot_at", nullable = false)
    private LocalDateTime snapshotAt;
}
