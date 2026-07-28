package vn.vietduc.carehubbackend.questiongeneration.migration;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Keeps the PostgreSQL enum check constraint aligned with ExamResultVisibility.
 * Hibernate ddl-auto=update adds columns but does not expand existing enum checks.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@Order(1)
public class ExamResultVisibilityConstraintMigration implements CommandLineRunner {

    private static final String CONSTRAINT_NAME = "exam_assignments_result_visibility_check";
    private static final String EXPECTED_VALUES =
            "('SCORE_ONLY', 'SCORE_AND_ANSWERS', 'HIDDEN_UNTIL_END')";

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        try {
            String constraintDefinition = constraintDefinition();
            if (constraintDefinition == null || constraintDefinition.contains("'HIDDEN_UNTIL_END'")) {
                return;
            }
            jdbcTemplate.execute(
                    "ALTER TABLE IF EXISTS exam_assignments DROP CONSTRAINT IF EXISTS " + CONSTRAINT_NAME
            );
            jdbcTemplate.execute(
                    "ALTER TABLE exam_assignments ADD CONSTRAINT " + CONSTRAINT_NAME
                            + " CHECK (result_visibility IN " + EXPECTED_VALUES + ")"
            );
            log.info("Updated {} with all result visibility values", CONSTRAINT_NAME);
        } catch (Exception exception) {
            log.warn("Could not update {}: {}", CONSTRAINT_NAME, exception.getMessage());
        }
    }

    private String constraintDefinition() {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = ?",
                    String.class,
                    CONSTRAINT_NAME
            );
        } catch (Exception ignored) {
            return null;
        }
    }
}
