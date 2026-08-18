package vn.vietduc.carehubbackend.auth.controller;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import vn.vietduc.carehubbackend.auth.entity.PasswordResetOtp;
import vn.vietduc.carehubbackend.auth.entity.RefreshToken;
import vn.vietduc.carehubbackend.auth.repository.PasswordResetRepository;
import vn.vietduc.carehubbackend.auth.repository.RefreshTokenRepository;
import vn.vietduc.carehubbackend.auth.service.PasswordResetService;
import vn.vietduc.carehubbackend.auth.dto.request.ForgotPasswordRequest;
import vn.vietduc.carehubbackend.config.CapturingEmailProducerConfig;
import vn.vietduc.carehubbackend.config.CapturingEmailProducerConfig.CapturingEmailProducer;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * L2 integration tests — sheet {@code L2-AuthService}, ids L2-AUTH-05…10 (05–10 written new; 01–04
 * live in {@link AuthControllerIntegrationTest}).
 *
 * <p><b>Deliberately NOT {@code @Transactional}</b>: L2-AUTH-10 drives a real transaction through
 * {@link TransactionTemplate} and rolls it back, which is impossible inside a test-managed
 * transaction. Fixtures therefore use unique employee codes and every assertion is scoped to ids
 * created by the test.
 *
 * <p>Divergences pinned here (docs/l1-unit-tests/SRS-CODE-DIVERGENCE.md):
 * D25 — refresh does not rotate the token; D26 — a soft-deleted user's refresh token keeps working;
 * D27 — the OTP email is published inside the transaction, so a rollback un-does the DB row but not
 * the message (dual write).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Import(CapturingEmailProducerConfig.class)
class AuthFlowIntegrationTest {

    private static final AtomicInteger SEQ = new AtomicInteger();

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
    @Autowired
    private PasswordResetService passwordResetService;
    @Autowired
    private TransactionTemplate transactionTemplate;
    @Autowired
    private CapturingEmailProducer emailProducer;

    private User user;
    private String employeeCode;
    private String email;

    @BeforeEach
    void setUp() {
        int n = SEQ.incrementAndGet();
        employeeCode = "AFLOW%03d".formatted(n);
        email = "aflow%03d@example.com".formatted(n);
        user = userRepository.save(User.builder()
                .employeeCode(employeeCode)
                .email(email)
                .name("Auth Flow " + n)
                .password(passwordEncoder.encode("Correct123"))
                .status(UserStatus.ACTIVE)
                .build());
        emailProducer.reset();
    }

    @DisplayName("L2-AUTH-05 | Query Correctness: refresh does NOT rotate — the same token string comes back and no new row is created (D25)")
    @Test
    void refreshReturnsTheSameTokenWithoutRotation() throws Exception {
        String refreshToken = login();

        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post("/api/v1/auth/refresh-token")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.refreshToken", is(refreshToken)));
        }

