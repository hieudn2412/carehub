package vn.vietduc.carehubbackend.form.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.form.entity.enums.ChecklistFormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.ChecklistSubjectType;
import vn.vietduc.carehubbackend.user.entity.Department;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "checklist_forms")
public class ChecklistForm extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ChecklistSubjectType subjectType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ChecklistFormStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    private Department ownerDepartment;

    @ManyToOne(fetch = FetchType.LAZY)
    private ChecklistFormVersion currentPublishedVersion;

    private boolean deleted;
}