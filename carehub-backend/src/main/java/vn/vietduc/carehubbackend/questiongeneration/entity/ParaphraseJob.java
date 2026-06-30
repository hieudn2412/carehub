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
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ParaphraseJobStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ParaphraseMode;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "paraphrase_jobs")
public class ParaphraseJob extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "source_question_id", nullable = false)
    private QuestionBankQuestion sourceQuestion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ParaphraseMode mode;

    @Column(name = "target_language", nullable = false, length = 16)
    private String targetLanguage;

    @Column(name = "requested_count", nullable = false)
    private Integer requestedCount;

    @Column(name = "change_strength", nullable = false, length = 16)
    private String changeStrength;

    @Column(nullable = false, length = 32)
    private String provider;

    @Column(nullable = false)
    private String model;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ParaphraseJobStatus status;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "created_by", length = 100)
    private String createdBy;
}
