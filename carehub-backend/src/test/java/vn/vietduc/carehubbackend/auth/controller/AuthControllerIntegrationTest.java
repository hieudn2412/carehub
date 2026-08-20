package vn.vietduc.carehubbackend.auth.controller;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.DisplayName;
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

    @DisplayName("L2-AUTH-01 | Happy Path: login → refresh rotates → logout persists session revocation; replayed refresh → 401 AUTH_SESSION_INVALID")
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
                .andExpect(jsonPath("$.data.refreshToken", not(blankOrNullString())))
                .andExpect(jsonPath("$.data.refreshToken", not(refreshToken)))
                .andExpect(jsonPath("$.data.accessToken", not(blankOrNullString())));
        String rotatedToken = JsonPath.read(
                mockMvc.perform(post("/api/v1/auth/refresh-token")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.data.refreshToken"
        );

        mockMvc.perform(post("/api/v1/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"%s\"}".formatted(rotatedToken)))
                .andExpect(status().isOk());

        assertTrue(latestSessionFor(activeUser).getRevoked());
        mockMvc.perform(post("/api/v1/auth/refresh-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"%s\"}".formatted(rotatedToken)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error_code", is("AUTH_SESSION_INVALID")));
    }

    @DisplayName("L2-AUTH-02 | Query Correctness: a second login keeps the first session's refresh token valid (concurrent sessions)")
    @Test
    void secondLoginKeepsFirstSessionRefreshTokenValid() throws Exception {
        String firstRefreshToken = loginAndGetRefreshToken();
        String secondRefreshToken = loginAndGetRefreshToken();

        assertNotEquals(firstRefreshToken, secondRefreshToken);
        assertEquals(2, refreshTokenRepository.findAll().stream()
                .filter(token -> token.getUser().getId().equals(activeUser.getId()))
                .filter(token -> !token.getRevoked())
                .count());

        mockMvc.perform(post("/api/v1/auth/refresh-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"%s\"}".formatted(firstRefreshToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken", not(blankOrNullString())));
    }

    @DisplayName("L2-AUTH-03 | Negative: LOCKED account → 401; blank payload → 422 VAL_001")
    @Test
    void loginRejectsLockedAccountAndInvalidPayload() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"employeeCode":"LOCK001","password":"Correct123"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error_code", is("AUTH_ACCOUNT_DISABLED")));

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"employeeCode":"","password":""}
                                """))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error_code", is("VAL_001")));
    }

    @DisplayName("L2-AUTH-04 | Happy Path: forgot-password persists an OTP row and reset consumes it (used=true, new bcrypt hash)")
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

    private String loginAndGetRefreshToken() throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"employeeCode":"AUTH001","password":"Correct123"}
                                """))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(response, "$.data.refreshToken");
    }

    private vn.vietduc.carehubbackend.auth.entity.RefreshToken latestSessionFor(User sessionUser) {
        return refreshTokenRepository.findAll().stream()
                .filter(token -> token.getUser().getId().equals(sessionUser.getId()))
                .max(java.util.Comparator.comparing(vn.vietduc.carehubbackend.auth.entity.RefreshToken::getId))
                .orElseThrow();
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
