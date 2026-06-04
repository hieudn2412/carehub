package vn.vietduc.carehubbackend.user.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.auth.entity.Role;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "users")
public class User extends BaseEntity {

    @Column(name = "employee_code", unique = true, nullable = false)
    private String employeeCode;

    private String email;

    private Role role;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String password;

    private boolean active;
}
