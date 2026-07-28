package vn.vietduc.carehubbackend.questiongeneration.migration;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Keeps the PostgreSQL enum check constraint aligned with ParaphraseMode.
 * Hibernate ddl-auto=update does not expand an existing enum check when a new
 * enum value is introduced.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@Order(1)
public class ParaphraseModeConstraintMigration implements CommandLineRunner {

    private static final String CONSTRAINT_NAME = "paraphrase_jobs_mode_check";
    private static final String EXPECTED_VALUES = "('STEM_ONLY', 'FULL_MCQ')";

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        try {
            String constraintDefinition = constraintDefinition();
            if (constraintDefinition == null || constraintDefinition.contains("'STEM_ONLY'")) {
                return;
            }
            jdbcTemplate.execute(
                    "ALTER TABLE IF EXISTS paraphrase_jobs DROP CONSTRAINT IF EXISTS " + CONSTRAINT_NAME
            );
            jdbcTemplate.execute(
                    "ALTER TABLE paraphrase_jobs ADD CONSTRAINT " + CONSTRAINT_NAME
                            + " CHECK (mode IN " + EXPECTED_VALUES + ")"
            );
            log.info("Updated {} with all paraphrase mode values", CONSTRAINT_NAME);
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
