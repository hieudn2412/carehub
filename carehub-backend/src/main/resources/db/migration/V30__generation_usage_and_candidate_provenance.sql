ALTER TABLE document_question_jobs
    ADD COLUMN IF NOT EXISTS total_prompt_cache_hit_tokens integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_prompt_cache_miss_tokens integer NOT NULL DEFAULT 0;

ALTER TABLE document_question_chunk_results
    ADD COLUMN IF NOT EXISTS prompt_cache_hit_tokens integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS prompt_cache_miss_tokens integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS estimated_cost_usd double precision NOT NULL DEFAULT 0;

UPDATE questions q
SET source_document_id = candidate.document_id
FROM document_question_candidates candidate
WHERE candidate.saved_question_id = q.id
  AND q.source_document_id IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM questions q
        JOIN document_question_candidates candidate ON candidate.saved_question_id = q.id
        WHERE q.source_document_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Candidate-derived question is missing source_document_id';
    END IF;
END $$;
