package vn.vietduc.carehubbackend.form.entity;

import jakarta.persistence.*;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "checklist_options")
public class ChecklistOption extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    private ChecklistQuestion question;

    @Column(nullable = false)
    private UUID optionKey;

    @Column(nullable = false)
    private String value;

    @Column(nullable = false)
    private String label;

    private BigDecimal scoreValue;

    private Boolean compliant;

    private boolean excludeFromDenominator;

    private Integer displayOrder;
}
