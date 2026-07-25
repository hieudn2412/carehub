package vn.vietduc.carehubbackend.questiongeneration.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.util.List;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class EvaluationDashboardControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private UserRepository userRepository;

    private Department managerDepartment;
    private Department otherDepartment;
    private User manager;

    @BeforeEach
    void setUp() {
        managerDepartment = departmentRepository.save(
                Department.builder().departmentCode("KHOA_NOI").name("Khoa Nội").build()
        );
        otherDepartment = departmentRepository.save(
                Department.builder().departmentCode("KHOA_NGOAI").name("Khoa Ngoại").build()
        );
        manager = userRepository.save(User.builder()
                .employeeCode("MANAGER_THEORY")
                .email("manager-theory@example.com")
                .name("Manager Theory")
                .password("encoded")
                .department(managerDepartment)
                .build());
    }

    @Test
    void managerWithoutEvaluationPermissionCanViewOwnDepartmentTheoryDashboard() throws Exception {
        mockMvc.perform(get("/api/v1/evaluation-dashboard/exam-overview")
                        .param("departmentId", managerDepartment.getId().toString())
                        .with(jwtFor(manager, "MANAGER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").exists())
                .andExpect(jsonPath("$.data.targetCount").value(0));
    }

    @Test
    void managerCannotViewAnotherDepartmentTheoryDashboard() throws Exception {
        mockMvc.perform(get("/api/v1/evaluation-dashboard/exam-overview")
                        .param("departmentId", otherDepartment.getId().toString())
                        .with(jwtFor(manager, "MANAGER")))
                .andExpect(status().isForbidden());
    }

    @Test
    void regularUserCannotViewTheoryDashboard() throws Exception {
        mockMvc.perform(get("/api/v1/evaluation-dashboard/exam-overview")
                        .with(jwtFor(manager, "USER")))
                .andExpect(status().isForbidden());
    }

    private RequestPostProcessor jwtFor(User user, String role) {
        return jwt()
                .jwt(token -> token
                        .subject(user.getId().toString())
                        .claim("roles", List.of(role)))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }
}
