CREATE INDEX IF NOT EXISTS ix_questions_category_status
    ON questions (category_id, status);

ALTER TABLE questions
    ALTER COLUMN category_id SET NOT NULL;

ALTER TABLE evaluation_import_job_rows
    ADD COLUMN IF NOT EXISTS category_id_snapshot BIGINT,
    ADD COLUMN IF NOT EXISTS category_code_snapshot VARCHAR(80),
    ADD COLUMN IF NOT EXISTS category_name_snapshot VARCHAR(255),
    ADD COLUMN IF NOT EXISTS professional_field_id_snapshot BIGINT,
    ADD COLUMN IF NOT EXISTS professional_field_code_snapshot VARCHAR(80),
    ADD COLUMN IF NOT EXISTS professional_field_name_snapshot VARCHAR(255),
    ADD COLUMN IF NOT EXISTS category_resolved BOOLEAN,
    ADD COLUMN IF NOT EXISTS skip_reason TEXT;
