package vn.vietduc.carehubbackend.form.entity;

import jakarta.persistence.*;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.form.entity.enums.FormItemType;

import java.util.UUID;

@Entity
@Table(name = "checklist_form_items")
public class ChecklistFormItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private ChecklistSection section;

    @Column(nullable = false)
    private UUID itemKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FormItemType itemType;

    @Column(nullable = false)
    private Integer displayOrder;

    private String title;

    @Column(columnDefinition = "text")
    private String description;

    private String mediaUrl;
}