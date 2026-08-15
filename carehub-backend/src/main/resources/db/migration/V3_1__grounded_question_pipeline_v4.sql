-- Additive schema for Grounded Pipeline v4. Existing jobs and candidates remain readable.
ALTER TABLE document_question_jobs
    ADD COLUMN IF NOT EXISTS pipeline_version VARCHAR(32),
    ADD COLUMN IF NOT EXISTS target_difficulty VARCHAR(16),
    ADD COLUMN IF NOT EXISTS prompt_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS eligible_chunk_count INTEGER,
    ADD COLUMN IF NOT EXISTS skipped_chunk_count INTEGER,
    ADD COLUMN IF NOT EXISTS problem_chunk_count INTEGER,
    ADD COLUMN IF NOT EXISTS reviewable_candidate_count INTEGER,
    ADD COLUMN IF NOT EXISTS rejected_candidate_count INTEGER,
    ADD COLUMN IF NOT EXISTS critic_call_count INTEGER;

ALTER TABLE document_question_candidates
    ADD COLUMN IF NOT EXISTS question_type VARCHAR(48),
    ADD COLUMN IF NOT EXISTS answer_evidence TEXT,
    ADD COLUMN IF NOT EXISTS distractor_rationales TEXT,
    ADD COLUMN IF NOT EXISTS validation_grade VARCHAR(16),
    ADD COLUMN IF NOT EXISTS validation_source VARCHAR(32),
    ADD COLUMN IF NOT EXISTS validation_issues TEXT,
    ADD COLUMN IF NOT EXISTS evidence_status VARCHAR(32),
    ADD COLUMN IF NOT EXISTS critic_status VARCHAR(32);

CREATE TABLE IF NOT EXISTS document_question_chunk_results (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES document_question_jobs(id),
    chunk_id BIGINT NOT NULL REFERENCES document_chunks(id),
    attempt_no INTEGER NOT NULL,
    status VARCHAR(40) NOT NULL,
    knowledge_point_count INTEGER NOT NULL DEFAULT 0,
    raw_question_count INTEGER NOT NULL DEFAULT 0,
    reviewable_count INTEGER NOT NULL DEFAULT 0,
    rejected_count INTEGER NOT NULL DEFAULT 0,
    critic_call_count INTEGER NOT NULL DEFAULT 0,
    repair_call_count INTEGER NOT NULL DEFAULT 0,
    llm_call_count INTEGER NOT NULL DEFAULT 0,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms BIGINT NOT NULL DEFAULT 0,
    error_code VARCHAR(64),
    error_message TEXT,
    retryable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),
    CONSTRAINT uq_document_question_chunk_result_attempt
        UNIQUE (job_id, chunk_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_document_question_chunk_results_job_status
    ON document_question_chunk_results (job_id, status);
