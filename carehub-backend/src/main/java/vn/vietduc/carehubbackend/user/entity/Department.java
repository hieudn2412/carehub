package vn.vietduc.carehubbackend.user.entity;

import vn.vietduc.carehubbackend.common.entity.BaseEntity;

import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
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
    public static final BigDecimal DEFAULT_COMPETENCY_TARGET_SCORE = new BigDecimal("6.00");

    private String name;

    private String departmentCode;

    @Builder.Default
    @jakarta.persistence.Column(
            name = "competency_target_score",
            precision = 5,
            scale = 2,
            columnDefinition = "numeric(5,2) default 6.00"
    )
    private BigDecimal competencyTargetScore = DEFAULT_COMPETENCY_TARGET_SCORE;

    public BigDecimal getEffectiveCompetencyTargetScore() {
        return competencyTargetScore == null
                ? DEFAULT_COMPETENCY_TARGET_SCORE
                : competencyTargetScore;
    }

    @OneToMany(mappedBy = "department")
    private List<User> users;
}
