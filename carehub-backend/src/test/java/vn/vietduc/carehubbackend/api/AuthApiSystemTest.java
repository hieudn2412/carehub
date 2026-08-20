package vn.vietduc.carehubbackend.api;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import vn.vietduc.carehubbackend.auth.entity.PasswordResetOtp;
import vn.vietduc.carehubbackend.auth.repository.PasswordResetRepository;
import vn.vietduc.carehubbackend.auth.repository.RefreshTokenRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * L3 system/API tests — sheet {@code L3-AuthAPI}, ids L3-AUTH-01…16.
 *
 * <p>Everything here goes over real HTTP against a booted Tomcat, so the JWT that
 * {@code POST /auth/login} returns is verified by the production {@code NimbusJwtDecoder} on the way
 * back in. See {@link AbstractApiSystemTest} for why that is not what the MockMvc tests do.
 *
 * <p>Contract facts pinned (all verified against the code, not the TDS):
 * bad credentials answer <b>400 REQ_001</b> (not 401 AUTH_001 as the TDS error registry suggests);
 * a missing token is rejected by the Bearer entry point with an <b>empty 401 body</b> — no
 * {@code error_code}, no {@code correlation_id} (D36); {@code forgot-password} reveals whether an
 * email exists (D39).
 */
class AuthApiSystemTest extends AbstractApiSystemTest {

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;
    @Autowired
    private PasswordResetRepository passwordResetRepository;

    private User user;
    private User lockedUser;

    @BeforeEach
    void createFixtures() {
        user = newUser("L3AUTH");
        lockedUser = newUser("L3LOCK");
        lockedUser.setStatus(UserStatus.LOCKED);
        userRepository.save(lockedUser);
    }

    @DisplayName("L3-AUTH-01 | Input-Domain-Happy: POST /auth/login with valid credentials → 200 + signed access token, refresh token, tokenType=Bearer")
    @Test
    void loginWithValidCredentialsReturnsTokenPair() {
        ResponseEntity<String> response = post(API + "/auth/login", null, loginBody(user.getEmployeeCode(), PASSWORD));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode data = data(response);
        assertThat(data.get("accessToken").asText()).isNotBlank().matches("^[\\w-]+\\.[\\w-]+\\.[\\w-]+$");
        assertThat(data.get("refreshToken").asText()).isNotBlank();
        assertThat(data.get("tokenType").asText()).isEqualTo("Bearer");
        assertThat(data.get("requiresFirstLoginSetup").asBoolean()).isFalse();
        assertThat(data.get("expiresIn").asLong()).isPositive();
    }

    @DisplayName("L3-AUTH-02 | Validation: blank employeeCode + password → 422 VAL_001 with per-field details")
    @Test
    void blankCredentialsAreRejectedWithFieldDetails() {
        ResponseEntity<String> response = post(API + "/auth/login", null, loginBody("", ""));

        assertError(response, HttpStatus.UNPROCESSABLE_ENTITY, "VAL_001");
        JsonNode details = json(response).get("details");
        assertThat(details).isNotNull();
        assertThat(details.toString()).contains("employeeCode").contains("password");
    }

    @DisplayName("L3-AUTH-03 | Input-Domain-Invalid: wrong password → 400 REQ_001 'Mã nhân viên hoặc mật khẩu không chính xác'")
    @Test
    void wrongPasswordIsRejected() {
        ResponseEntity<String> response = post(API + "/auth/login", null,
                loginBody(user.getEmployeeCode(), "WrongPass999"));

        // Pinned as-is: the credentials path throws BadRequestException, so the wire contract is
        // 400 REQ_001 — not the 401 AUTH_001 the TDS 8.1 registry implies.
        assertError(response, HttpStatus.BAD_REQUEST, "REQ_001");
        assertThat(json(response).get("message").asText())
                .isEqualTo("Mã nhân viên hoặc mật khẩu không chính xác");
    }

    @DisplayName("L3-AUTH-04 | Not-Found: unknown employeeCode → 400 REQ_001 with the same message as a wrong password (no account enumeration)")
    @Test
    void unknownEmployeeCodeLooksExactlyLikeAWrongPassword() {
        ResponseEntity<String> response = post(API + "/auth/login", null,
                loginBody("NOSUCHCODE999", PASSWORD));

        assertError(response, HttpStatus.BAD_REQUEST, "REQ_001");
        assertThat(json(response).get("message").asText())
                .isEqualTo("Mã nhân viên hoặc mật khẩu không chính xác");
    }

