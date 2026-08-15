-- Canonical links for the evaluation taxonomy.
-- Columns are introduced nullable so an existing installation can start and be
-- reset/backfilled explicitly before the final NOT NULL hardening step.

ALTER TABLE IF EXISTS question_categories
    ADD COLUMN IF NOT EXISTS professional_field_id BIGINT;

ALTER TABLE IF EXISTS questions
    ADD COLUMN IF NOT EXISTS category_id BIGINT;

ALTER TABLE IF EXISTS question_sets
    ADD COLUMN IF NOT EXISTS professional_field_id BIGINT,
    ADD COLUMN IF NOT EXISTS question_set_category_id BIGINT;

ALTER TABLE IF EXISTS exam_papers
    ADD COLUMN IF NOT EXISTS professional_field_id BIGINT,
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(160);

ALTER TABLE IF EXISTS exam_assignments
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(160);

CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_assignments_idempotency_key
    ON exam_assignments (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

ALTER TABLE IF EXISTS question_set_version_items
    ADD COLUMN IF NOT EXISTS category_id BIGINT,
    ADD COLUMN IF NOT EXISTS category_code VARCHAR(128),
    ADD COLUMN IF NOT EXISTS category_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS professional_field_id BIGINT,
    ADD COLUMN IF NOT EXISTS professional_field_code VARCHAR(128),
    ADD COLUMN IF NOT EXISTS professional_field_name VARCHAR(255);

ALTER TABLE IF EXISTS exam_paper_question_snapshots
    ADD COLUMN IF NOT EXISTS category_id BIGINT,
    ADD COLUMN IF NOT EXISTS category_code VARCHAR(128),
    ADD COLUMN IF NOT EXISTS category_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS professional_field_id BIGINT,
    ADD COLUMN IF NOT EXISTS professional_field_code VARCHAR(128),
    ADD COLUMN IF NOT EXISTS professional_field_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS ix_question_categories_professional_field
    ON question_categories (professional_field_id, status);
CREATE INDEX IF NOT EXISTS ix_questions_category_status
    ON questions (category_id, status);
CREATE INDEX IF NOT EXISTS ix_question_sets_professional_field
    ON question_sets (professional_field_id, status);
CREATE INDEX IF NOT EXISTS ix_question_sets_category
    ON question_sets (question_set_category_id, status);
CREATE INDEX IF NOT EXISTS ix_exam_papers_professional_field
    ON exam_papers (professional_field_id, status);
CREATE INDEX IF NOT EXISTS ix_question_set_version_items_category
    ON question_set_version_items (category_id);
CREATE INDEX IF NOT EXISTS ix_exam_paper_question_snapshots_category
    ON exam_paper_question_snapshots (category_id);

DO $$
BEGIN
    IF to_regclass('professional_fields') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_question_categories_professional_field') THEN
        ALTER TABLE question_categories
            ADD CONSTRAINT fk_question_categories_professional_field
            FOREIGN KEY (professional_field_id) REFERENCES professional_fields(id);
    END IF;
    IF to_regclass('questions') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_questions_category') THEN
        ALTER TABLE questions
            ADD CONSTRAINT fk_questions_category
            FOREIGN KEY (category_id) REFERENCES question_categories(id);
    END IF;
    IF to_regclass('question_sets') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_question_sets_professional_field') THEN
        ALTER TABLE question_sets
            ADD CONSTRAINT fk_question_sets_professional_field
            FOREIGN KEY (professional_field_id) REFERENCES professional_fields(id);
    END IF;
    IF to_regclass('question_sets') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_question_sets_category') THEN
        ALTER TABLE question_sets
            ADD CONSTRAINT fk_question_sets_category
            FOREIGN KEY (question_set_category_id) REFERENCES question_set_categories(id);
    END IF;
    IF to_regclass('exam_papers') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_exam_papers_professional_field') THEN
        ALTER TABLE exam_papers
            ADD CONSTRAINT fk_exam_papers_professional_field
            FOREIGN KEY (professional_field_id) REFERENCES professional_fields(id);
    END IF;
END $$;
