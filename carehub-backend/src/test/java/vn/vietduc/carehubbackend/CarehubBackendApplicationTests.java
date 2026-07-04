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

    @Test
    void seedNotifications() {
        try {
            // Clear existing notifications to avoid unique key constraints
            jdbcTemplate.update("DELETE FROM notifications");

            // Seed notifications for Admin (ID = 1)
            jdbcTemplate.update("""
                INSERT INTO notifications (created_at, updated_at, user_id, type, title, content, is_read, dedup_key)
                VALUES (NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', 1, 'SUCCESS',
                        'Đồng bộ nhân sự thành công',
                        'Tiến trình đồng bộ danh sách nhân sự từ file Excel đã hoàn tất thành công. Thêm mới 15 nhân viên.',
                        false, 'dedup_admin_sync_success')
            """);

            jdbcTemplate.update("""
                INSERT INTO notifications (created_at, updated_at, user_id, type, title, content, is_read, dedup_key)
                VALUES (NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours', 1, 'DANGER',
                        'Lỗi đồng bộ dữ liệu Legacy',
                        'Import dữ liệu CME lịch sử gặp lỗi ở dòng số 45. Vui lòng kiểm tra lại file log hệ thống.',
                        false, 'dedup_admin_legacy_error')
            """);

            jdbcTemplate.update("""
                INSERT INTO notifications (created_at, updated_at, user_id, type, title, content, is_read, dedup_key)
                VALUES (NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 1, 'WARNING',
                        'Yêu cầu phê duyệt cấu hình CME',
                        'Cấu hình tiêu chuẩn đào tạo CME mới cho Khoa Ngoại chấn thương đang chờ duyệt.',
                        true, 'dedup_admin_config_pending')
            """);

            // Seed notifications for BM058 Manager (ID = 2605)
            jdbcTemplate.update("""
                INSERT INTO notifications (created_at, updated_at, user_id, type, title, content, is_read, dedup_key)
                VALUES (NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', 2605, 'SUCCESS',
                        'Đại học Y Hà Nội gửi danh sách CME mới',
                        'Danh sách chứng chỉ CME lớp K50 Hồi sức tích cực đã được đồng bộ vào hệ thống.',
                        false, 'dedup_mgr_cme_sync')
            """);

            jdbcTemplate.update("""
                INSERT INTO notifications (created_at, updated_at, user_id, type, title, content, is_read, dedup_key)
                VALUES (NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 2605, 'WARNING',
                        'Có 3 hồ sơ CME đang chờ duyệt',
                        'Khoa Hồi sức tích cực có 3 hồ sơ CME của nhân viên mới nộp đang chờ bạn phê duyệt.',
                        false, 'dedup_mgr_cme_pending')
            """);

            jdbcTemplate.update("""
                INSERT INTO notifications (created_at, updated_at, user_id, type, title, content, is_read, dedup_key)
                VALUES (NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 2605, 'DANGER',
                        'Nhắc nhở: Cập nhật thông tin CME chu kỳ mới',
                        'Chu kỳ CME 5 năm của bạn sắp kết thúc vào ngày 02/07/2026. Vui lòng kiểm tra và bổ sung hồ sơ còn thiếu.',
                        true, 'dedup_mgr_cme_cycle')
            """);

            System.out.println("✅ Mock notifications seeded successfully into database!");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
