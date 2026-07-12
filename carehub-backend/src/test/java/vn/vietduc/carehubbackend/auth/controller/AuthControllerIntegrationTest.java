package vn.vietduc.carehubbackend.auth.controller;

import com.jayway.jsonpath.JsonPath;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.auth.repository.PasswordResetRepository;
import vn.vietduc.carehubbackend.auth.repository.RefreshTokenRepository;
import vn.vietduc.carehubbackend.notification.messaging.EmailMessage;
import vn.vietduc.carehubbackend.notification.messaging.EmailProducer;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.blankOrNullString;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class AuthControllerIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private PasswordResetRepository passwordResetRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User activeUser;
    private User lockedUser;

    @BeforeEach
    void setUp() {
        activeUser = userRepository.save(User.builder()
                .employeeCode("AUTH001")
                .email("auth001@example.com")
                .name("Auth One")
                .password(passwordEncoder.encode("Correct123"))
                .status(UserStatus.ACTIVE)
                .build());
        lockedUser = userRepository.save(User.builder()
                .employeeCode("LOCK001")
                .email("lock001@example.com")
                .name("Locked User")
                .password(passwordEncoder.encode("Correct123"))
                .status(UserStatus.LOCKED)
                .build());
    }

    @Test
    void loginRefreshAndLogoutLifecyclePersistsRevocation() throws Exception {
        String loginBody = """
                {"employeeCode":"AUTH001","password":"Correct123"}
                """;
        String loginResponse = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken", not(blankOrNullString())))
                .andExpect(jsonPath("$.data.refreshToken", not(blankOrNullString())))
                .andExpect(jsonPath("$.data.tokenType", is("Bearer")))
                .andExpect(jsonPath("$.data.requiresFirstLoginSetup", is(false)))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String refreshToken = JsonPath.read(loginResponse, "$.data.refreshToken");

        mockMvc.perform(post("/api/v1/auth/refresh-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.refreshToken", is(refreshToken)))
                .andExpect(jsonPath("$.data.accessToken", not(blankOrNullString())));

        mockMvc.perform(post("/api/v1/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
                .andExpect(status().isOk());

        assertTrue(refreshTokenRepository.findByToken(refreshToken).orElseThrow().getRevoked());
        mockMvc.perform(post("/api/v1/auth/refresh-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error_code", is("REQ_001")));
    }

    @Test
    void loginRejectsLockedAccountAndInvalidPayload() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"employeeCode":"LOCK001","password":"Correct123"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error_code", is("AUTH_001")));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"employeeCode":"","password":""}
                                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error_code", is("VAL_001")));
    }

    @Test
    void forgotPasswordAndResetPasswordConsumeOtp() throws Exception {
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"auth001@example.com"}
                                """))
                .andExpect(status().isOk());

        var otp = passwordResetRepository.findAll().stream()
                .filter(item -> "auth001@example.com".equals(item.getEmail()))
                .findFirst()
                .orElseThrow();

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"auth001@example.com","otp":"%s","newPassword":"NewPass123"}
                                """.formatted(otp.getOtp())))
                .andExpect(status().isOk());

        assertTrue(passwordResetRepository.findById(otp.getId()).orElseThrow().isUsed());
        User updated = userRepository.findById(activeUser.getId()).orElseThrow();
        assertTrue(passwordEncoder.matches("NewPass123", updated.getPassword()));
    }

    @TestConfiguration
    static class NoopEmailProducerConfig {
        @Bean
        @Primary
        EmailProducer emailProducer() {
            return new EmailProducer((RabbitTemplate) null) {
                @Override
                public void sendEmail(EmailMessage message) {
                    // Keep auth integration tests independent from RabbitMQ.
                }
            };
        }
    }
}
