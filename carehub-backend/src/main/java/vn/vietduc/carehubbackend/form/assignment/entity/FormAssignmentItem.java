package vn.vietduc.carehubbackend.form.assignment.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.FormVersion;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "form_assignment_items", indexes = {
        @Index(name = "idx_form_assignment_item_version", columnList = "form_version_id"),
        @Index(name = "idx_form_assignment_item_status", columnList = "assignment_id,status"),
        @Index(name = "idx_form_assignment_item_dashboard_form", columnList = "form_template_id,status"),
        @Index(name = "idx_form_assignment_item_dashboard_version", columnList = "form_version_id,status")
})
public class FormAssignmentItem extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignment_id", nullable = false)
    private FormAssignment assignment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "form_template_id", nullable = false)
    private Form form;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "form_version_id", nullable = false)
    private FormVersion formVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FormAssignmentStatus status;
}
