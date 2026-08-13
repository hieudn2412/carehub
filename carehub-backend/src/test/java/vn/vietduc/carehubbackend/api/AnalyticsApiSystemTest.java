package vn.vietduc.carehubbackend.api;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import vn.vietduc.carehubbackend.questiongeneration.security.EvaluationPermissions;
import vn.vietduc.carehubbackend.user.entity.User;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * L3 system/API tests — sheet {@code L3-AnalyticsAPI}, ids L3-ANL-01…13.
 *
 * <p>Read-side contracts: admin dashboards, the manager roll-up, the evaluation dashboard, competency
 * paging, in-app notifications and global settings — plus the role/permission gate on each.
 *
 * <p>Environment note: {@code DashboardService} queries through {@code NamedParameterJdbcTemplate}
 * with syntax that reads as PostgreSQL-only ({@code ::numeric} casts,
 * {@code date_trunc(… at time zone …)}, {@code count(*) filter (where …)}). H2 in
 * {@code MODE=PostgreSQL} executes all of it, so these run green here — but only the bucket
 * boundaries of {@code /forms/trend} and the rounding of the cast expressions are guaranteed on the
 * real database. Three different pagination shapes show up in this one sheet: {@code PageResponse},
 * Spring's raw {@code Page} (see {@code L3-USR-01}) and pagination flattened onto a domain DTO.
 */
class AnalyticsApiSystemTest extends AbstractApiSystemTest {

    private User admin;
    private User manager;
    private User employee;
    private String adminToken;
    private String managerToken;
    private String employeeToken;

    @BeforeEach
    void createFixtures() {
        admin = newUser("L3AADM", "ADMIN");
        manager = newUser("L3AMGR", "MANAGER");
        employee = newUser("L3AEMP", "USER");
        adminToken = tokenFor(admin);
        managerToken = tokenFor(manager);
        employeeToken = tokenFor(employee);
    }

