package vn.vietduc.carehubbackend.user.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.notification.messaging.EmailMessage;
import vn.vietduc.carehubbackend.notification.messaging.EmailProducer;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Role;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserRole;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.RoleRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.repository.UserRoleRepository;

import java.util.List;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.blankOrNullString;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class UserControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private Department department;
    private Role adminRole;
    private Role userRole;
    private User admin;
    private User employee;

    @BeforeEach
    void setUp() {
        department = departmentRepository.save(Department.builder()
                .departmentCode("CARD")
                .name("Cardiology")
                .build());
        adminRole = roleRepository.save(Role.builder().code("ADMIN").name("Administrator").build());
        userRole = roleRepository.save(Role.builder().code("USER").name("User").build());
        admin = userRepository.save(User.builder()
                .employeeCode("ADMIN_USER")
                .email("admin-user@example.com")
                .name("Admin User")
                .department(department)
                .password(passwordEncoder.encode("Admin123"))
                .status(UserStatus.ACTIVE)
                .build());
        employee = userRepository.save(User.builder()
                .employeeCode("EMP_USER")
                .email("employee-user@example.com")
                .name("Employee User")
                .department(department)
                .password(passwordEncoder.encode("OldPass123"))
                .status(UserStatus.ACTIVE)
                .build());
        userRoleRepository.save(UserRole.builder().user(admin).role(adminRole).build());
        userRoleRepository.save(UserRole.builder().user(employee).role(userRole).build());
    }

    @Test
    void createUserAssignsRoleAndRejectsDuplicateEmployeeCode() throws Exception {
        String body = """
                {
                  "employeeCode": "EMP_NEW",
                  "departmentId": %d,
                  "email": "emp-new@example.com",
                  "roleIds": [%d],
                  "fullName": "Employee New"
                }
                """.formatted(department.getId(), userRole.getId());

        mockMvc.perform(post("/api/v1/users")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.employeeCode", is("EMP_NEW")))
                .andExpect(jsonPath("$.data.status", is("ACTIVE")));

        User saved = userRepository.findByEmployeeCodeAndIsDeletedFalse("EMP_NEW").orElseThrow();
        assertEquals("Employee New", saved.getName());
        assertTrue(userRoleRepository.existsByUser_IdAndRole_Id(saved.getId(), userRole.getId()));

        mockMvc.perform(post("/api/v1/users")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error_code", is("SYS_409")));
    }

    @Test
    void userListRequiresAdminAndMeUsesJwtSubject() throws Exception {
        mockMvc.perform(get("/api/v1/users")
                        .with(jwtFor(employee, "USER")))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/me")
                        .with(jwtFor(employee, "USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.employeeCode", is("EMP_USER")))
                .andExpect(jsonPath("$.data.departmentName", is("Cardiology")));
    }

    @Test
    void adminCanLockUnlockResetAndSoftDeleteUser() throws Exception {
        mockMvc.perform(patch("/api/v1/users/{id}/lock", employee.getId())
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("LOCKED")));

        mockMvc.perform(patch("/api/v1/users/{id}/unlock", employee.getId())
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status", is("ACTIVE")));

        mockMvc.perform(patch("/api/v1/users/{id}/reset-password", employee.getId())
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", not(blankOrNullString())));

        mockMvc.perform(delete("/api/v1/user/{id}", employee.getId())
                        .with(adminJwt()))
                .andExpect(status().isOk());

        assertTrue(userRepository.findById(employee.getId()).orElseThrow().isDeleted());
        mockMvc.perform(get("/api/v1/user/{id}", employee.getId())
                        .with(adminJwt()))
                .andExpect(status().isNotFound());
    }

    @Test
    void changePasswordValidatesOldPasswordAndConfirmation() throws Exception {
        mockMvc.perform(patch("/api/v1/user/change-password")
                        .with(jwtFor(employee, "USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"oldPassword":"wrong","newPassword":"NewPass123","confirmNewPassword":"NewPass123"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error_code", is("REQ_001")));

        mockMvc.perform(patch("/api/v1/user/change-password")
                        .with(jwtFor(employee, "USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"oldPassword":"OldPass123","newPassword":"NewPass123","confirmNewPassword":"NewPass123"}
                                """))
                .andExpect(status().isOk());

        User updated = userRepository.findById(employee.getId()).orElseThrow();
        assertTrue(passwordEncoder.matches("NewPass123", updated.getPassword()));
    }

    private RequestPostProcessor adminJwt() {
        return jwtFor(admin, "ADMIN");
    }

    private RequestPostProcessor jwtFor(User user, String role) {
        return jwt()
                .jwt(jwt -> jwt
                        .subject(user.getId().toString())
                        .claim("roles", List.of(role))
                        .claim("employeeCode", user.getEmployeeCode()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @TestConfiguration
    static class NoopEmailProducerConfig {
        @Bean
        @Primary
        EmailProducer emailProducer() {
            return new EmailProducer((RabbitTemplate) null) {
                @Override
                public void sendEmail(EmailMessage message) {
                    // User controller tests assert application behavior, not broker delivery.
                }
            };
        }
    }
}
