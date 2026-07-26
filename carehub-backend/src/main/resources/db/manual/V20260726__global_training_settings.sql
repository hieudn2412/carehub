BEGIN;

CREATE TABLE IF NOT EXISTS system_settings (
    id BIGSERIAL PRIMARY KEY,
    scope_key VARCHAR(30) NOT NULL UNIQUE,
    global_training_hours NUMERIC(8, 2) NOT NULL,
    lock_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    updated_by VARCHAR(255)
);

INSERT INTO system_settings (scope_key, global_training_hours, lock_version)
VALUES ('GLOBAL', 120, 0)
ON CONFLICT (scope_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS training_requirements_backup_20260726
AS TABLE training_requirements WITH DATA;

DELETE FROM training_requirements;

ALTER TABLE form_submissions ALTER COLUMN assignment_item_id DROP NOT NULL;

COMMIT;
