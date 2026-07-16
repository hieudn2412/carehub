package vn.vietduc.carehubbackend.training.migration;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Fixes the training_records_workflow_status_check constraint that was created
 * by an older schema version without the SUBMITTED value.
 * <p>
 * Without this fix, any attempt to submit a training record (DRAFT → SUBMITTED)
 * fails with a PostgreSQL check constraint violation and HTTP 500.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@Order(1) // Run early, before DataSeeder
public class WorkflowStatusConstraintMigration implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    private static final String CONSTRAINT_NAME = "training_records_workflow_status_check";
    private static final String EXPECTED_VALUES = "('DRAFT', 'SUBMITTED', 'CANCELLED')";

    @Override
    public void run(String... args) {
        try {
            String constraintDef = getConstraintDefinition();
            if (constraintDef == null) {
                log.info("Constraint {} does not exist — will be created by Hibernate on next DDL update",
                        CONSTRAINT_NAME);
                return;
            }
            if (constraintDef.contains("'SUBMITTED'")) {
                log.info("Constraint {} already includes SUBMITTED — no migration needed", CONSTRAINT_NAME);
                return;
            }
            log.warn("Constraint {} is missing SUBMITTED value. Current definition: {}",
                    CONSTRAINT_NAME, constraintDef);
            fixConstraint();
            log.info("Successfully updated constraint {} to include all status values", CONSTRAINT_NAME);
        } catch (Exception e) {
            log.error("Failed to migrate constraint {}: {}", CONSTRAINT_NAME, e.getMessage(), e);
        }
    }

    private String getConstraintDefinition() {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = ?",
                    String.class,
                    CONSTRAINT_NAME
            );
        } catch (Exception e) {
            return null;
        }
    }

    private void fixConstraint() {
        jdbcTemplate.execute("ALTER TABLE IF EXISTS training_records DROP CONSTRAINT IF EXISTS " + CONSTRAINT_NAME);
        jdbcTemplate.execute("ALTER TABLE training_records ADD CONSTRAINT " + CONSTRAINT_NAME
                + " CHECK (workflow_status IN " + EXPECTED_VALUES + ")");
    }
}
