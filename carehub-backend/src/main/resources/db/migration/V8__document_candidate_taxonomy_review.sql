-- Phase 2: document-generated candidates carry independent taxonomy and
-- reviewer-confirmed cognitive classification before entering the bank.
ALTER TABLE document_question_jobs
    ADD COLUMN IF NOT EXISTS professional_field_id BIGINT;

ALTER TABLE document_question_candidates
    ADD COLUMN IF NOT EXISTS category_id BIGINT,
    ADD COLUMN IF NOT EXISTS professional_field_id BIGINT,
    ADD COLUMN IF NOT EXISTS cognitive_level VARCHAR(48),
    ADD COLUMN IF NOT EXISTS cognitive_verified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS cognitive_verified_by VARCHAR(100);

UPDATE document_question_candidates c
SET category_id = j.category_id
FROM document_question_jobs j
WHERE c.job_id = j.id
  AND c.category_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_document_question_jobs_professional_field'
          AND conrelid = 'document_question_jobs'::regclass
    ) THEN
        ALTER TABLE document_question_jobs
            ADD CONSTRAINT fk_document_question_jobs_professional_field
            FOREIGN KEY (professional_field_id) REFERENCES professional_fields(id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_document_question_candidates_category'
          AND conrelid = 'document_question_candidates'::regclass
    ) THEN
        ALTER TABLE document_question_candidates
            ADD CONSTRAINT fk_document_question_candidates_category
            FOREIGN KEY (category_id) REFERENCES question_categories(id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_document_question_candidates_professional_field'
          AND conrelid = 'document_question_candidates'::regclass
    ) THEN
        ALTER TABLE document_question_candidates
            ADD CONSTRAINT fk_document_question_candidates_professional_field
            FOREIGN KEY (professional_field_id) REFERENCES professional_fields(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_candidate_taxonomy
    ON document_question_candidates (category_id, professional_field_id, cognitive_level, status);
