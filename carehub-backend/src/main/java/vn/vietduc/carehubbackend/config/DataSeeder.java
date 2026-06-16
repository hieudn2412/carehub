package vn.vietduc.carehubbackend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vn.vietduc.carehubbackend.user.entity.Role;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserRole;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.RoleRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.repository.UserRoleRepository;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private static final String ADMIN_ROLE_CODE = "ADMIN";
    private static final String USER_ROLE_CODE = "USER";
    private static final String MANAGER_ROLE_CODE = "MANAGER";
    private static final String SYSTEM_JOB_ROLE_CODE = "SYSTEM_JOB";

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.enabled:true}")
    private boolean seedEnabled;

    @Value("${app.seed.admin.employee-code}")
    private String adminEmployeeCode;

    @Value("${app.seed.admin.email}")
    private String adminEmail;

    @Value("${app.seed.admin.password:}")
    private String adminPassword;

    @Value("${app.seed.admin.name}")
    private String adminName;

    @Override
    public void run(String... args) {
        if (!seedEnabled) {
            log.info("Data seeding is disabled");
            return;
        }

        Role adminRole = seedRole(ADMIN_ROLE_CODE, "Administrator");
        Role userRole = seedRole(USER_ROLE_CODE, "User");
        Role managerRole = seedRole(MANAGER_ROLE_CODE, "Manager");
        Role systemJobRole = seedRole(SYSTEM_JOB_ROLE_CODE, "System Job");
        seedAdminUser(adminRole);
    }

    private Role seedRole(String code, String name) {
        return roleRepository.findByCode(code)
                .orElseGet(() -> {
                    Role role = Role.builder()
                            .code(code)
                            .name(name)
                            .build();

                    Role saved = roleRepository.save(role);

                    log.info("Seeded role: {}", code);

                    return saved;
                });
    }

    private void seedAdminUser(Role adminRole) {
        if (!StringUtils.hasText(adminPassword)) {
            log.warn("ADMIN_PASSWORD is not set, skipping admin user seed");
            return;
        }

        if (userRepository.existsByEmail(adminEmail)) {
            log.info("Admin user already exists: {}", adminEmail);
            return;
        }

        User admin = User.builder()
                .employeeCode(adminEmployeeCode)
                .email(adminEmail)
                .name(adminName)
                .password(passwordEncoder.encode(adminPassword))
                .firstLogin(false)
                .status(UserStatus.ACTIVE)
                .build();
        userRepository.save(admin);

        userRoleRepository.save(UserRole.builder()
                .user(admin)
                .role(adminRole)
                .build());

        log.info("Seeded admin user: {} ({})", adminEmail, adminEmployeeCode);
    }
}
