BEGIN;

ALTER TABLE system_settings
    ADD COLUMN IF NOT EXISTS competency_target_score NUMERIC(4, 2);

UPDATE system_settings
SET competency_target_score = 6.00
WHERE competency_target_score IS NULL;

ALTER TABLE system_settings
    ALTER COLUMN competency_target_score SET DEFAULT 6.00,
    ALTER COLUMN competency_target_score SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_system_settings_competency_target_score'
          AND conrelid = 'system_settings'::regclass
    ) THEN
        ALTER TABLE system_settings
            ADD CONSTRAINT ck_system_settings_competency_target_score
            CHECK (competency_target_score BETWEEN 0 AND 10);
    END IF;
END $$;

COMMIT;
