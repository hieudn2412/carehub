package vn.vietduc.carehubbackend.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.core5.util.Timeout;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.DefaultResponseErrorHandler;
import org.springframework.web.client.RestTemplate;
import vn.vietduc.carehubbackend.config.CapturingEmailProducerConfig;
import vn.vietduc.carehubbackend.config.CapturingEmailProducerConfig.CapturingEmailProducer;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Permission;
import vn.vietduc.carehubbackend.user.entity.Role;
import vn.vietduc.carehubbackend.user.entity.RolePermission;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserRole;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.PermissionRepository;
import vn.vietduc.carehubbackend.user.repository.RolePermissionRepository;
import vn.vietduc.carehubbackend.user.repository.RoleRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.repository.UserRoleRepository;

import java.time.Duration;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Shared base for the L3 system/API tests — the only tests in the repo that talk to the application
 * over <b>real HTTP</b>.
 *
 * <p>Why that matters: the 20 existing integration tests use {@code MockMvc} plus
 * {@code SecurityMockMvcRequestPostProcessors.jwt()}, which injects an already-authenticated token
 * and therefore never exercises the servlet filter chain, {@code NimbusJwtDecoder} (HS256 signature
 * verification), {@code CustomJwtAuthenticationConverter}, the Bearer entry point that answers 401,
 * CORS, or the multipart size limits. L3 boots Tomcat on a random port, logs in through
 * {@code POST /api/v1/auth/login} and sends the returned token as a real {@code Authorization}
 * header, so all of that is under test.
 *
 * <p><b>No {@code @Transactional}.</b> With a real server the request runs on a Tomcat thread with
 * its own transaction, so a test-managed rollback would hide every fixture row from the endpoint
 * under test. Fixtures therefore use unique codes ({@link #SEQ}) and assertions are scoped to the
 * ids each test created. The H2 database is per-context ({@code ${random.uuid}} in the test profile)
 * and dropped when the context closes.
 *
 * <p>Every L3 class must extend this type <em>without adding annotations of its own</em>: the
 * annotation set below is the Spring context cache key, so a single divergent property would boot a
 * second application context (~20 s each).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(CapturingEmailProducerConfig.class)
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        // Two @Scheduled beans are NOT disabled by the test profile and would fire mid-assertion:
        // FormScoringRecalculationDispatcher (30 s) and EvidenceObjectDeletionService (10 min).
        "app.form-scoring.recalculation-scan-ms=3600000",
        "app.training.evidence.delete-retry-ms=3600000"
})
public abstract class AbstractApiSystemTest {

    protected static final String API = "/api/v1";
    /** Password every fixture user is created with. */
    protected static final String PASSWORD = "Correct123";
    /** Keeps employee codes / entity codes unique — fixtures are never rolled back. */
    protected static final AtomicInteger SEQ = new AtomicInteger();

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Object FIXTURE_LOCK = new Object();

    /**
     * Plain {@link RestTemplate} rather than Boot's {@code TestRestTemplate}: the latter lives in
     * {@code spring-boot-resttestclient}, whose autoconfiguration needs
     * {@code org.springframework.boot.restclient.RestTemplateBuilder} — and the
     * {@code spring-boot-restclient} module is not on this project's classpath. Same behaviour is
     * reproduced here: absolute URL from {@link #port}, PATCH-capable Apache request factory, and no
     * exception on 4xx/5xx so error contracts can be asserted.
     */
    protected RestTemplate rest;
    @LocalServerPort
    protected int port;

    @Autowired
    protected UserRepository userRepository;
    @Autowired
    protected RoleRepository roleRepository;
    @Autowired
    protected UserRoleRepository userRoleRepository;
    @Autowired
    protected PermissionRepository permissionRepository;
    @Autowired
    protected RolePermissionRepository rolePermissionRepository;
    @Autowired
    protected DepartmentRepository departmentRepository;
    @Autowired
    protected PasswordEncoder passwordEncoder;
    @Autowired
    protected CapturingEmailProducer emailProducer;