        // Pins D25: CLAUDE.md and the TDS describe refresh-token ROTATION, but two refreshes later
        // the original credential is still the only one, still valid, and never superseded.
        assertThat(refreshTokenRepository.findAll().stream()
                .filter(token -> token.getUser().getId().equals(user.getId()))
                .toList())
                .hasSize(1)
                .allSatisfy(token -> {
                    assertThat(token.getToken()).isEqualTo(refreshToken);
                    assertThat(token.getRevoked()).isFalse();
                });
    }

    @DisplayName("L2-AUTH-06 | Negative: an expired refresh token → 401 AUTH_001 'Token đã hết hạn'")
    @Test
    void expiredRefreshTokenIsRejected() throws Exception {
        String tokenValue = "expired-" + employeeCode;
        refreshTokenRepository.save(RefreshToken.builder()
                .token(tokenValue)
                .user(user)
                .revoked(false)
                .expiredAt(LocalDateTime.now().minusDays(1))
                .build());

        mockMvc.perform(post("/api/v1/auth/refresh-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"%s\"}".formatted(tokenValue)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error_code", is("AUTH_001")))
                .andExpect(jsonPath("$.message", containsString("Token đã hết hạn")));
    }

    @DisplayName("L2-AUTH-07 | Negative: a consumed OTP cannot be replayed → 400 'Mã OTP đã được sử dụng'")
    @Test
    void usedOtpCannotBeReplayed() throws Exception {
        String otp = requestOtp();

        resetPassword(otp, "FirstPass1").andExpect(status().isOk());

        resetPassword(otp, "SecondPass2")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Mã OTP đã được sử dụng")));

        // The replay changed nothing: the first password still matches.
        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(passwordEncoder.matches("FirstPass1", reloaded.getPassword())).isTrue();
    }

    @DisplayName("L2-AUTH-08 | Negative: an expired OTP is rejected → 400 'Mã OTP đã hết hạn' and the password stays unchanged")
    @Test
    void expiredOtpIsRejected() throws Exception {
        String otp = requestOtp();
        PasswordResetOtp row = latestOtpRow();
        row.setExpiredAt(LocalDateTime.now().minusMinutes(1));
        passwordResetRepository.save(row);

        resetPassword(otp, "NewPass123")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("Mã OTP đã hết hạn")));

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(passwordEncoder.matches("Correct123", reloaded.getPassword())).isTrue();
        assertThat(passwordResetRepository.findById(row.getId()).orElseThrow().isUsed()).isFalse();
    }

    @DisplayName("L2-AUTH-09 | Query Correctness: a soft-deleted user's refresh token still mints access tokens (D26)")
    @Test
    void softDeletedUserCanStillRefresh() throws Exception {
        String refreshToken = login();

        user.setDeleted(true);
        userRepository.save(user);

        // Pins D26: refreshToken() checks user.getStatus() but never isDeleted, so deletion does not
        // end the session. Recorded as a security divergence, not fixed here.
        mockMvc.perform(post("/api/v1/auth/refresh-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.refreshToken", is(refreshToken)));
    }

    @DisplayName("L2-AUTH-10 | Transaction Boundary: forgot-password inside a rolled-back transaction loses the OTP row but the email already left (D27)")
    @Test
    void forgotPasswordEmailIsPublishedBeforeCommit() {
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail(email);

        transactionTemplate.executeWithoutResult(status -> {
            passwordResetService.forgotPassword(request);
            status.setRollbackOnly();
        });

        // Pins D27: EmailProducer.sendEmail is invoked inside the @Transactional method, so the AMQP
        // publish is NOT bound to the transaction outcome — a dual write. The user receives an OTP
        // that does not exist in the database.
        assertThat(passwordResetRepository.findAll().stream()
                .filter(otp -> email.equals(otp.getEmail()))
                .toList()).isEmpty();
        assertThat(emailProducer.sent())
                .hasSize(1)
                .allSatisfy(message -> {
                    assertThat(message.getTo()).isEqualTo(email);
                    assertThat(message.getContent()).contains("Mã xác thực:");
                });
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private String login() throws Exception {
        String response = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"employeeCode\":\"%s\",\"password\":\"Correct123\"}".formatted(employeeCode)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return JsonPath.read(response, "$.data.refreshToken");
    }

    private String requestOtp() throws Exception {
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\"}".formatted(email)))
                .andExpect(status().isOk());
        return latestOtpRow().getOtp();
    }

    private PasswordResetOtp latestOtpRow() {
        return passwordResetRepository.findAll().stream()
                .filter(otp -> email.equals(otp.getEmail()))
                .reduce((first, second) -> second)
                .orElseThrow(() -> new AssertionError("no OTP row for " + email));
    }

    private org.springframework.test.web.servlet.ResultActions resetPassword(String otp, String newPassword)
            throws Exception {
        return mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"%s\",\"otp\":\"%s\",\"newPassword\":\"%s\"}"
                        .formatted(email, otp, newPassword)));
    }
}
