-- Read-only verification for Phase 2 migrations V7 and V8.
-- Run only after V6, V7 and V8 have been applied by Flyway.

SELECT to_regclass('flyway_schema_history') AS flyway_history_table,
       to_regclass('questions') AS questions_table,
       to_regclass('evaluation_import_job_rows') AS import_rows_table,
       to_regclass('document_question_candidates') AS candidate_table;

SELECT table_name, column_name
FROM information_schema.columns
WHERE (table_name, column_name) IN (
    ('evaluation_import_job_rows', 'cognitive_level_snapshot'),
    ('evaluation_import_job_rows', 'cognitive_verified_at_snapshot'),
    ('evaluation_import_job_rows', 'source_document_filename_snapshot'),
    ('document_question_jobs', 'professional_field_id'),
    ('document_question_candidates', 'category_id'),
    ('document_question_candidates', 'professional_field_id'),
    ('document_question_candidates', 'cognitive_level'),
    ('document_question_candidates', 'cognitive_verified_at'),
    ('document_question_candidates', 'cognitive_verified_by')
)
ORDER BY table_name, column_name;

SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE conname IN (
    'fk_questions_professional_field',
    'fk_document_question_jobs_professional_field',
    'fk_document_question_candidates_category',
    'fk_document_question_candidates_professional_field'
)
ORDER BY conname;

SELECT
    COUNT(*) AS question_count,
    COUNT(*) FILTER (WHERE professional_field_id IS NULL) AS missing_field_count,
    COUNT(*) FILTER (WHERE category_id IS NULL) AS missing_category_count,
    COUNT(*) FILTER (WHERE status = 'APPROVED' AND cognitive_verified_at IS NOT NULL
                     AND cognitive_verified_by IS NOT NULL) AS verified_approved_count
FROM questions;

SELECT category_id, COUNT(*) AS approved_question_count
FROM questions
WHERE status = 'APPROVED'
GROUP BY category_id
ORDER BY category_id;
