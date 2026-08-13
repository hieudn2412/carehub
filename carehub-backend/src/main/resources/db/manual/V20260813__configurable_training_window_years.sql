BEGIN;

ALTER TABLE system_settings
    ADD COLUMN IF NOT EXISTS training_window_years INTEGER;

UPDATE system_settings
SET training_window_years = 5
WHERE training_window_years IS NULL;

ALTER TABLE system_settings
    ALTER COLUMN training_window_years SET DEFAULT 5,
    ALTER COLUMN training_window_years SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_system_settings_training_window_years'
          AND conrelid = 'system_settings'::regclass
    ) THEN
        ALTER TABLE system_settings
            ADD CONSTRAINT ck_system_settings_training_window_years
            CHECK (training_window_years BETWEEN 1 AND 100);
    END IF;
END $$;

COMMIT;
