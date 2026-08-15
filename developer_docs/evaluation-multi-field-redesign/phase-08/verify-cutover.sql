-- Post-deploy verification (read-only). Save the result with the deployment record.
-- This script deliberately reports blockers; it never changes schema or data.

SELECT 'questions' AS metric, COUNT(*)::text AS value FROM questions
UNION ALL SELECT 'questions_approved', COUNT(*)::text FROM questions WHERE status = 'APPROVED'
UNION ALL SELECT 'questions_without_category', COUNT(*)::text FROM questions WHERE category_id IS NULL
UNION ALL SELECT 'questions_without_field', COUNT(*)::text FROM questions WHERE professional_field_id IS NULL
UNION ALL SELECT 'questions_without_verified_cognitive', COUNT(*)::text
    FROM questions
    WHERE status = 'APPROVED' AND (cognitive_verified_at IS NULL OR cognitive_verified_by IS NULL)
UNION ALL SELECT 'verified_direct_pool', COUNT(*)::text
    FROM questions q
    JOIN question_categories c ON c.id = q.category_id
    JOIN professional_fields f ON f.id = q.professional_field_id
    WHERE q.status = 'APPROVED'
      AND c.status = 'ACTIVE'
      AND f.is_active = TRUE
      AND q.cognitive_level IS NOT NULL
      AND q.cognitive_verified_at IS NOT NULL
      AND q.cognitive_verified_by IS NOT NULL
UNION ALL SELECT 'question_categories', COUNT(*)::text FROM question_categories
UNION ALL SELECT 'professional_fields', COUNT(*)::text FROM professional_fields
UNION ALL SELECT 'question_sets', COUNT(*)::text FROM question_sets
UNION ALL SELECT 'question_set_items', COUNT(*)::text FROM question_set_items
UNION ALL SELECT 'question_set_versions', COUNT(*)::text FROM question_set_versions
UNION ALL SELECT 'exam_configs', COUNT(*)::text FROM exam_configs
UNION ALL SELECT 'exam_papers', COUNT(*)::text FROM exam_papers
UNION ALL SELECT 'exam_assignments', COUNT(*)::text FROM exam_assignments
UNION ALL SELECT 'exam_attempts', COUNT(*)::text FROM exam_attempts
ORDER BY metric;

SELECT c.code, COUNT(q.id) AS approved_count
FROM question_categories c
LEFT JOIN questions q ON q.category_id = c.id AND q.status = 'APPROVED'
GROUP BY c.code ORDER BY c.code;

-- FK/orphan checks. Every count must be zero.
SELECT 'questions_with_missing_category_row' AS check_name, COUNT(*) AS failures
FROM questions q LEFT JOIN question_categories c ON c.id = q.category_id WHERE c.id IS NULL
UNION ALL SELECT 'questions_with_missing_field_row', COUNT(*)
FROM questions q LEFT JOIN professional_fields f ON f.id = q.professional_field_id WHERE f.id IS NULL
UNION ALL SELECT 'categories_duplicate_code', COUNT(*)
FROM (SELECT code FROM question_categories GROUP BY code HAVING COUNT(*) > 1) duplicates
UNION ALL SELECT 'fields_duplicate_code', COUNT(*)
FROM (SELECT code FROM professional_fields GROUP BY code HAVING COUNT(*) > 1) duplicates;

-- Required snapshot/index schema evidence.
SELECT table_name, column_name
FROM information_schema.columns
WHERE (table_name, column_name) IN (
    ('evaluation_import_job_rows', 'category_id_snapshot'),
    ('evaluation_import_job_rows', 'professional_field_id_snapshot'),
    ('evaluation_import_job_rows', 'cognitive_verified_at_snapshot'),
    ('exam_paper_question_snapshots', 'source_document_content_hash'),
    ('question_set_version_items', 'source_document_content_hash'),
    ('exam_attempt_field_results', 'professional_field_id'),
    ('exam_attempt_cognitive_results', 'cognitive_level'),
    ('exam_attempt_cell_results', 'professional_field_id')
)
ORDER BY table_name, column_name;

SELECT indexname
FROM pg_indexes
WHERE indexname IN (
    'idx_questions_status_field_cognitive',
    'idx_questions_category_status',
    'idx_questions_source_document_id',
    'idx_exam_blueprint_fields_config_order',
    'idx_exam_blueprint_cells_field'
)
ORDER BY indexname;

SELECT installed_rank, version, description, success
FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1;
