package vn.vietduc.carehubbackend.user.entity;

import vn.vietduc.carehubbackend.common.entity.BaseEntity;

import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.util.List;
import java.math.BigDecimal;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "departments")
public class Department extends BaseEntity {
    private String name;

    private String departmentCode;

    @jakarta.persistence.Column(name = "competency_target_score", precision = 5, scale = 2)
    private BigDecimal competencyTargetScore;

    @OneToMany(mappedBy = "department")
    private List<User> users;
}
