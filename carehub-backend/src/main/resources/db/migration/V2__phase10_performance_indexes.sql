-- Phase 10: Performance indexes for evaluation module
-- These complement the JPA entity @Index annotations

-- Exam attempts: filter by status + date
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status_started
    ON exam_attempts (status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_score
    ON exam_attempts (user_id, score);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_paper_status
    ON exam_attempts (exam_paper_id, status);

-- Exam attempt answers: lookups by question
CREATE INDEX IF NOT EXISTS idx_exam_attempt_answers_question
    ON exam_attempt_answers (paper_question_id);

CREATE INDEX IF NOT EXISTS idx_exam_attempt_answers_correct
    ON exam_attempt_answers (attempt_id, correct);

-- Audit logs: common query patterns
CREATE INDEX IF NOT EXISTS idx_evaluation_audit_logs_entity
    ON evaluation_audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_evaluation_audit_logs_actor_time
    ON evaluation_audit_logs (actor, created_at DESC);

-- Question bank: filter by category + status
CREATE INDEX IF NOT EXISTS idx_question_bank_category_status
    ON question_bank_questions (category_id, status);

-- Competency thresholds: lookups
CREATE INDEX IF NOT EXISTS idx_competency_thresholds_category
    ON competency_threshold_configs (category_id, sort_order);

-- Prompt templates: lookups
CREATE INDEX IF NOT EXISTS idx_prompt_templates_active
    ON prompt_templates (provider, model, active);

-- Training groups
CREATE INDEX IF NOT EXISTS idx_training_group_members_user
    ON training_group_members (user_id);

-- Question embeddings: fast lookup for paginated dedup queries
CREATE INDEX IF NOT EXISTS idx_embedding_lookup
    ON question_embeddings (text_type, embedding_model, id DESC);
