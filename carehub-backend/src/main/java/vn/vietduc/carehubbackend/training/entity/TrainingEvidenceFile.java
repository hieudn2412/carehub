package vn.vietduc.carehubbackend.training.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.user.entity.User;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "training_evidence_files", indexes = {
    @Index(columnList = "training_record_id, is_active"),
    @Index(columnList = "moderation_status")
})
public class TrainingEvidenceFile extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "training_record_id", nullable = false)
    private TrainingRecord trainingRecord;

    @Column(name = "original_filename", nullable = false, length = 500)
    private String originalFilename;

    @Column(name = "object_key", columnDefinition = "text")
    private String objectKey;

    @Column(name = "legacy_external_url", columnDefinition = "text")
    private String legacyExternalUrl;

    @Column(name = "mime_type", length = 100)
    private String mimeType;

    @Column(name = "file_size_bytes")
    private Long fileSizeBytes;

    @Column(name = "checksum_sha256", length = 64)
    private String checksumSha256;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "moderation_status", nullable = false, length = 30)
    private EvidenceModerationStatus moderationStatus = EvidenceModerationStatus.NOT_REQUESTED;

    @Column(name = "moderation_provider", length = 100)
    private String moderationProvider;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "moderation_result", columnDefinition = "jsonb")
    private Map<String, Object> moderationResult;

    @Column(name = "moderation_checked_at")
    private LocalDateTime moderationCheckedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_user_id", nullable = false)
    private User uploadedByUser;

    @Builder.Default
    @Column(name = "uploaded_at", nullable = false)
    private LocalDateTime uploadedAt = LocalDateTime.now();

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
}
