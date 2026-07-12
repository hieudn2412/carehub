package vn.vietduc.carehubbackend.training.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.user.entity.Department;

import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "cme_scope_configuration")
public class CmeScopeConfiguration extends BaseEntity {
    public static final String CME_SCOPE_KEY = "CME";

    @Column(name = "scope_key", nullable = false, unique = true, updatable = false, length = 30)
    private String scopeKey;

    @Builder.Default
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "cme_scope_departments",
            joinColumns = @JoinColumn(name = "configuration_id"),
            inverseJoinColumns = @JoinColumn(name = "department_id")
    )
    private Set<Department> departments = new LinkedHashSet<>();

    @Version
    @Column(name = "lock_version", nullable = false)
    private Long version;
}
