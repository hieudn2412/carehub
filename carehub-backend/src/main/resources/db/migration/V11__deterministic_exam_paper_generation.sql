-- Phase 5: deterministic, idempotent paper generation and immutable audit snapshots.

CREATE TABLE IF NOT EXISTS exam_paper_generation_batches (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),
    exam_config_id BIGINT NOT NULL REFERENCES exam_configs(id),
    idempotency_key VARCHAR(160) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    config_version INTEGER NOT NULL,
    master_seed BIGINT NOT NULL,
    algorithm_version VARCHAR(48) NOT NULL,
    pool_checksum VARCHAR(128) NOT NULL,
    variant_count INTEGER NOT NULL,
    zero_overlap BOOLEAN NOT NULL DEFAULT FALSE,
    overlap_question_count INTEGER NOT NULL DEFAULT 0,
    overlap_percentage NUMERIC(7,4) NOT NULL DEFAULT 0,
    generated_by VARCHAR(100) NOT NULL,
    generated_at TIMESTAMP NOT NULL,
    CONSTRAINT uq_exam_paper_generation_batches_key UNIQUE (idempotency_key),
    CONSTRAINT ck_exam_paper_generation_batches_variants CHECK (variant_count BETWEEN 1 AND 10),
    CONSTRAINT ck_exam_paper_generation_batches_overlap CHECK (overlap_question_count >= 0 AND overlap_percentage BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_exam_paper_generation_batches_config
    ON exam_paper_generation_batches (exam_config_id, created_at DESC);

CREATE TABLE IF NOT EXISTS exam_paper_generation_batch_cells (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),
    generation_batch_id BIGINT NOT NULL REFERENCES exam_paper_generation_batches(id) ON DELETE CASCADE,
    professional_field_id BIGINT NOT NULL,
    professional_field_code VARCHAR(128),
    professional_field_name VARCHAR(255) NOT NULL,
    cognitive_level VARCHAR(48) NOT NULL,
    cognitive_label VARCHAR(128) NOT NULL,
    required_count INTEGER NOT NULL,
    display_order INTEGER NOT NULL,
    CONSTRAINT uq_exam_paper_generation_batch_cells UNIQUE (generation_batch_id, professional_field_id, cognitive_level),
    CONSTRAINT ck_exam_paper_generation_batch_cell_count CHECK (required_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_exam_paper_generation_batch_cells_batch
    ON exam_paper_generation_batch_cells (generation_batch_id, display_order);

ALTER TABLE exam_papers
    ADD COLUMN IF NOT EXISTS generation_batch_id BIGINT REFERENCES exam_paper_generation_batches(id),
    ADD COLUMN IF NOT EXISTS variant_index INTEGER,
    ADD COLUMN IF NOT EXISTS config_version INTEGER,
    ADD COLUMN IF NOT EXISTS generation_algorithm_version VARCHAR(48),
    ADD COLUMN IF NOT EXISTS generation_pool_checksum VARCHAR(128),
    ADD COLUMN IF NOT EXISTS generated_by VARCHAR(100),
    ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_papers_generation_batch_variant
    ON exam_papers (generation_batch_id, variant_index)
    WHERE generation_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exam_papers_generation_batch
    ON exam_papers (generation_batch_id, variant_index);

ALTER TABLE exam_paper_question_snapshots
    ADD COLUMN IF NOT EXISTS source_question_id BIGINT,
    ADD COLUMN IF NOT EXISTS question_family_id BIGINT,
    ADD COLUMN IF NOT EXISTS question_position INTEGER,
    ADD COLUMN IF NOT EXISTS option_order_json TEXT,
    ADD COLUMN IF NOT EXISTS cognitive_label VARCHAR(128),
    ADD COLUMN IF NOT EXISTS source_document_title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS config_version INTEGER,
    ADD COLUMN IF NOT EXISTS paper_seed BIGINT,
    ADD COLUMN IF NOT EXISTS generation_algorithm_version VARCHAR(48),
    ADD COLUMN IF NOT EXISTS generation_pool_checksum VARCHAR(128),
    ADD COLUMN IF NOT EXISTS generated_by VARCHAR(100),
    ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_exam_paper_snapshots_matrix
    ON exam_paper_question_snapshots (professional_field_id, cognitive_level);
