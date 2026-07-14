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
        name = "question_embeddings",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_question_embeddings_input",
                columnNames = {"question_id", "text_type", "embedding_model", "input_text_hash"}
        )
)
public class QuestionEmbedding extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private QuestionBankQuestion question;

    @Column(name = "text_type", nullable = false, length = 32)
    private String textType;

    @Column(name = "embedding_model", nullable = false)
    private String embeddingModel;

    @Column(name = "embedding_dimension", nullable = false)
    private Integer embeddingDimension;

    @Column(name = "input_text_hash", nullable = false, length = 64)
    private String inputTextHash;

    @Column(name = "normalized_text", nullable = false, columnDefinition = "text")
    private String normalizedText;

    @Column(nullable = false, columnDefinition = "text")
    private String vectorJson;

    @Column(columnDefinition = "bytea")
    private byte[] vector;
}
