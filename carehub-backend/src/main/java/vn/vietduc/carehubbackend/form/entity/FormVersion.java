package vn.vietduc.carehubbackend.form.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import tools.jackson.databind.JsonNode;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.user.entity.User;

import java.time.Instant;

@Entity
@Table(
        name = "checklist_form_versions",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_form_version",
                        columnNames = {"form_id", "version_number"}
                )
        }
)
public class ChecklistFormVersion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "form_id")
    private ChecklistForm form;

    @Column(nullable = false)
    private Integer versionNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FormVersionStatus status;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "schema_json", columnDefinition = "jsonb")
    private JsonNode schemaJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "settings_json", columnDefinition = "jsonb")
    private JsonNode settingsJson;

    private String schemaHash;

    private Instant publishedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    private User publishedBy;

    @Version
    private Long lockVersion;
}
