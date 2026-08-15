-- Phase 7: immutable-at-grade result aggregates derived from paper-question snapshots.
-- Taxonomy names are copied here so reports remain historically correct after a rename.

CREATE TABLE IF NOT EXISTS exam_attempt_field_results (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),
    attempt_id BIGINT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    professional_field_id BIGINT NOT NULL,
    professional_field_code VARCHAR(128),
    professional_field_name VARCHAR(255) NOT NULL,
    correct_count INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    score NUMERIC(6,2) NOT NULL,
    passing_threshold NUMERIC(6,2) NOT NULL,
    passed BOOLEAN NOT NULL,
    CONSTRAINT uq_exam_attempt_field_result UNIQUE (attempt_id, professional_field_id),
    CONSTRAINT ck_exam_attempt_field_result_counts CHECK (correct_count >= 0 AND total_questions > 0 AND correct_count <= total_questions)
);

CREATE INDEX IF NOT EXISTS idx_exam_attempt_field_results_field_score
    ON exam_attempt_field_results (professional_field_id, score);
CREATE INDEX IF NOT EXISTS idx_exam_attempt_field_results_attempt
    ON exam_attempt_field_results (attempt_id);

CREATE TABLE IF NOT EXISTS exam_attempt_cognitive_results (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),
    attempt_id BIGINT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    cognitive_level VARCHAR(48) NOT NULL,
    cognitive_label VARCHAR(128) NOT NULL,
    correct_count INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    score NUMERIC(6,2) NOT NULL,
    CONSTRAINT uq_exam_attempt_cognitive_result UNIQUE (attempt_id, cognitive_level),
    CONSTRAINT ck_exam_attempt_cognitive_result_counts CHECK (correct_count >= 0 AND total_questions > 0 AND correct_count <= total_questions)
);

CREATE INDEX IF NOT EXISTS idx_exam_attempt_cognitive_results_attempt
    ON exam_attempt_cognitive_results (attempt_id);

CREATE TABLE IF NOT EXISTS exam_attempt_cell_results (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),
    attempt_id BIGINT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    professional_field_id BIGINT NOT NULL,
    professional_field_code VARCHAR(128),
    professional_field_name VARCHAR(255) NOT NULL,
    cognitive_level VARCHAR(48) NOT NULL,
    cognitive_label VARCHAR(128) NOT NULL,
    correct_count INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    small_sample BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_exam_attempt_cell_result UNIQUE (attempt_id, professional_field_id, cognitive_level),
    CONSTRAINT ck_exam_attempt_cell_result_counts CHECK (correct_count >= 0 AND total_questions > 0 AND correct_count <= total_questions)
);

CREATE INDEX IF NOT EXISTS idx_exam_attempt_cell_results_matrix
    ON exam_attempt_cell_results (professional_field_id, cognitive_level, attempt_id);
