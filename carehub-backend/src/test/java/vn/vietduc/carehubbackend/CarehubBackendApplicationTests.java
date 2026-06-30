package vn.vietduc.carehubbackend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.Map;

@SpringBootTest
@TestPropertySource(properties = {
        "ai.embedding.preload=false",
        "ai.paraphrase.preload=false"
})
class CarehubBackendApplicationTests {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void contextLoads() {
        try {
            Long userCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM users", Long.class);
            Long userRolesCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM user_roles", Long.class);
            List<Map<String, Object>> users = jdbcTemplate.queryForList("SELECT id, employee_code, name, status, is_deleted FROM users ORDER BY id DESC LIMIT 5");
            
            System.out.println("=== USER DATABASE STATUS ===");
            System.out.println("Total Users in DB: " + userCount);
            System.out.println("Total User-Roles mappings: " + userRolesCount);
            System.out.println("Latest 5 users:");
            for (Map<String, Object> u : users) {
                System.out.println(" - ID: " + u.get("id") + ", Code: " + u.get("employee_code") + ", Name: " + u.get("name") + ", Status: " + u.get("status") + ", Deleted: " + u.get("is_deleted"));
            }
            System.out.println("===========================");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
