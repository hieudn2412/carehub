package vn.vietduc.carehubbackend.notification.controller;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.notification.entity.EmailTemplate;
import vn.vietduc.carehubbackend.notification.entity.Notification;
import vn.vietduc.carehubbackend.notification.repository.EmailTemplateRepository;
import vn.vietduc.carehubbackend.notification.repository.NotificationRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.util.List;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
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
class NotificationControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private EmailTemplateRepository emailTemplateRepository;

    private User employee;
    private User otherEmployee;

    @BeforeEach
    void setUp() {
        employee = userRepository.save(User.builder()
                .employeeCode("NOTIF001")
                .email("notif001@example.com")
                .name("Notification One")
                .password("encoded")
                .status(UserStatus.ACTIVE)
                .build());
        otherEmployee = userRepository.save(User.builder()
                .employeeCode("NOTIF002")
                .email("notif002@example.com")
                .name("Notification Two")
                .password("encoded")
                .status(UserStatus.ACTIVE)
                .build());
    }

    @Test
    void currentUserCanListReadUnreadAndDeleteOnlyOwnNotifications() throws Exception {
        Notification own = notificationRepository.save(Notification.builder()
                .user(employee)
                .type("INFO")
                .title("Training reminder")
                .content("Please update training hours")
                .deepLink("/training")
                .read(false)
                .build());
        Notification other = notificationRepository.save(Notification.builder()
                .user(otherEmployee)
                .type("INFO")
                .title("Training reminder")
                .content("Other employee notification")
                .read(false)
                .build());

        mockMvc.perform(get("/api/v1/me/notifications")
                        .with(jwtFor(employee, "USER"))
                        .param("q", "training")
                        .param("read", "false")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content.length()", is(1)))
                .andExpect(jsonPath("$.data.content[0].id", is(own.getId().intValue())));

        mockMvc.perform(patch("/api/v1/me/notifications/{id}", own.getId())
                        .with(jwtFor(employee, "USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"read": true}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.read", is(true)));

        mockMvc.perform(get("/api/v1/me/notifications/unread-count")
                        .with(jwtFor(employee, "USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.unreadCount", is(0)));

        mockMvc.perform(get("/api/v1/me/notifications/{id}", other.getId())
                        .with(jwtFor(employee, "USER")))
                .andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/v1/me/notifications/{id}", own.getId())
                        .with(jwtFor(employee, "USER")))
                .andExpect(status().isNoContent());
        assertFalse(notificationRepository.findById(own.getId()).isPresent());
        assertTrue(notificationRepository.findById(other.getId()).isPresent());
    }

    @Test
    void emailTemplateCrudPreviewAndVersionConflictAreAdminOnly() throws Exception {
        mockMvc.perform(get("/api/v1/email/templates")
                        .with(jwtFor(employee, "USER")))
                .andExpect(status().isForbidden());

        String createResponse = mockMvc.perform(post("/api/v1/email/templates")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("EXAM_ASSIGNED_EMPLOYEE", true, null)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.code", is("EXAM_ASSIGNED_EMPLOYEE")))
                .andExpect(jsonPath("$.data.active", is(true)))
                .andExpect(jsonPath("$.data.allowedVariables.length()", greaterThanOrEqualTo(1)))
                .andReturn()
                .getResponse()
                .getContentAsString();
        Number templateId = JsonPath.read(createResponse, "$.data.id");
        Number version = JsonPath.read(createResponse, "$.data.version");

        mockMvc.perform(post("/api/v1/email/templates")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("EXAM_ASSIGNED_EMPLOYEE_ALT", true, null)))
                .andExpect(status().isCreated());

        EmailTemplate first = emailTemplateRepository.findByCode("EXAM_ASSIGNED_EMPLOYEE").orElseThrow();
        assertFalse(first.isActive());

        mockMvc.perform(put("/api/v1/email/templates/{id}", templateId.longValue())
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(templateJson("EXAM_ASSIGNED_EMPLOYEE", true, version.longValue() + 99)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error_code", is("SYS_409")));

        mockMvc.perform(post("/api/v1/email/template-previews")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "eventType": "EXAM_ASSIGNED",
                                  "audience": "EMPLOYEE",
                                  "subject": "Exam {{exam_name}} assigned",
                                  "body": "Hello {{recipient_name}}, due {{due_at}}",
                                  "variables": {
                                    "exam_name": "Safety",
                                    "recipient_name": "Lan",
                                    "due_at": "2026-07-20"
                                  }
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.subject", is("Exam Safety assigned")))
                .andExpect(jsonPath("$.data.body", is("Hello Lan, due 2026-07-20")));
    }

    @Test
    void notificationEventsAndConfigAreAdminOnlyAndValidateCompletePolicies() throws Exception {
        mockMvc.perform(get("/api/v1/notification-events")
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()", greaterThanOrEqualTo(4)));

        mockMvc.perform(get("/api/v1/notifications/config")
                        .with(jwtFor(employee, "USER")))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/v1/notifications/config")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "policies": [{
                                    "eventType": "EXAM_ASSIGNED",
                                    "enabled": true,
                                    "inAppEnabled": true,
                                    "emailEnabled": true,
                                    "cadence": "IMMEDIATE"
                                  }]
                                }
                                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error_code", is("VAL_001")));

        mockMvc.perform(put("/api/v1/notifications/config/defaults")
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.policies.length()", greaterThanOrEqualTo(4)));
    }

    private String templateJson(String code, boolean active, Long version) {
        String versionJson = version == null ? "" : "\"version\": %d,".formatted(version);
        return """
                {
                  "code": "%s",
                  "name": "Exam assigned template",
                  "category": "EVALUATION",
                  "eventType": "EXAM_ASSIGNED",
                  "audience": "EMPLOYEE",
                  %s
                  "subject": "Exam {{exam_name}} assigned",
                  "body": "Hello {{recipient_name}}, exam {{exam_name}} is ready.",
                  "active": %s
                }
                """.formatted(code, versionJson, active);
    }

    private RequestPostProcessor adminJwt() {
        return jwt()
                .jwt(jwt -> jwt.subject("1").claim("roles", List.of("ADMIN")).claim("employeeCode", "ADMIN"))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private RequestPostProcessor jwtFor(User user, String role) {
        return jwt()
                .jwt(jwt -> jwt
                        .subject(user.getId().toString())
                        .claim("roles", List.of(role))
                        .claim("employeeCode", user.getEmployeeCode()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }
}
