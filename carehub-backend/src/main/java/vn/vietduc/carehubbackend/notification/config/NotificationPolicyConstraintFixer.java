package vn.vietduc.carehubbackend.notification.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Drops and recreates the notification_policies_event_type_check constraint
 * to include any new NotificationEventType enum values added since the
 * constraint was originally created. Hibernate's ddl-auto=update does not
 * automatically update existing check constraints when Java enums change.
 *
 * Runs before NotificationBootstrap to prevent constraint violation errors.
 */
@Component
@Order(1)
@Slf4j
@RequiredArgsConstructor
public class NotificationPolicyConstraintFixer implements ApplicationRunner {

    private static final String[] EXPECTED_VALUES = {
            "CME_HOURS_BELOW_REQUIREMENT",
            "EXAM_ASSIGNED",
            "EXAM_PASSED",
            "QUALITY_COMPLIANCE_BELOW_TARGET",
            "PERSONAL_COMPLIANCE_ISSUE"
    };

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            // Drop the old constraint if it exists
            jdbcTemplate.execute(
                    "ALTER TABLE notification_policies DROP CONSTRAINT IF EXISTS notification_policies_event_type_check"
            );
            log.info("Dropped notification_policies_event_type_check constraint for recreation");

            // Recreate with the full set of enum values
            String inClause = String.join(", ",
                    java.util.Arrays.stream(EXPECTED_VALUES)
                            .map(v -> "'" + v + "'")
                            .toArray(String[]::new));
            jdbcTemplate.execute(
                    "ALTER TABLE notification_policies ADD CONSTRAINT notification_policies_event_type_check CHECK (event_type IN (" + inClause + "))"
            );
            log.info("Recreated notification_policies_event_type_check with values: {}", inClause);
        } catch (Exception e) {
            log.warn("Could not fix notification_policies_event_type_check constraint: {}", e.getMessage());
        }
    }
}
