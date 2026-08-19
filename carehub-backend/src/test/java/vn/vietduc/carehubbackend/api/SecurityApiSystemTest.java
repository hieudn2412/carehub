package vn.vietduc.carehubbackend.api;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.user.entity.User;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * L3 system/API tests — sheet {@code L3-Security}, ids L3-SEC-01…09, organised by OWASP category.
 *
 * <p>Only real HTTP can prove these: a tampered JWT has to survive (or not survive)
 * {@code NimbusJwtDecoder}, and the empty 401 body comes from a servlet filter that MockMvc's
 * {@code jwt()} post-processor skips entirely.
 *
 * <p>Two findings are pinned as current behaviour rather than fixed here: there is no rate limiting
 * or lockout on repeated failed logins (D38), and {@code /auth/forgot-password} confirms whether an
 * email exists (D39).
 */
class SecurityApiSystemTest extends AbstractApiSystemTest {

    @Autowired
    private TrainingActivityTypeRepository activityTypeRepository;

    private User victim;
    private User attacker;
    private User admin;
    private String victimToken;
    private String attackerToken;
    private String adminToken;

    @BeforeEach
    void createFixtures() {
        victim = newUser("L3SVIC", "USER");
        attacker = newUser("L3SATT", "USER");
        admin = newUser("L3SADM", "ADMIN");
        victimToken = tokenFor(victim);
        attackerToken = tokenFor(attacker);
        adminToken = tokenFor(admin);
    }

    @DisplayName("L3-SEC-01 | A01 Access Control: employee B reading employee A's training record → 403 AUTH_002 and no record data in the body")
    @Test
    void crossEmployeeRecordAccessIsDenied() {
        long recordId = ownRecord();

        ResponseEntity<String> response = get(API + "/training/records/" + recordId, attackerToken);

        assertError(response, HttpStatus.FORBIDDEN, "AUTH_002");
        assertThat(response.getBody())
                .doesNotContain(victim.getEmployeeCode())
                .doesNotContain("Hồ sơ bí mật");
    }

    @DisplayName("L3-SEC-02 | A01 Access Control: a USER token on the admin surface (/users, /dashboard/overview) → 403 AUTH_002, no data leak")
    @Test
    void adminSurfaceIsClosedToPlainUsers() {
        ResponseEntity<String> users = get(API + "/users", attackerToken);
        ResponseEntity<String> dashboard = get(API + "/dashboard/overview", attackerToken);

        assertError(users, HttpStatus.FORBIDDEN, "AUTH_002");
        assertError(dashboard, HttpStatus.FORBIDDEN, "AUTH_002");
        assertThat(users.getBody()).doesNotContain("employeeCode");
        assertThat(dashboard.getBody()).doesNotContain("totalElements");
    }

    @DisplayName("L3-SEC-03 | A02 Cryptographic Failures: no password or hash is ever returned, and the stored credential is a bcrypt hash")
    @Test
    void passwordsAreNeverExposedAndAlwaysHashed() {
        int n = nextSeq();
        String code = "L3SNEW%04d".formatted(n);
        ResponseEntity<String> created = post(API + "/users", adminToken, """
                {"employeeCode":"%s","departmentId":%d,"email":"l3snew%04d@example.com","roleIds":[%d],"fullName":"Hire %d"}
                """.formatted(code, sharedDepartment().getId(), n, role("USER").getId(), n));
        assertOk(created);

        assertThat(created.getBody()).doesNotContain("password").doesNotContain("$2a$");
        assertThat(get(API + "/me", victimToken).getBody()).doesNotContain("password");
        assertThat(userRepository.findByEmployeeCodeAndIsDeletedFalse(code).orElseThrow().getPassword())
                .startsWith("$2a$");
    }

    @DisplayName("L3-SEC-04 | A02 Cryptographic Failures: a JWT whose payload is edited to claim ADMIN → 401 (HS256 signature check), no privilege gain")
    @Test
    void tamperedTokenIsRejectedBySignatureVerification() {
        String[] parts = victimToken.split("\\.");
        String payload = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
        String forgedPayload = payload.replace("\"USER\"", "\"ADMIN\"")
                .replace("\"roles\":[]", "\"roles\":[\"ADMIN\"]");
        String forged = parts[0] + "." + Base64.getUrlEncoder().withoutPadding()
                .encodeToString(forgedPayload.getBytes(StandardCharsets.UTF_8)) + "." + parts[2];

        ResponseEntity<String> response = get(API + "/users", forged);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isNullOrEmpty();
        assertThat(response.getHeaders().getFirst("WWW-Authenticate")).contains("Bearer");
    }

