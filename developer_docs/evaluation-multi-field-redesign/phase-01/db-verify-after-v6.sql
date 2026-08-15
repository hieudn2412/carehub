-- Phase 1 verification: run in DBeaver after Flyway V6 is applied.
-- Any invariant violation raises an exception. The transaction is read-only.
BEGIN TRANSACTION READ ONLY;

SELECT installed_rank, version, description, success, installed_on
FROM flyway_schema_history
ORDER BY installed_rank;

SELECT COUNT(*) AS total_questions,
       COUNT(professional_field_id) AS questions_with_field,
       COUNT(cognitive_level) AS questions_with_verified_cognitive_candidate,
       COUNT(source_document_id) AS questions_with_document_fk
FROM questions;

SELECT q.professional_field_id,
       f.code AS professional_field_code,
       f.name AS professional_field_name,
       COUNT(*) AS question_count
FROM questions q
JOIN professional_fields f ON f.id = q.professional_field_id
GROUP BY q.professional_field_id, f.code, f.name
ORDER BY f.code;

SELECT c.id AS category_id,
       c.code AS category_code,
       c.name AS category_name,
       COUNT(q.id) AS question_count
FROM question_categories c
LEFT JOIN questions q ON q.category_id = c.id
GROUP BY c.id, c.code, c.name
ORDER BY c.code;

SELECT table_name, column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND (
      (table_name = 'questions' AND column_name IN (
          'professional_field_id', 'cognitive_level', 'cognitive_verified_at',
          'cognitive_verified_by', 'source_document_id'
      ))
      OR (table_name = 'question_categories' AND column_name = 'professional_field_id')
      OR (table_name = 'exam_papers' AND column_name IN ('question_set_id', 'professional_field_id'))
      OR (table_name = 'users' AND column_name = 'employment_start_date')
  )
ORDER BY table_name, ordinal_position;

SELECT conrelid::regclass AS table_name,
       conname AS constraint_name,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN ('exam_blueprint_fields'::regclass, 'exam_blueprint_cells'::regclass)
ORDER BY conrelid::regclass::text, conname;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM questions WHERE professional_field_id IS NULL) THEN
        RAISE EXCEPTION 'Phase 1 invariant failed: question without professional field';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM questions q
        LEFT JOIN professional_fields f ON f.id = q.professional_field_id
        WHERE f.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Phase 1 invariant failed: orphan professional field on question';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM flyway_schema_history
        WHERE version = '6' AND success = TRUE
    ) THEN
        RAISE EXCEPTION 'Phase 1 invariant failed: Flyway V6 is not recorded as successful';
    END IF;

    IF to_regclass('exam_blueprint_fields') IS NULL
       OR to_regclass('exam_blueprint_cells') IS NULL THEN
        RAISE EXCEPTION 'Phase 1 invariant failed: blueprint foundation tables are missing';
    END IF;
END $$;

ROLLBACK;
