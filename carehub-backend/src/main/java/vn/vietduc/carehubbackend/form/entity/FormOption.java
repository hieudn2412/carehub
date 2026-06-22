package vn.vietduc.carehubbackend.form.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "form_options")
public class FormOption extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private FormQuestion question;

    @Column(nullable = false)
    private UUID optionKey;

    @Column(name = "option_value", nullable = false)
    private String value;

    @Column(nullable = false, length = 1000)
    private String label;

    @Column(name = "score", precision = 12, scale = 4)
    private BigDecimal scoreValue;

    private Boolean compliant;

    @Builder.Default
    @Column(nullable = false)
    private boolean excludeFromDenominator = false;

    @Column(name = "sort_order", nullable = false)
    private Integer displayOrder;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;
}
