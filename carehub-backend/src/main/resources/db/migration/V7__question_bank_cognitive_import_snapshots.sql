-- Phase 2: immutable import-row snapshots for the independent field and
-- reviewer-confirmed cognitive classification.
ALTER TABLE evaluation_import_job_rows
    ADD COLUMN IF NOT EXISTS cognitive_level_snapshot VARCHAR(48),
    ADD COLUMN IF NOT EXISTS cognitive_verified_at_snapshot TIMESTAMP,
    ADD COLUMN IF NOT EXISTS cognitive_verified_by_snapshot VARCHAR(100),
    ADD COLUMN IF NOT EXISTS source_document_id_snapshot BIGINT,
    ADD COLUMN IF NOT EXISTS source_document_filename_snapshot VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source_document_content_hash_snapshot VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_evaluation_import_row_taxonomy
    ON evaluation_import_job_rows (category_id_snapshot, professional_field_id_snapshot, cognitive_level_snapshot);
