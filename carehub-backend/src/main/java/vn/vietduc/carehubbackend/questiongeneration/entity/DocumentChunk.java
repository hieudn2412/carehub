package vn.vietduc.carehubbackend.questiongeneration.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.DocumentChunkType;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "document_chunks",
        uniqueConstraints = @UniqueConstraint(name = "uq_document_chunks_position", columnNames = {"document_id", "chunk_index"})
)
public class DocumentChunk extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id", nullable = false)
    private QuestionDocument document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "section_id")
    private DocumentSection section;

    @Column(name = "parent_chunk_id")
    private Long parentChunkId;

    @Column(name = "chunk_index", nullable = false)
    private Integer chunkIndex;

    @Enumerated(EnumType.STRING)
    @Column(name = "chunk_type", nullable = false, length = 32)
    private DocumentChunkType chunkType;

    @Column(name = "page_start")
    private Integer pageStart;

    @Column(name = "page_end")
    private Integer pageEnd;

    @Column(name = "section_title")
    private String sectionTitle;

    @Column(name = "section_path", length = 1000)
    private String sectionPath;

    @Column(nullable = false, columnDefinition = "text")
    private String text;

    @Column(name = "text_hash", nullable = false, length = 64)
    private String textHash;

    @Column(name = "char_count", nullable = false)
    private Integer charCount;

    @Column(name = "token_count", nullable = false)
    private Integer tokenCount;

    @Column(name = "quality_flags", nullable = false, columnDefinition = "text")
    private String qualityFlags;

    @Column(name = "previous_chunk_id")
    private Long previousChunkId;

    @Column(name = "next_chunk_id")
    private Long nextChunkId;
}
