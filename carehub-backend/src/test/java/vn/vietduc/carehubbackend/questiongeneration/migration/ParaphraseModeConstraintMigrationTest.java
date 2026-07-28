package vn.vietduc.carehubbackend.questiongeneration.migration;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ParaphraseModeConstraintMigrationTest {

    private static final String CONSTRAINT_QUERY =
            "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = ?";

    @Test
    void expandsLegacyConstraintToIncludeStemOnly() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(
                CONSTRAINT_QUERY,
                String.class,
                "paraphrase_jobs_mode_check"
        )).thenReturn("CHECK (((mode)::text = 'FULL_MCQ'::text))");

        new ParaphraseModeConstraintMigration(jdbcTemplate).run();

        verify(jdbcTemplate).execute(
                "ALTER TABLE IF EXISTS paraphrase_jobs DROP CONSTRAINT IF EXISTS paraphrase_jobs_mode_check"
        );
        verify(jdbcTemplate).execute(
                "ALTER TABLE paraphrase_jobs ADD CONSTRAINT paraphrase_jobs_mode_check"
                        + " CHECK (mode IN ('STEM_ONLY', 'FULL_MCQ'))"
        );
    }

    @Test
    void leavesCurrentConstraintUntouched() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(
                CONSTRAINT_QUERY,
                String.class,
                "paraphrase_jobs_mode_check"
        )).thenReturn("CHECK (((mode)::text = ANY (ARRAY['STEM_ONLY', 'FULL_MCQ'])))");

        new ParaphraseModeConstraintMigration(jdbcTemplate).run();

        verify(jdbcTemplate, never()).execute(org.mockito.ArgumentMatchers.anyString());
    }
}
