package vn.vietduc.carehubbackend.form.compliance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.user.entity.Department;

import java.math.BigDecimal;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "form_compliance_targets", uniqueConstraints = {
        @UniqueConstraint(name = "uk_form_compliance_target_scope", columnNames = {"form_template_id", "department_id"})
})
public class FormComplianceTarget extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "form_template_id", nullable = false)
    private Form form;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department department;

    @Column(name = "target_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal targetPercent;

    @Version
    @Column(name = "lock_version", nullable = false)
    private Long lockVersion;
}