    @DisplayName("L3-ANL-01 | Input-Domain-Happy: GET /dashboard/overview as ADMIN → 200 with the users/forms/submissions blocks and a cache TTL")
    @Test
    void adminOverviewReturnsAllBlocks() {
        ResponseEntity<String> response = get(API + "/dashboard/overview", adminToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = data(response);
        assertThat(body.get("cacheTtlSeconds").asInt()).isPositive();
        assertThat(body.has("period")).isTrue();
        assertThat(body.get("users").get("total").asInt()).isPositive();
        assertThat(body.has("forms")).isTrue();
        assertThat(body.has("submissions")).isTrue();
    }

    @DisplayName("L3-ANL-02 | Input-Domain-Happy: GET /dashboard/users/summary as ADMIN → 200 with byStatus and byRole aggregates")
    @Test
    void userSummaryAggregatesByStatusAndRole() {
        ResponseEntity<String> response = get(API + "/dashboard/users/summary", adminToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = data(response);
        assertThat(body.get("total").asInt()).isPositive();
        assertThat(body.has("byStatus")).isTrue();
        assertThat(body.get("byRole").isArray()).isTrue();
    }

    @DisplayName("L3-ANL-03 | Auth-Wrong-Role: GET /dashboard/users/summary with a MANAGER token → 403 AUTH_002 (admin-only dashboard)")
    @Test
    void managerCannotReadTheAdminUserSummary() {
        assertError(get(API + "/dashboard/users/summary", managerToken), HttpStatus.FORBIDDEN, "AUTH_002");
    }

    @DisplayName("L3-ANL-04 | Pagination: GET /dashboard/forms/performance as ADMIN → 200 sorted by responseCount,desc")
    @Test
    void formPerformanceIsPaginated() {
        ResponseEntity<String> response = get(API + "/dashboard/forms/performance?page=0&size=10", adminToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode page = data(response);
        assertThat(page.get("content").isArray()).isTrue();
        assertThat(page.get("size").asInt()).isEqualTo(10);
    }

    @DisplayName("L3-ANL-05 | Query-Correctness: GET /dashboard/forms/trend?granularity=day as ADMIN → 200 with bucketed points")
    @Test
    void formTrendReturnsBuckets() {
        ResponseEntity<String> response = get(API + "/dashboard/forms/trend", adminToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(data(response).get("items").isArray()).isTrue();
    }

    @DisplayName("L3-ANL-06 | Input-Domain-Happy: GET /dashboard/manager/overview as MANAGER → 200 scoped to the caller's department")
    @Test
    void managerOverviewIsScopedToOwnDepartment() {
        ResponseEntity<String> response = get(API + "/dashboard/manager/overview", managerToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = data(response);
        assertThat(body.get("scope").get("departmentId").asLong())
                .isEqualTo(sharedDepartment().getId());
        assertThat(body.has("training")).isTrue();
        assertThat(body.has("theory")).isTrue();
        assertThat(body.has("quality")).isTrue();
    }

    @DisplayName("L3-ANL-07 | Auth-Wrong-Role: GET /dashboard/manager/overview with a USER token → 403 AUTH_002")
    @Test
    void plainUserCannotReadTheManagerDashboard() {
        assertError(get(API + "/dashboard/manager/overview", employeeToken), HttpStatus.FORBIDDEN, "AUTH_002");
    }

    @DisplayName("L3-ANL-08 | Input-Domain-Happy: GET /evaluation-dashboard/question-bank-summary with RESULT_VIEWER → 200 with status counters")
    @Test
    void questionBankSummaryIsOpenToResultViewers() {
        String viewerToken = tokenFor(newUserWithPermissions("L3ARES", EvaluationPermissions.RESULT_VIEWER));

        ResponseEntity<String> response = get(API + "/evaluation-dashboard/question-bank-summary", viewerToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = data(response);
        assertThat(body.has("totalQuestions")).isTrue();
        assertThat(body.has("approvedQuestions")).isTrue();
        assertThat(body.get("byStatus").isArray()).isTrue();
    }

    @DisplayName("L3-ANL-09 | Auth-Wrong-Role: GET /evaluation-dashboard with a plain USER token → 403 AUTH_002")
    @Test
    void evaluationDashboardNeedsAnEvaluationPermission() {
        assertError(get(API + "/evaluation-dashboard", employeeToken), HttpStatus.FORBIDDEN, "AUTH_002");
    }

    @DisplayName("L3-ANL-10 | Pagination: GET /competency/summary?departmentId=<own> as MANAGER → 200 with pagination flattened into the DTO (size defaults to 10)")
    @Test
    void competencySummaryFlattensPagination() {
        ResponseEntity<String> response =
                get(API + "/competency/summary?departmentId=" + sharedDepartment().getId(), managerToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = data(response);
        // Not a PageResponse: page/size/totalElements sit next to items[] on the domain DTO.
        assertThat(body.get("items").isArray()).isTrue();
        assertThat(body.get("size").asInt()).isEqualTo(10);
        assertThat(body.has("page")).isTrue();
        assertThat(body.has("totalElements")).isTrue();
    }

    @DisplayName("L3-ANL-11 | Auth-Wrong-Role: GET /competency/summary without departmentId as MANAGER → 403 AUTH_002 'Chỉ Admin được xem dữ liệu năng lực toàn viện'")
    @Test
    void hospitalWideCompetencyIsAdminOnly() {
        ResponseEntity<String> response = get(API + "/competency/summary", managerToken);

        assertError(response, HttpStatus.FORBIDDEN, "AUTH_002");
        assertThat(json(response).get("message").asText())
                .isEqualTo("Chỉ Admin được xem dữ liệu năng lực toàn viện");
    }

    @DisplayName("L3-ANL-12 | Contract: GET /me/notifications → PageResponse, unread-count → {unreadCount}, PATCH read-status → the number of rows touched")
    @Test
    void personalNotificationEndpointsAgreeOnTheirShapes() {
        JsonNode page = data(get(API + "/me/notifications?page=0&size=20", employeeToken));
        assertThat(page.get("content").isArray()).isTrue();
        assertThat(page.get("size").asInt()).isEqualTo(20);

        JsonNode unread = data(get(API + "/me/notifications/unread-count", employeeToken));
        assertThat(unread.get("unreadCount").asLong()).isNotNegative();

        ResponseEntity<String> marked = patch(API + "/me/notifications/read-status", employeeToken, """
                {"read":true}
                """);
        assertOk(marked);
        assertThat(data(marked).isNumber()).as("data is a bare count, not an object").isTrue();
    }

    @DisplayName("L3-ANL-13 | Validation: PUT /admin/system-settings with globalTrainingHours=0.4 → 422 VAL_001; a USER token → 403 AUTH_002")
    @Test
    void systemSettingsGuardTheTrainingHoursFloor() {
        JsonNode current = data(get(API + "/admin/system-settings", adminToken));
        assertThat(current.get("globalTrainingHours").asDouble()).isPositive();
        assertThat(current.has("trainingWindowYears")).isTrue();

        ResponseEntity<String> invalid = put(API + "/admin/system-settings", adminToken, """
                {"globalTrainingHours":0.4,"trainingWindowYears":5,"version":%d}
                """.formatted(current.get("version").asLong()));
        assertError(invalid, HttpStatus.UNPROCESSABLE_ENTITY, "VAL_001");
        assertThat(json(invalid).get("details").toString()).contains("globalTrainingHours");

        ResponseEntity<String> invalidYears = put(API + "/admin/system-settings", adminToken, """
                {"globalTrainingHours":120,"trainingWindowYears":0,"version":%d}
                """.formatted(current.get("version").asLong()));
        assertError(invalidYears, HttpStatus.UNPROCESSABLE_ENTITY, "VAL_001");
        assertThat(json(invalidYears).get("details").toString()).contains("trainingWindowYears");

        assertError(get(API + "/admin/system-settings", employeeToken), HttpStatus.FORBIDDEN, "AUTH_002");
    }
}
