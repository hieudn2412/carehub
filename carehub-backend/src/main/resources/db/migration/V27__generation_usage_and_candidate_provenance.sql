-- Keep document question generation usage and candidate provenance schema in sync.

ALTER TABLE document_question_jobs
    ADD COLUMN IF NOT EXISTS llm_call_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_prompt_tokens INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_completion_tokens INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_tokens INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_latency_ms BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_prompt_cache_hit_tokens INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_prompt_cache_miss_tokens INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS estimated_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS trace_id VARCHAR(16);

ALTER TABLE document_question_candidates
    ADD COLUMN IF NOT EXISTS source_excerpt TEXT,
    ADD COLUMN IF NOT EXISTS knowledge_point_key VARCHAR(64),
    ADD COLUMN IF NOT EXISTS question_type VARCHAR(48),
    ADD COLUMN IF NOT EXISTS answer_evidence TEXT,
    ADD COLUMN IF NOT EXISTS distractor_rationales TEXT,
    ADD COLUMN IF NOT EXISTS generation_key VARCHAR(128);

CREATE TABLE IF NOT EXISTS document_question_chunk_results (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),
    job_id BIGINT NOT NULL REFERENCES document_question_jobs(id) ON DELETE CASCADE,
    chunk_id BIGINT NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
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
    prompt_cache_hit_tokens INTEGER NOT NULL DEFAULT 0,
    prompt_cache_miss_tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms BIGINT NOT NULL DEFAULT 0,
    estimated_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
    error_code VARCHAR(64),
    error_message TEXT,
    retryable BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_document_question_chunk_result_attempt UNIQUE (job_id, chunk_id, attempt_no)
);

ALTER TABLE document_question_chunk_results
    ADD COLUMN IF NOT EXISTS prompt_cache_hit_tokens INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS prompt_cache_miss_tokens INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS estimated_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_document_question_chunk_results_job
    ON document_question_chunk_results (job_id, attempt_no);

CREATE INDEX IF NOT EXISTS idx_document_question_chunk_results_chunk
    ON document_question_chunk_results (chunk_id, attempt_no);