    /**
     * SimpleClientHttpRequestFactory builds on HttpURLConnection, which cannot send PATCH. The
     * Apache factory supports PATCH and avoids JDK HttpClient loopback requests occasionally waiting
     * indefinitely while the embedded Tomcat suite reuses its context.
     */
    @BeforeEach
    void buildClientAndResetCaptures() {
        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectTimeout(Timeout.ofSeconds(5))
                .build();
        HttpComponentsClientHttpRequestFactory requestFactory = new HttpComponentsClientHttpRequestFactory(
                HttpClients.custom().setDefaultRequestConfig(requestConfig).build());
        requestFactory.setConnectionRequestTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(Duration.ofSeconds(30));
        rest = new RestTemplate(requestFactory);
        // Error statuses are the assertion subject here, so never turn them into exceptions.
        rest.setErrorHandler(new DefaultResponseErrorHandler() {
            @Override
            public boolean hasError(ClientHttpResponse response) {
                return false;
            }
        });
        emailProducer.reset();
    }

    /** Absolute URL of a path on the booted server. */
    protected String url(String path) {
        return "http://localhost:" + port + path;
    }

    // ---------------------------------------------------------------- HTTP

    protected ResponseEntity<String> get(String path, String token) {
        return exchange(HttpMethod.GET, path, token, null);
    }

    protected ResponseEntity<String> post(String path, String token, String jsonBody) {
        return exchange(HttpMethod.POST, path, token, jsonBody);
    }

    protected ResponseEntity<String> put(String path, String token, String jsonBody) {
        return exchange(HttpMethod.PUT, path, token, jsonBody);
    }

    protected ResponseEntity<String> patch(String path, String token, String jsonBody) {
        return exchange(HttpMethod.PATCH, path, token, jsonBody);
    }

    protected ResponseEntity<String> delete(String path, String token) {
        return exchange(HttpMethod.DELETE, path, token, null);
    }

