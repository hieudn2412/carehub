package vn.vietduc.carehubbackend.training.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.training.enums.ProfessionalFieldModerationStatus;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "professional_fields")
public class ProfessionalField extends BaseEntity {
    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Version
    @Builder.Default
    @Column(nullable = false)
    private Long version = 0L;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "moderation_status", nullable = false, length = 24)
    private ProfessionalFieldModerationStatus moderationStatus = ProfessionalFieldModerationStatus.APPROVED;

    @Column(name = "rejection_reason", columnDefinition = "text")
    private String rejectionReason;
}
