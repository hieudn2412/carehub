package vn.vietduc.carehubbackend.user.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "users")
public class User extends BaseEntity {
    @Column(name = "employee_code", nullable = false)
    private String employeeCode;

    @Column(unique = true)
    private String email;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String password;

    private LocalDate birthday;

    private String phone;

    @Column(name = "gender", nullable = true)
    private boolean gender;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "position_id")
    private Position position;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "education_level_id")
    private EducationLevel educationLevel;

    @Column(name = "first_login")
    private boolean firstLogin;

    @Column(name = "last_login")
    private LocalDateTime lastLogin;

    private LocalDateTime lastChangePassword;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private UserStatus status;

    @Column(name = "is_deleted")
    private boolean isDeleted = false;

    public boolean requiresFirstLoginSetup() {
        return firstLogin && (email == null || email.isBlank());
    }
}