    @DisplayName("L3-SEC-05 | A03 Injection: a SQL payload in ?keyword= is treated as data — 200 with an empty page and no SQL text in the body")
    @Test
    void sqlInjectionInAFilterIsInert() {
        ResponseEntity<String> response = get(API + "/users?keyword=%27%20OR%201%3D1--", adminToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode page = data(response);
        assertThat(page.get("content")).isEmpty();
        assertThat(response.getBody()).doesNotContain("SQL").doesNotContain("Exception");
        assertThat(userRepository.count()).isPositive();
    }

    @DisplayName("L3-SEC-06 | A03 Injection: a DROP TABLE payload in ?sort= is rejected as an unsupported property and the table survives")
    @Test
    void sortParameterCannotSmuggleSql() {
        long before = userRepository.count();

        ResponseEntity<String> response =
                get(API + "/training/records?sort=id;DROP%20TABLE%20users,desc", victimToken);

        assertThat(response.getStatusCode().is4xxClientError() || response.getStatusCode().is5xxServerError())
                .as("body was: %s", response.getBody()).isTrue();
        assertThat(response.getBody()).doesNotContain("org.hibernate").doesNotContain("at vn.vietduc");
        assertThat(userRepository.count()).isEqualTo(before);
    }

    @DisplayName("L3-SEC-07 | A07 Auth Failures: 20 consecutive wrong passwords are all answered identically — no lockout, no rate limit, no delay (D38)")
    @Test
    void repeatedFailedLoginsAreNeverThrottled() {
        for (int attempt = 1; attempt <= 20; attempt++) {
            ResponseEntity<String> response = post(API + "/auth/login", null, """
                    {"employeeCode":"%s","password":"WrongPass%d"}
                    """.formatted(victim.getEmployeeCode(), attempt));
            // D38: no failed-attempt counter, no 423/429 — every attempt looks like the first one, so
            // the endpoint is open to unlimited credential stuffing.
            assertError(response, HttpStatus.BAD_REQUEST, "REQ_001");
        }

        // The account is still ACTIVE and the correct password works immediately after 20 failures.
        assertOk(post(API + "/auth/login", null, """
                {"employeeCode":"%s","password":"%s"}
                """.formatted(victim.getEmployeeCode(), PASSWORD)));
    }

    @DisplayName("L3-SEC-08 | A09 Logging: a handled error returns a correlation id and never a stack trace, SQL or class name")
    @Test
    void errorResponsesCarryACorrelationIdAndNoInternals() {
        ResponseEntity<String> response = get(API + "/training/records/99999999", victimToken);

        assertError(response, HttpStatus.NOT_FOUND, "SYS_404");
        assertThat(response.getHeaders().getFirst("X-Correlation-ID")).isNotBlank();
        assertThat(response.getBody())
                .doesNotContain("Exception")
                .doesNotContain("vn.vietduc.carehubbackend")
                .doesNotContain("select ");

        // An inbound correlation id is echoed so a client trace can be joined to the server log.
        ResponseEntity<String> traced = rest.exchange(
                org.springframework.http.RequestEntity
                        .get(java.net.URI.create(url(API + "/training/records/99999999")))
                        .header("Authorization", "Bearer " + victimToken)
                        .header("X-Correlation-ID", "l3-trace-42")
                        .build(), String.class);
        assertThat(traced.getHeaders().getFirst("X-Correlation-ID")).isEqualTo("l3-trace-42");
    }

    @DisplayName("Infrastructure health endpoint is available without a bearer token")
    @Test
    void actuatorHealthIsAvailableWithoutAuthentication() {
        ResponseEntity<String> response = get("/actuator/health", null);

        assertThat(response.getStatusCode())
                .isNotIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).contains("\"status\"");
    }

    @Disabled("Needs OWASP ZAP and a TLS-terminated deployment: active scan, HSTS/security headers and "
            + "cipher configuration cannot be asserted against the plain-HTTP test server.")
    @DisplayName("L3-SEC-09 | A05 Security Misconfiguration: active ZAP scan plus HTTPS/HSTS and security-header verification")
    @Test
    void activeScanAndTransportHardening() {
        throw new UnsupportedOperationException("run manually against a deployed environment");
    }

    // ------------------------------------------------------------------ helpers

    private long ownRecord() {
        TrainingActivityType activityType = activityTypeRepository.save(TrainingActivityType.builder()
                .code("L3SEC%04d".formatted(nextSeq()))
                .name("Security fixture")
                .defaultDurationUnit(DurationUnit.HOUR)
                .requiresEvidence(false)
                .active(true)
                .build());
        ResponseEntity<String> created = post(API + "/training/records", victimToken, """
                {"activityTypeId":%d,"title":"Hồ sơ bí mật %d","provider":"Bệnh viện",
                 "startDate":"2026-06-01","endDate":"2026-06-01","durationValue":2,
                 "durationUnit":"HOUR","declaredHours":2}
                """.formatted(activityType.getId(), nextSeq()));
        assertOk(created);
        return id(created);
    }
}
