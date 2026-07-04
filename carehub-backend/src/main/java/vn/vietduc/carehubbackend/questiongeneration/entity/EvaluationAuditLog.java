package vn.vietduc.carehubbackend.questiongeneration.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
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
        name = "evaluation_audit_logs",
        indexes = {
                @Index(name = "idx_evaluation_audit_action", columnList = "action"),
                @Index(name = "idx_evaluation_audit_entity", columnList = "entity_type, entity_id"),
                @Index(name = "idx_evaluation_audit_actor", columnList = "actor"),
                @Index(name = "idx_evaluation_audit_created_at", columnList = "created_at")
        }
)
public class EvaluationAuditLog extends BaseEntity {

    @Column(nullable = false, length = 80)
    private String action;

    @Column(name = "entity_type", nullable = false, length = 80)
    private String entityType;

    @Column(name = "entity_id")
    private Long entityId;

    @Column(length = 120)
    private String actor;

    @Column(columnDefinition = "text")
    private String summary;

    @Column(name = "detail_json", columnDefinition = "text")
    private String detailJson;
}