    protected ResponseEntity<String> exchange(HttpMethod method, String path, String token, String jsonBody) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(java.util.List.of(MediaType.APPLICATION_JSON, MediaType.ALL));
        if (token != null) {
            headers.setBearerAuth(token);
        }
        return rest.exchange(url(path), method, new HttpEntity<>(jsonBody, headers), String.class);
    }

    /** Multipart upload with an explicit filename and content type (null content type = omitted). */
    protected ResponseEntity<String> upload(String path,
                                            String token,
                                            String partName,
                                            String filename,
                                            byte[] content,
                                            MediaType contentType) {
        HttpHeaders partHeaders = new HttpHeaders();
        if (contentType != null) {
            partHeaders.setContentType(contentType);
        }
        ByteArrayResource resource = new ByteArrayResource(content) {
            @Override
            public String getFilename() {
                return filename;
            }
        };
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add(partName, new HttpEntity<>(resource, partHeaders));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        if (token != null) {
            headers.setBearerAuth(token);
        }
        return rest.exchange(url(path), HttpMethod.POST, new HttpEntity<>(body, headers), String.class);
    }

    // ---------------------------------------------------------------- JSON

    protected JsonNode json(ResponseEntity<String> response) {
        try {
            return MAPPER.readTree(response.getBody() == null ? "{}" : response.getBody());
        } catch (Exception e) {
            throw new AssertionError("response body is not JSON: " + response.getBody(), e);
        }
    }

    /** {@code data} of the standard {@code ApiResponse} envelope. */
    protected JsonNode data(ResponseEntity<String> response) {
        JsonNode body = json(response);
        assertThat(body.has("data")).as("ApiResponse envelope missing 'data': %s", body).isTrue();
        return body.get("data");
    }

    protected long id(ResponseEntity<String> response) {
        return data(response).get("id").asLong();
    }

    // ---------------------------------------------------------------- assertions

    /**
     * Asserts the {@code ErrorResponse} contract: status, {@code error_code}, correlation header.
     *
     * <p>Compares the numeric status code, not the enum: Spring Framework 7 renamed 422 from
     * {@code UNPROCESSABLE_ENTITY} to {@code UNPROCESSABLE_CONTENT}, so the constants are not
     * interchangeable even though the wire value is identical.
     */
    protected void assertError(ResponseEntity<String> response, HttpStatus status, String errorCode) {
        assertThat(response.getStatusCode().value())
                .as("body was: %s", response.getBody())
                .isEqualTo(status.value());
        JsonNode body = json(response);
        assertThat(body.path("error_code").asText()).isEqualTo(errorCode);
        assertThat(body.path("message").asText()).isNotBlank();
        assertThat(response.getHeaders().getFirst("X-Correlation-ID")).isNotBlank();
    }

    protected void assertOk(ResponseEntity<String> response) {
        assertThat(response.getStatusCode())
                .as("expected 2xx, body was: %s", response.getBody())
                .matches(HttpStatusCode::is2xxSuccessful);
    }

    // ---------------------------------------------------------------- auth

    /** Real login through the public endpoint; returns the HS256-signed access token. */
    protected String login(String employeeCode, String password) {
        ResponseEntity<String> response = post(API + "/auth/login", null,
                """
                {"employeeCode":"%s","password":"%s"}
                """.formatted(employeeCode, password));
        assertOk(response);
        return data(response).get("accessToken").asText();
    }

    protected String tokenFor(User user) {
        return login(user.getEmployeeCode(), PASSWORD);
    }

    // ---------------------------------------------------------------- fixtures

    protected int nextSeq() {
        return SEQ.incrementAndGet();
    }

    /** Fixture user with the given role codes (ADMIN / MANAGER / USER — created once, reused). */
    protected User newUser(String prefix, String... roleCodes) {
        int n = nextSeq();
        User user = userRepository.save(User.builder()
                .employeeCode("%s%04d".formatted(prefix, n))
                .email("%s%04d@example.com".formatted(prefix.toLowerCase(), n))
                .name("%s %d".formatted(prefix, n))
                .department(sharedDepartment())
                .password(passwordEncoder.encode(PASSWORD))
                .status(UserStatus.ACTIVE)
                .build());
        for (String roleCode : roleCodes) {
            userRoleRepository.save(UserRole.builder().user(user).role(role(roleCode)).build());
        }
        return user;
    }

    /**
     * Fixture user holding evaluation permissions (and no role): a dedicated role is created per
     * user because {@code roles.code} is unique, and the permissions land in the JWT
     * {@code permissions} claim exactly like production.
     */
    protected User newUserWithPermissions(String prefix, String... permissionCodes) {
        User user = newUser(prefix);
        Role scoped = roleRepository.save(Role.builder()
                .code("L3PERM_" + user.getEmployeeCode())
                .name("L3 scoped permissions " + user.getEmployeeCode())
                .build());
        for (String code : permissionCodes) {
            rolePermissionRepository.save(RolePermission.builder()
                    .role(scoped)
                    .permission(permission(code))
                    .build());
        }
        userRoleRepository.save(UserRole.builder().user(user).role(scoped).build());
        return user;
    }

    protected Role role(String code) {
        synchronized (FIXTURE_LOCK) {
            return roleRepository.findByCode(code).orElseGet(() -> roleRepository.save(
                    Role.builder().code(code).name(code).build()));
        }
    }

    protected Permission permission(String code) {
        synchronized (FIXTURE_LOCK) {
            return permissionRepository.findByCodeIn(Set.of(code)).stream().findFirst()
                    .orElseGet(() -> permissionRepository.save(
                            Permission.builder().code(code).name(code).build()));
        }
    }

    /** One department shared by every fixture user — cheap and enough for API-contract tests. */
    protected Department sharedDepartment() {
        synchronized (FIXTURE_LOCK) {
            return departmentRepository.findByDepartmentCodeIn(Set.of("L3DEPT")).stream().findFirst()
                    .orElseGet(() -> departmentRepository.save(Department.builder()
                            .departmentCode("L3DEPT")
                            .name("L3 System Test Department")
                            .build()));
        }
    }
}
