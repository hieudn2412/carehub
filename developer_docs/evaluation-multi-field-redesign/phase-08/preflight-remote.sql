-- Phase 8 remote preflight (read-only; never run reset/seed from this file).
SELECT 'questions' AS metric, COUNT(*)::text AS value FROM questions
UNION ALL SELECT 'questions_approved', COUNT(*)::text FROM questions WHERE status='APPROVED'
UNION ALL SELECT 'questions_without_category', COUNT(*)::text FROM questions WHERE category_id IS NULL
UNION ALL SELECT 'questions_without_field', COUNT(*)::text FROM questions WHERE professional_field_id IS NULL
UNION ALL SELECT 'questions_without_verified_cognitive', COUNT(*)::text FROM questions WHERE cognitive_verified_at IS NULL
UNION ALL SELECT 'question_categories', COUNT(*)::text FROM question_categories
UNION ALL SELECT 'professional_fields', COUNT(*)::text FROM professional_fields
UNION ALL SELECT 'question_sets', COUNT(*)::text FROM question_sets
UNION ALL SELECT 'question_set_items', COUNT(*)::text FROM question_set_items
UNION ALL SELECT 'question_set_versions', COUNT(*)::text FROM question_set_versions
UNION ALL SELECT 'exam_configs', COUNT(*)::text FROM exam_configs
UNION ALL SELECT 'exam_papers', COUNT(*)::text FROM exam_papers
UNION ALL SELECT 'exam_assignments', COUNT(*)::text FROM exam_assignments
UNION ALL SELECT 'exam_attempts', COUNT(*)::text FROM exam_attempts;

SELECT c.code, c.name, COUNT(q.id) AS approved_questions
FROM question_categories c
LEFT JOIN questions q ON q.category_id = c.id AND q.status = 'APPROVED'
GROUP BY c.id, c.code, c.name
ORDER BY c.code;

SELECT q.id, q.category_id, q.professional_field_id
FROM questions q
LEFT JOIN question_categories c ON c.id = q.category_id
LEFT JOIN professional_fields f ON f.id = q.professional_field_id
WHERE q.category_id IS NULL OR q.professional_field_id IS NULL OR c.id IS NULL OR f.id IS NULL
LIMIT 100;

SELECT installed_rank, version, description, success
FROM flyway_schema_history
ORDER BY installed_rank DESC
LIMIT 5;
