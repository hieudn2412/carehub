package vn.vietduc.carehubbackend.form.entity;

import jakarta.persistence.*;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;

import java.util.UUID;

@Entity
@Table(name = "checklist_sections")
public class ChecklistSection extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private ChecklistFormVersion formVersion;

    @Column(nullable = false)
    private UUID sectionKey;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(nullable = false)
    private Integer displayOrder;
}
