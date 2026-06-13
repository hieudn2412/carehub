package vn.vietduc.carehubbackend.user.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.util.List;

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

    @OneToMany(mappedBy = "department")
    private List<User> users;
}
