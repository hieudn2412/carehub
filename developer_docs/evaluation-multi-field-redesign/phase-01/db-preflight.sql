-- Phase 1 preflight: safe to run in DBeaver before applying V6.
-- Read-only by design. It does not create, update, or delete anything.
BEGIN TRANSACTION READ ONLY;

SELECT current_database() AS database_name,
       current_user AS database_user,
       version() AS database_version,
       CURRENT_TIMESTAMP AS checked_at;

SELECT 'professional_fields' AS object_name, COUNT(*) AS row_count FROM professional_fields
UNION ALL SELECT 'question_categories', COUNT(*) FROM question_categories
UNION ALL SELECT 'questions', COUNT(*) FROM questions
UNION ALL SELECT 'question_sets', COUNT(*) FROM question_sets
UNION ALL SELECT 'exam_configs', COUNT(*) FROM exam_configs
UNION ALL SELECT 'exam_papers', COUNT(*) FROM exam_papers
UNION ALL SELECT 'exam_assignments', COUNT(*) FROM exam_assignments
UNION ALL SELECT 'exam_attempts', COUNT(*) FROM exam_attempts
ORDER BY object_name;

SELECT COUNT(*) AS questions_without_category
FROM questions q
LEFT JOIN question_categories c ON c.id = q.category_id
WHERE c.id IS NULL;

SELECT COUNT(*) AS questions_whose_legacy_category_has_no_field
FROM questions q
JOIN question_categories c ON c.id = q.category_id
LEFT JOIN professional_fields f ON f.id = c.professional_field_id
WHERE f.id IS NULL;

SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name IN ('questions', 'question_categories', 'exam_papers', 'users')
  AND column_name IN (
      'professional_field_id', 'cognitive_level', 'source_document_id',
      'question_set_id', 'employment_start_date'
  )
ORDER BY table_name, ordinal_position;

SELECT to_regclass('exam_blueprint_fields') AS exam_blueprint_fields,
       to_regclass('exam_blueprint_cells') AS exam_blueprint_cells,
       to_regclass('flyway_schema_history') AS flyway_schema_history;

SELECT COUNT(*) AS safely_matchable_source_documents
FROM questions q
JOIN (
    SELECT filename
    FROM documents
    GROUP BY filename
    HAVING COUNT(*) = 1
) d ON BTRIM(q.source_document) = d.filename
WHERE q.source_document IS NOT NULL;

ROLLBACK;
