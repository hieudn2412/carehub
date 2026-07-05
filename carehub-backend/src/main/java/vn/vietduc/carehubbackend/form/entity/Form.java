package vn.vietduc.carehubbackend.form.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;
import vn.vietduc.carehubbackend.user.entity.Department;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "form_templates", indexes = {
        @Index(name = "idx_form_template_dashboard_status", columnList = "deleted,status,owner_department_id"),
        @Index(name = "idx_form_template_updated", columnList = "updated_at,created_at")
})
public class Form extends BaseEntity {

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FormSubjectType subjectType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FormStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_department_id")
    private Department ownerDepartment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_published_version_id")
    private FormVersion currentPublishedVersion;

    @Builder.Default
    @Column(name = "current_version_no", nullable = false)
    private Integer currentVersionNumber = 0;

    @Builder.Default
    @Column(nullable = false)
    private boolean deleted = false;
}
