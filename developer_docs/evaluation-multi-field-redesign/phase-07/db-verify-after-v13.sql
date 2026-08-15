-- Phase 7 read-only verification after Flyway V13.
-- Run in DBeaver only after application startup reports V13 success.

BEGIN TRANSACTION READ ONLY;

SELECT version, description, success, installed_on
FROM flyway_schema_history
WHERE version = '13';

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'exam_attempt_field_results',
    'exam_attempt_cognitive_results',
    'exam_attempt_cell_results'
  )
ORDER BY table_name;

-- Each aggregate must point to a graded attempt and must not be duplicated.
SELECT result.attempt_id, result.professional_field_id, COUNT(*) AS duplicate_count
FROM exam_attempt_field_results result
GROUP BY result.attempt_id, result.professional_field_id
HAVING COUNT(*) > 1;

SELECT result.attempt_id, result.professional_field_id, result.cognitive_level, COUNT(*) AS duplicate_count
FROM exam_attempt_cell_results result
GROUP BY result.attempt_id, result.professional_field_id, result.cognitive_level
HAVING COUNT(*) > 1;

-- Sample integrity: denominators are never zero and names/code are snapshots, not joins to live taxonomy.
SELECT attempt_id, professional_field_code, professional_field_name,
       correct_count, total_questions, score, passing_threshold, passed
FROM exam_attempt_field_results
ORDER BY id DESC
LIMIT 20;

COMMIT;