    @DisplayName("L3-AUTH-05 | State-Conflict: LOCKED account with the correct password → 403 AUTH_ACCOUNT_DISABLED 'Tài khoản đã bị khóa'")
    @Test
    void lockedAccountCannotLogIn() {
        ResponseEntity<String> response = post(API + "/auth/login", null,
                loginBody(lockedUser.getEmployeeCode(), PASSWORD));

        assertError(response, HttpStatus.FORBIDDEN, "AUTH_ACCOUNT_DISABLED");
        assertThat(json(response).get("message").asText()).isEqualTo("Tài khoản đã bị khóa");
    }

    @DisplayName("L3-AUTH-06 | Contract: the access token from login passes the real HS256 decoder — GET /me returns the caller's own profile")
    @Test
    void issuedTokenIsAcceptedByTheRealDecoder() {
        String token = tokenFor(user);

        ResponseEntity<String> response = get(API + "/me", token);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(data(response).get("employeeCode").asText()).isEqualTo(user.getEmployeeCode());
        assertThat(data(response).get("id").asLong()).isEqualTo(user.getId());
    }

    @DisplayName("L3-AUTH-07 | Input-Domain-Happy: POST /auth/refresh-token → 200 and the new access token works on GET /me")
    @Test
    void refreshReturnsAUsableAccessToken() {
        String refreshToken = data(post(API + "/auth/login", null,
                loginBody(user.getEmployeeCode(), PASSWORD))).get("refreshToken").asText();

        ResponseEntity<String> refreshed = post(API + "/auth/refresh-token", null,
                """
                {"refreshToken":"%s"}
                """.formatted(refreshToken));

        assertThat(refreshed.getStatusCode()).isEqualTo(HttpStatus.OK);
        String newAccessToken = data(refreshed).get("accessToken").asText();
        assertThat(get(API + "/me", newAccessToken).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @DisplayName("L3-AUTH-08 | Input-Domain-Invalid: refresh with a token that was never issued → 401 AUTH_SESSION_INVALID 'Refresh token không hợp lệ'")
    @Test
    void unknownRefreshTokenIsRejected() {
        ResponseEntity<String> response = post(API + "/auth/refresh-token", null,
                """
                {"refreshToken":"not-a-real-token-%d"}
                """.formatted(nextSeq()));

        assertError(response, HttpStatus.UNAUTHORIZED, "AUTH_SESSION_INVALID");
        assertThat(json(response).get("message").asText()).isEqualTo("Refresh token không hợp lệ");
    }

    @DisplayName("L3-AUTH-09 | State-Conflict: refresh after logout → 401 AUTH_SESSION_INVALID 'Token đã bị thu hồi' and the row is revoked")
    @Test
    void refreshAfterLogoutIsRejected() {
        String refreshToken = data(post(API + "/auth/login", null,
                loginBody(user.getEmployeeCode(), PASSWORD))).get("refreshToken").asText();
        assertOk(post(API + "/auth/logout", null, """
                {"refreshToken":"%s"}
                """.formatted(refreshToken)));

        ResponseEntity<String> response = post(API + "/auth/refresh-token", null,
                """
                {"refreshToken":"%s"}
                """.formatted(refreshToken));

        assertError(response, HttpStatus.UNAUTHORIZED, "AUTH_SESSION_INVALID");
        assertThat(json(response).get("message").asText()).isEqualTo("Token đã bị thu hồi");
        assertThat(latestSessionFor(user).getRevoked()).isTrue();
    }

    @DisplayName("L3-AUTH-10 | Contract: /auth/logout is public and idempotent — the same refresh token can be logged out twice → 200")
    @Test
    void logoutIsIdempotentAndNeedsNoAccessToken() {
        String refreshToken = data(post(API + "/auth/login", null,
                loginBody(user.getEmployeeCode(), PASSWORD))).get("refreshToken").asText();
        String body = """
                {"refreshToken":"%s"}
                """.formatted(refreshToken);

        assertOk(post(API + "/auth/logout", null, body));
        assertOk(post(API + "/auth/logout", null, body));

        assertThat(latestSessionFor(user).getRevoked()).isTrue();
    }

    @DisplayName("L3-AUTH-11 | Input-Domain-Happy: POST /auth/forgot-password → 200, an unused OTP row exists and one email is queued")
    @Test
    void forgotPasswordStoresAnOtpAndQueuesTheEmail() {
        ResponseEntity<String> response = post(API + "/auth/forgot-password", null,
                """
                {"email":"%s"}
                """.formatted(user.getEmail()));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        PasswordResetOtp otp = latestOtpFor(user.getEmail());
        assertThat(otp.isUsed()).isFalse();
        assertThat(otp.getOtp()).hasSize(6);
        assertThat(emailProducer.sent())
                .filteredOn(message -> user.getEmail().equals(message.getTo()))
                .hasSize(1);
    }

    @DisplayName("L3-AUTH-12 | Not-Found: forgot-password with an unknown email → 400 REQ_001 'Không tìm thấy email' (account enumeration, D39)")
    @Test
    void forgotPasswordRevealsWhetherAnEmailExists() {
        ResponseEntity<String> response = post(API + "/auth/forgot-password", null,
                """
                {"email":"nobody-%d@example.com"}
                """.formatted(nextSeq()));

        assertError(response, HttpStatus.BAD_REQUEST, "REQ_001");
        assertThat(json(response).get("message").asText()).isEqualTo("Không tìm thấy email");
        assertThat(emailProducer.sent()).isEmpty();
    }

    @DisplayName("L3-AUTH-13 | Input-Domain-Happy: reset-password with a fresh OTP → 200, OTP consumed and login with the new password succeeds")
    @Test
    void resetPasswordConsumesTheOtpAndChangesTheCredential() {
        assertOk(post(API + "/auth/forgot-password", null, """
                {"email":"%s"}
                """.formatted(user.getEmail())));
        PasswordResetOtp otp = latestOtpFor(user.getEmail());

        ResponseEntity<String> response = post(API + "/auth/reset-password", null,
                """
                {"email":"%s","otp":"%s","newPassword":"NewPass123"}
                """.formatted(user.getEmail(), otp.getOtp()));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(passwordResetRepository.findById(otp.getId()).orElseThrow().isUsed()).isTrue();
        assertOk(post(API + "/auth/login", null, loginBody(user.getEmployeeCode(), "NewPass123")));
    }

    @DisplayName("L3-AUTH-14 | State-Conflict: replaying a consumed OTP → 400 REQ_001 'Mã OTP đã được sử dụng'")
    @Test
    void consumedOtpCannotBeReplayed() {
        assertOk(post(API + "/auth/forgot-password", null, """
                {"email":"%s"}
                """.formatted(user.getEmail())));
        PasswordResetOtp otp = latestOtpFor(user.getEmail());
        String body = """
                {"email":"%s","otp":"%s","newPassword":"NewPass123"}
                """.formatted(user.getEmail(), otp.getOtp());
        assertOk(post(API + "/auth/reset-password", null, body));

        ResponseEntity<String> replay = post(API + "/auth/reset-password", null, body);

        assertError(replay, HttpStatus.BAD_REQUEST, "REQ_001");
        assertThat(json(replay).get("message").asText()).isEqualTo("Mã OTP đã được sử dụng");
    }

    @DisplayName("L3-AUTH-15 | Validation: reset-password with a 3-character newPassword → 422 VAL_001 (min length 4)")
    @Test
    void tooShortNewPasswordIsRejected() {
        ResponseEntity<String> response = post(API + "/auth/reset-password", null,
                """
                {"email":"%s","otp":"123456","newPassword":"abc"}
                """.formatted(user.getEmail()));

        assertError(response, HttpStatus.UNPROCESSABLE_ENTITY, "VAL_001");
        assertThat(json(response).get("details").toString()).contains("newPassword");
    }

    @DisplayName("L3-AUTH-16 | Auth-Missing: POST /user/first-login/send-email-otp without a token → 401 with an EMPTY body — no error_code, no correlation id (D36)")
    @Test
    void protectedEndpointWithoutTokenReturnsAnEmptyUnauthorizedBody() {
        ResponseEntity<String> response = post(API + "/user/first-login/send-email-otp", null,
                """
                {"email":"%s"}
                """.formatted(user.getEmail()));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        // D36: SecurityConfig registers no authenticationEntryPoint, so the Bearer entry point
        // answers before the dispatcher — the documented {error_code, message, correlation_id}
        // envelope does not hold for authentication failures.
        assertThat(response.getBody()).isNullOrEmpty();
        assertThat(response.getHeaders().getFirst("WWW-Authenticate")).contains("Bearer");
        assertThat(response.getHeaders().getFirst("X-Correlation-ID")).isNull();
    }

    private String loginBody(String employeeCode, String password) {
        return """
                {"employeeCode":"%s","password":"%s"}
                """.formatted(employeeCode, password);
    }

    private PasswordResetOtp latestOtpFor(String email) {
        return passwordResetRepository.findAll().stream()
                .filter(item -> email.equals(item.getEmail()))
                .max(java.util.Comparator.comparing(PasswordResetOtp::getId))
                .orElseThrow(() -> new AssertionError("no OTP row for " + email));
    }

    private vn.vietduc.carehubbackend.auth.entity.RefreshToken latestSessionFor(User sessionUser) {
        return refreshTokenRepository.findAll().stream()
                .filter(token -> token.getUser().getId().equals(sessionUser.getId()))
                .max(java.util.Comparator.comparing(vn.vietduc.carehubbackend.auth.entity.RefreshToken::getId))
                .orElseThrow(() -> new AssertionError("no refresh session for " + sessionUser.getEmployeeCode()));
    }
}
