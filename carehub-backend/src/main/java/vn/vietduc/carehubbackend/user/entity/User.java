package vn.vietduc.carehubbackend.user.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

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

    @Column(unique = true)
    private String email;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String password;

    @Column(name = "first_login")
    private boolean firstLogin;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private UserStatus status;

    @Column(name = "is_deleted")
    private boolean isDeleted;

    public boolean requiresFirstLoginSetup() {
        return firstLogin && email.isEmpty();
    }
}
