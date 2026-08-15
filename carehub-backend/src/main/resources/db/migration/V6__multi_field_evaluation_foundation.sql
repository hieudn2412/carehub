-- Phase 1: additive foundation for multi-field evaluations.
-- PostgreSQL 17; designed for the existing CareHub schema (Flyway baseline 5).

-- 1. Questions own both independent taxonomy dimensions.
ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS professional_field_id BIGINT,
    ADD COLUMN IF NOT EXISTS cognitive_level VARCHAR(48),
    ADD COLUMN IF NOT EXISTS cognitive_verified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS cognitive_verified_by VARCHAR(100),
    ADD COLUMN IF NOT EXISTS source_document_id BIGINT;

-- Backfill by stable IDs only. Never infer a field from a category name/topic.
UPDATE questions q
SET professional_field_id = qc.professional_field_id
FROM question_categories qc
WHERE q.category_id = qc.id
  AND q.professional_field_id IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM questions WHERE professional_field_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot enforce questions.professional_field_id: unresolved rows remain';
    END IF;
END $$;

ALTER TABLE questions
    ALTER COLUMN professional_field_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_questions_professional_field'
          AND conrelid = 'questions'::regclass
    ) THEN
        ALTER TABLE questions
            ADD CONSTRAINT fk_questions_professional_field
            FOREIGN KEY (professional_field_id) REFERENCES professional_fields(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_questions_source_document'
          AND conrelid = 'questions'::regclass
    ) THEN
        ALTER TABLE questions
            ADD CONSTRAINT fk_questions_source_document
            FOREIGN KEY (source_document_id) REFERENCES documents(id);
    END IF;
END $$;

-- Exact, unique filename is the only legacy provenance safe enough to link.
WITH uniquely_named_documents AS (
    SELECT filename, MIN(id) AS document_id
    FROM documents
    GROUP BY filename
    HAVING COUNT(*) = 1
)
UPDATE questions q
SET source_document_id = d.document_id
FROM uniquely_named_documents d
WHERE q.source_document_id IS NULL
  AND q.source_document IS NOT NULL
  AND BTRIM(q.source_document) = d.filename;

CREATE INDEX IF NOT EXISTS idx_questions_status_field_cognitive
    ON questions (status, professional_field_id, cognitive_level);
CREATE INDEX IF NOT EXISTS idx_questions_category_status
    ON questions (category_id, status);
CREATE INDEX IF NOT EXISTS idx_questions_source_document_id
    ON questions (source_document_id);

-- Category and field are independent for new writes. Keep the legacy column
-- during expand/dual-read, but remove its write requirement and ownership FK.
ALTER TABLE question_categories
    ALTER COLUMN professional_field_id DROP NOT NULL;

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid
         AND att.attnum = ANY (con.conkey)
        WHERE con.conrelid = 'question_categories'::regclass
          AND con.contype = 'f'
          AND att.attname = 'professional_field_id'
    LOOP
        EXECUTE format('ALTER TABLE question_categories DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

-- 2. Direct field x cognitive blueprint. Counts are canonical for generation;
-- percentages preserve the administrator's intent and deterministic rounding.
CREATE TABLE IF NOT EXISTS exam_blueprint_fields (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),
    exam_config_id BIGINT NOT NULL REFERENCES exam_configs(id),
    professional_field_id BIGINT NOT NULL REFERENCES professional_fields(id),
    percentage NUMERIC(5,2) NOT NULL,
    question_count INTEGER NOT NULL,
    display_order INTEGER NOT NULL,
    passing_threshold NUMERIC(5,2),
    CONSTRAINT uq_exam_blueprint_fields_config_field
        UNIQUE (exam_config_id, professional_field_id),
    CONSTRAINT ck_exam_blueprint_field_percentage
        CHECK (percentage > 0 AND percentage <= 100),
    CONSTRAINT ck_exam_blueprint_field_question_count
        CHECK (question_count > 0),
    CONSTRAINT ck_exam_blueprint_field_display_order
        CHECK (display_order >= 0),
    CONSTRAINT ck_exam_blueprint_field_threshold
        CHECK (passing_threshold IS NULL OR passing_threshold BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS exam_blueprint_cells (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),
    blueprint_field_id BIGINT NOT NULL REFERENCES exam_blueprint_fields(id) ON DELETE CASCADE,
    cognitive_level VARCHAR(48) NOT NULL,
    percentage NUMERIC(5,2) NOT NULL,
    question_count INTEGER NOT NULL,
    CONSTRAINT uq_exam_blueprint_cells_field_cognitive
        UNIQUE (blueprint_field_id, cognitive_level),
    CONSTRAINT ck_exam_blueprint_cell_cognitive
        CHECK (cognitive_level IN (
            'FOUNDATION',
            'CLINICAL_APPLICATION',
            'CLINICAL_REASONING_ANALYSIS'
        )),
    CONSTRAINT ck_exam_blueprint_cell_percentage
        CHECK (percentage >= 0 AND percentage <= 100),
    CONSTRAINT ck_exam_blueprint_cell_question_count
        CHECK (question_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_exam_blueprint_fields_config_order
    ON exam_blueprint_fields (exam_config_id, display_order);
CREATE INDEX IF NOT EXISTS idx_exam_blueprint_cells_field
    ON exam_blueprint_cells (blueprint_field_id);

-- 3. New papers and assignments no longer require a single field or a set.
ALTER TABLE exam_papers
    ALTER COLUMN question_set_id DROP NOT NULL,
    ALTER COLUMN professional_field_id DROP NOT NULL;

-- 4. Immutable paper snapshots carry every classification/provenance value.
ALTER TABLE exam_paper_question_snapshots
    ADD COLUMN IF NOT EXISTS cognitive_level VARCHAR(48),
    ADD COLUMN IF NOT EXISTS cognitive_verified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS cognitive_verified_by VARCHAR(100),
    ADD COLUMN IF NOT EXISTS source_document_id BIGINT,
    ADD COLUMN IF NOT EXISTS source_document_filename VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source_document_content_hash VARCHAR(64);

ALTER TABLE question_set_version_items
    ADD COLUMN IF NOT EXISTS cognitive_level VARCHAR(48),
    ADD COLUMN IF NOT EXISTS cognitive_verified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS cognitive_verified_by VARCHAR(100),
    ADD COLUMN IF NOT EXISTS source_document_id BIGINT,
    ADD COLUMN IF NOT EXISTS source_document_filename VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source_document_content_hash VARCHAR(64);

-- 5. Tenure targeting uses explicit HR data, never account creation time.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS employment_start_date DATE;

CREATE INDEX IF NOT EXISTS idx_users_employment_start_date_active
    ON users (employment_start_date)
    WHERE is_deleted = FALSE;
