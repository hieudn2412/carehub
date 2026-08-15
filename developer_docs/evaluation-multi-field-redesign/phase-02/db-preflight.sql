-- Read-only preflight for Phase 2. Run against the remote database before migration.
-- This script must not mutate data.

SELECT current_database() AS database_name, current_user AS database_user;

SELECT to_regclass('flyway_schema_history') AS flyway_history_table,
       to_regclass('questions') AS questions_table,
       to_regclass('question_categories') AS categories_table,
       to_regclass('evaluation_import_job_rows') AS import_rows_table,
       to_regclass('document_question_candidates') AS candidate_table;

SELECT
    COUNT(*) AS question_count,
    COUNT(*) FILTER (WHERE status = 'APPROVED') AS approved_count,
    COUNT(*) FILTER (WHERE professional_field_id IS NOT NULL) AS direct_field_count,
    COUNT(*) FILTER (WHERE cognitive_level IS NOT NULL) AS classified_cognitive_count,
    COUNT(*) FILTER (WHERE cognitive_verified_at IS NOT NULL AND cognitive_verified_by IS NOT NULL) AS verified_cognitive_count
FROM questions;

SELECT
    COUNT(*) AS category_count,
    COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_category_count,
    COUNT(*) FILTER (WHERE professional_field_id IS NOT NULL) AS legacy_category_field_count
FROM question_categories;

SELECT
    COUNT(*) AS question_set_count,
    (SELECT COUNT(*) FROM exam_configs) AS exam_config_count,
    (SELECT COUNT(*) FROM exam_papers) AS exam_paper_count,
    (SELECT COUNT(*) FROM exam_assignments) AS exam_assignment_count,
    (SELECT COUNT(*) FROM exam_attempts) AS exam_attempt_count;

SELECT q.category_id, qc.code AS category_code, qc.name AS category_name,
       q.professional_field_id, pf.code AS field_code, pf.name AS field_name,
       q.status, q.cognitive_level,
       COUNT(*) AS question_count
FROM questions q
JOIN question_categories qc ON qc.id = q.category_id
LEFT JOIN professional_fields pf ON pf.id = q.professional_field_id
GROUP BY q.category_id, qc.code, qc.name, q.professional_field_id, pf.code, pf.name,
         q.status, q.cognitive_level
ORDER BY qc.code, pf.code, q.status, q.cognitive_level;
