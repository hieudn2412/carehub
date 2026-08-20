package vn.vietduc.carehubbackend.api;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * L3 system/API tests — sheet {@code L3-UserAdminAPI}, ids L3-USR-01…16.
 *
 * <p>Covers the admin surface of {@code user/}: paging and filtering contracts, bean-validation
 * details, the role gate on every write, reference data, and the account lifecycle (lock, soft
 * delete) as observed from the outside.
 *
 * <p>Pins D37: {@code GET /users} is the one paginated endpoint that serialises Spring's
 * {@code PageImpl} instead of the project's {@code PageResponse}, so its envelope differs from every
 * other list endpoint.
 */
class UserAdminApiSystemTest extends AbstractApiSystemTest {

    private User admin;
    private User employee;
    private String adminToken;
    private String employeeToken;

    @BeforeEach
    void createFixtures() {
        admin = newUser("L3ADM", "ADMIN");
        employee = newUser("L3EMP", "USER");
        adminToken = tokenFor(admin);
        employeeToken = tokenFor(employee);
    }

    @DisplayName("L3-USR-01 | Pagination: GET /users?page=0&size=20 as ADMIN → 200; the envelope is Spring's raw PageImpl, not PageResponse (D37)")
    @Test
    void listUsersLeaksSpringPageShape() {
        ResponseEntity<String> response = get(API + "/users?page=0&size=20", adminToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode page = data(response);
        assertThat(page.get("content").isArray()).isTrue();
        // D37: PageResponse would expose exactly {content, page, size, totalElements, totalPages,
        // sort}. Here Jackson serialises the Page object itself, so callers see Spring internals.
        assertThat(page.has("pageable")).as("PageImpl serialisation leaks 'pageable'").isTrue();
        assertThat(page.has("numberOfElements")).isTrue();
        assertThat(page.has("page")).as("PageResponse's 'page' field is absent").isFalse();
    }

    @DisplayName("L3-USR-02 | Pagination: GET /users?keyword=<employeeCode> narrows the page to that one employee")
    @Test
    void keywordFilterNarrowsThePage() {
        ResponseEntity<String> response = get(API + "/users?keyword=" + employee.getEmployeeCode(), adminToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode content = data(response).get("content");
        assertThat(content).hasSize(1);
        assertThat(content.get(0).get("employeeCode").asText()).isEqualTo(employee.getEmployeeCode());
    }

    @DisplayName("L3-USR-03 | Input-Domain-Invalid: GET /users?status=NOT_A_STATUS → 422 VAL_001 with the failing field in details")
    @Test
    void invalidEnumQueryParamIsRejected() {
        ResponseEntity<String> response = get(API + "/users?status=NOT_A_STATUS", adminToken);

        // A bad enum on a @ModelAttribute filter binds through MethodArgumentNotValidException, so it
        // answers 422 VAL_001 — unlike a bad enum on a plain @RequestParam, which is 400 REQ_001.
        assertError(response, HttpStatus.UNPROCESSABLE_ENTITY, "VAL_001");
        assertThat(json(response).get("details").toString()).contains("status");
    }

    @DisplayName("L3-USR-04 | Input-Domain-Happy: POST /users as ADMIN → user row created with the USER role and a credentials email queued")
    @Test
    void createUserPersistsTheAccountAndQueuesTheEmail() {
        int n = nextSeq();
        String code = "L3NEW%04d".formatted(n);
        String email = "l3new%04d@example.com".formatted(n);

        ResponseEntity<String> response = post(API + "/users", adminToken, """
                {"employeeCode":"%s","departmentId":%d,"email":"%s","roleIds":[%d],"fullName":"New Hire %d"}
                """.formatted(code, sharedDepartment().getId(), email, role("USER").getId(), n));

        assertOk(response);
        User created = userRepository.findByEmployeeCodeAndIsDeletedFalse(code).orElseThrow();
        assertThat(created.getEmail()).isEqualTo(email);
        assertThat(emailProducer.sent()).anyMatch(message -> email.equals(message.getTo()));
    }

    @DisplayName("L3-USR-05 | Validation: POST /users without employeeCode and roleIds → 422 VAL_001 listing both fields")
    @Test
    void createUserValidatesRequiredFields() {
        ResponseEntity<String> response = post(API + "/users", adminToken, """
                {"departmentId":%d,"email":"missing-fields@example.com","fullName":"No Code"}
                """.formatted(sharedDepartment().getId()));

        assertError(response, HttpStatus.UNPROCESSABLE_ENTITY, "VAL_001");
        assertThat(json(response).get("details").toString())
                .contains("employeeCode")
                .contains("roleIds");
    }

    @DisplayName("L3-USR-06 | State-Conflict: POST /users with an existing employeeCode → 409 SYS_409 'Mã nhân viên đã tồn tại'")
    @Test
    void duplicateEmployeeCodeIsRejectedWithConflict() {
        ResponseEntity<String> response = post(API + "/users", adminToken, """
                {"employeeCode":"%s","departmentId":%d,"email":"dup-%d@example.com","roleIds":[%d],"fullName":"Duplicate"}
                """.formatted(employee.getEmployeeCode(), sharedDepartment().getId(), nextSeq(),
                role("USER").getId()));

        assertError(response, HttpStatus.CONFLICT, "SYS_409");
        assertThat(json(response).get("message").asText()).isEqualTo("Mã nhân viên đã tồn tại");
    }

    @DisplayName("L3-USR-07 | Auth-Wrong-Role: POST /users with a USER token → 403 AUTH_002 and no row is created")
    @Test
    void nonAdminCannotCreateUsers() {
        long before = userRepository.count();

        ResponseEntity<String> response = post(API + "/users", employeeToken, """
                {"employeeCode":"L3FORBID%d","departmentId":%d,"email":"forbid-%d@example.com","roleIds":[%d],"fullName":"Forbidden"}
                """.formatted(nextSeq(), sharedDepartment().getId(), nextSeq(), role("USER").getId()));

        assertError(response, HttpStatus.FORBIDDEN, "AUTH_002");
        assertThat(userRepository.count()).isEqualTo(before);
    }

    @DisplayName("L3-USR-08 | Auth-Missing: GET /users without an Authorization header → 401 with an empty body (D36)")
    @Test
    void listUsersWithoutTokenIsUnauthorized() {
        ResponseEntity<String> response = get(API + "/users", null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody()).isNullOrEmpty();
    }

    @DisplayName("L3-USR-09 | Input-Domain-Happy: GET /user/{id} as ADMIN → 200 with the employee's department resolved")
    @Test
    void adminReadsASingleUser() {
        ResponseEntity<String> response = get(API + "/user/" + employee.getId(), adminToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = data(response);
        assertThat(body.get("employeeCode").asText()).isEqualTo(employee.getEmployeeCode());
        assertThat(body.get("departmentId").asLong()).isEqualTo(sharedDepartment().getId());
    }

    @DisplayName("L3-USR-10 | Input-Domain-Happy: PATCH /user/change-password → 200 and the new password logs in")
    @Test
    void changePasswordSwitchesTheCredential() {
        ResponseEntity<String> response = patch(API + "/user/change-password", employeeToken, """
                {"oldPassword":"%s","newPassword":"Rotated123","confirmNewPassword":"Rotated123"}
                """.formatted(PASSWORD));

        assertOk(response);
        assertOk(post(API + "/auth/login", null, """
                {"employeeCode":"%s","password":"Rotated123"}
                """.formatted(employee.getEmployeeCode())));
    }

    @DisplayName("L3-USR-11 | Input-Domain-Invalid: change-password with a wrong oldPassword → 400 REQ_001 'Mật khẩu cũ không chính xác'")
    @Test
    void changePasswordRejectsAWrongCurrentPassword() {
        ResponseEntity<String> response = patch(API + "/user/change-password", employeeToken, """
                {"oldPassword":"NotMyPassword1","newPassword":"Rotated123","confirmNewPassword":"Rotated123"}
                """);

        assertError(response, HttpStatus.BAD_REQUEST, "REQ_001");
        assertThat(json(response).get("message").asText()).isEqualTo("Mật khẩu cũ không chính xác");
    }

    @DisplayName("L3-USR-12 | State-Conflict: PATCH /users/{id}/lock blocks login, /unlock restores it")
    @Test
    void lockAndUnlockGateLogin() {
        assertOk(patch(API + "/users/" + employee.getId() + "/lock", adminToken, null));

        ResponseEntity<String> blocked = post(API + "/auth/login", null, """
                {"employeeCode":"%s","password":"%s"}
                """.formatted(employee.getEmployeeCode(), PASSWORD));
        assertError(blocked, HttpStatus.FORBIDDEN, "AUTH_ACCOUNT_DISABLED");
        assertThat(userRepository.findById(employee.getId()).orElseThrow().getStatus())
                .isEqualTo(UserStatus.LOCKED);

        assertOk(patch(API + "/users/" + employee.getId() + "/unlock", adminToken, null));
        assertOk(post(API + "/auth/login", null, """
                {"employeeCode":"%s","password":"%s"}
                """.formatted(employee.getEmployeeCode(), PASSWORD)));
    }

    @DisplayName("L3-USR-13 | Input-Domain-Happy: DELETE /user/{id} soft-deletes — is_deleted=true and login stops working")
    @Test
    void deleteUserIsASoftDelete() {
        User victim = newUser("L3DEL", "USER");

        assertOk(delete(API + "/user/" + victim.getId(), adminToken));

        assertThat(userRepository.findById(victim.getId()).orElseThrow().isDeleted()).isTrue();
        assertError(post(API + "/auth/login", null, """
                {"employeeCode":"%s","password":"%s"}
                """.formatted(victim.getEmployeeCode(), PASSWORD)), HttpStatus.BAD_REQUEST, "REQ_001");
    }

    @DisplayName("L3-USR-14 | Not-Found: GET /user/{unknownId} → 404 SYS_404")
    @Test
    void unknownUserIdIsNotFound() {
        ResponseEntity<String> response = get(API + "/user/99999999", adminToken);

        assertError(response, HttpStatus.NOT_FOUND, "SYS_404");
    }

    @DisplayName("L3-USR-15 | Input-Domain-Happy: POST /departments as ADMIN → 200 and the row is listed by GET /departments")
    @Test
    void adminCreatesReferenceData() {
        String code = "L3D%04d".formatted(nextSeq());

        assertOk(post(API + "/departments", adminToken, """
                {"departmentCode":"%s","name":"Khoa thử nghiệm %s"}
                """.formatted(code, code)));

        ResponseEntity<String> list = get(API + "/departments", adminToken);
        assertThat(response(list)).contains(code);
    }

    @DisplayName("L3-USR-16 | Auth-Wrong-Role: GET /departments with a USER token → 403 AUTH_002 (class-level ADMIN gate)")
    @Test
    void nonAdminCannotReadReferenceData() {
        ResponseEntity<String> response = get(API + "/departments", employeeToken);

        assertError(response, HttpStatus.FORBIDDEN, "AUTH_002");
    }

    private String response(ResponseEntity<String> response) {
        assertOk(response);
        return response.getBody() == null ? "" : response.getBody();
    }
}
