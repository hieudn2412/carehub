package vn.vietduc.carehubbackend.api;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import vn.vietduc.carehubbackend.user.entity.User;

import static org.assertj.core.api.Assertions.assertThat;

class QualityChecklistDashboardApiSystemTest extends AbstractApiSystemTest {

    private String adminToken;
    private String managerToken;
    private String userToken;
    private User manager;

    @BeforeEach
    void createActors() {
        User admin = newUser("QCD-ADMIN", "ADMIN");
        User user = newUser("QCD-USER", "USER");
        manager = newUser("QCD-MANAGER", "MANAGER");
        adminToken = tokenFor(admin);
        managerToken = tokenFor(manager);
        userToken = tokenFor(user);
    }

    @Test
    @DisplayName("Dashboard chất lượng trả PageResponse và thực thi được truy vấn role-aware")
    void filteredDashboardRunsForAdmin() {
        ResponseEntity<String> response = get(API
                + "/dashboard/quality/checklists?view=FILTERED&fromDate=2026-01-01&toDate=2026-12-31&page=0&size=10",
                adminToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode page = data(response);
        assertThat(page.get("content").isArray()).isTrue();
        assertThat(page.get("page").asInt()).isZero();
        assertThat(page.get("size").asInt()).isEqualTo(10);

        ResponseEntity<String> latestResponse = get(API
                + "/dashboard/quality/checklists?view=LATEST&fromDate=2026-01-01&toDate=2026-12-31&page=0&size=1",
                adminToken);
        assertThat(latestResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(data(latestResponse).get("content").isArray()).isTrue();
    }

    @Test
    @DisplayName("User không có phân công không nhìn thấy bảng kiểm khác")
    void userWithoutAssignmentReceivesAnEmptyDashboard() {
        ResponseEntity<String> response = get(API
                + "/dashboard/quality/checklists?view=FILTERED&fromDate=2026-01-01&toDate=2026-12-31&page=0&size=10",
                userToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode page = data(response);
        assertThat(page.get("content")).isEmpty();
        assertThat(page.get("totalElements").asLong()).isZero();
    }

    @Test
    @DisplayName("Manager truy vấn dashboard theo khoa mà không phụ thuộc người thực hiện đánh giá")
    void managerDashboardRunsWithDepartmentScopedHistory() {
        ResponseEntity<String> response = get(API
                + "/dashboard/quality/checklists?view=LATEST&fromDate=2026-01-01&toDate=2026-12-31&page=0&size=1",
                managerToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(data(response).get("content").isArray()).isTrue();
    }

    @Test
    @DisplayName("Admin cấu hình mục tiêu bệnh viện với optimistic lock, User bị từ chối")
    void hospitalTargetCanOnlyBeManagedByAdmin() {
        long formId = id(post(API + "/forms", adminToken, """
                {"code":"QCD-%04d","title":"Dashboard chất lượng","subjectType":"USER"}
                """.formatted(nextSeq())));

        ResponseEntity<String> created = put(API + "/quality/compliance-targets/forms/" + formId + "/hospital",
                adminToken, "{\"targetPercent\":82.50,\"lockVersion\":null}");

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode hospital = data(created).get("hospitalTarget");
        assertThat(hospital.get("targetPercent").decimalValue()).isEqualByComparingTo("82.50");
        assertThat(hospital.get("lockVersion").asLong()).isZero();

        ResponseEntity<String> forbidden = get(API + "/quality/compliance-targets/forms/" + formId, userToken);
        assertError(forbidden, HttpStatus.FORBIDDEN, "AUTH_002");
    }

    @Test
    @DisplayName("Manager không được cấu hình mục tiêu khoa/phòng")
    void managerCannotManageDepartmentComplianceTarget() {
        long formId = id(post(API + "/forms", adminToken, """
                {"code":"QCD-MGR-%04d","title":"Mục tiêu chỉ Admin cấu hình","subjectType":"USER"}
                """.formatted(nextSeq())));

        ResponseEntity<String> forbidden = put(API + "/quality/compliance-targets/forms/" + formId
                        + "/departments/" + manager.getDepartment().getId(),
                managerToken, "{\"targetPercent\":70.00,\"lockVersion\":null}");

        assertError(forbidden, HttpStatus.FORBIDDEN, "AUTH_002");
    }
}
