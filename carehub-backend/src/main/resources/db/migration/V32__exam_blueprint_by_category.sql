-- Migration V32: Exam blueprint transition from professional field to question category.

-- 1. Link question_categories to professional_fields (optional parent taxonomy)
ALTER TABLE question_categories
    ADD COLUMN IF NOT EXISTS professional_field_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_question_categories_professional_field'
          AND conrelid = 'question_categories'::regclass
    ) THEN
        ALTER TABLE question_categories
            ADD CONSTRAINT fk_question_categories_professional_field
            FOREIGN KEY (professional_field_id) REFERENCES professional_fields(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_question_categories_professional_field
    ON question_categories (professional_field_id, status);

-- Backfill professional_field_id on question_categories from questions where available
UPDATE question_categories qc
SET professional_field_id = (
    SELECT q.professional_field_id
    FROM questions q
    WHERE q.category_id = qc.id AND q.professional_field_id IS NOT NULL
    LIMIT 1
)
WHERE qc.professional_field_id IS NULL;

-- 2. Update exam_blueprint_fields to support question category
ALTER TABLE exam_blueprint_fields
    ADD COLUMN IF NOT EXISTS category_id BIGINT,
    ALTER COLUMN professional_field_id DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_exam_blueprint_fields_category'
          AND conrelid = 'exam_blueprint_fields'::regclass
    ) THEN
        ALTER TABLE exam_blueprint_fields
            ADD CONSTRAINT fk_exam_blueprint_fields_category
            FOREIGN KEY (category_id) REFERENCES question_categories(id);
    END IF;
END $$;

ALTER TABLE exam_blueprint_fields
    DROP CONSTRAINT IF EXISTS uq_exam_blueprint_fields_config_field;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_exam_blueprint_fields_config_category'
          AND conrelid = 'exam_blueprint_fields'::regclass
    ) THEN
        ALTER TABLE exam_blueprint_fields
            ADD CONSTRAINT uq_exam_blueprint_fields_config_category
            UNIQUE (exam_config_id, category_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exam_blueprint_fields_category
    ON exam_blueprint_fields (category_id);

-- 3. Update exam_paper_generation_batch_cells to support category snapshot
ALTER TABLE exam_paper_generation_batch_cells
    ADD COLUMN IF NOT EXISTS category_id BIGINT,
    ADD COLUMN IF NOT EXISTS category_code VARCHAR(128),
    ADD COLUMN IF NOT EXISTS category_name VARCHAR(255),
    ALTER COLUMN professional_field_id DROP NOT NULL,
    ALTER COLUMN professional_field_name DROP NOT NULL;

ALTER TABLE exam_paper_generation_batch_cells
    DROP CONSTRAINT IF EXISTS uq_exam_paper_generation_batch_cells;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_exam_paper_generation_batch_cells_cat_cog'
          AND conrelid = 'exam_paper_generation_batch_cells'::regclass
    ) THEN
        ALTER TABLE exam_paper_generation_batch_cells
            ADD CONSTRAINT uq_exam_paper_generation_batch_cells_cat_cog
            UNIQUE (generation_batch_id, category_id, cognitive_level);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exam_paper_generation_batch_cells_category
    ON exam_paper_generation_batch_cells (generation_batch_id, category_id);

-- 4. Index on questions for fast category + cognitive pool retrieval
CREATE INDEX IF NOT EXISTS idx_questions_status_category_cognitive
    ON questions (status, category_id, cognitive_level);
