\set ON_ERROR_STOP on
\pset pager off
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';

\echo [METRICS]
WITH metrics(metric, value) AS (
    VALUES
        ('database', current_database()),
        ('database_user', current_user),
        ('server_version', current_setting('server_version')),
        ('professional_fields', (SELECT COUNT(*)::text FROM professional_fields)),
        ('question_categories', (SELECT COUNT(*)::text FROM question_categories)),
        ('questions', (SELECT COUNT(*)::text FROM questions)),
        ('questions_approved', (SELECT COUNT(*)::text FROM questions WHERE status = 'APPROVED')),
        ('questions_medium', (SELECT COUNT(*)::text FROM questions WHERE lower(difficulty) = 'medium')),
        ('questions_without_category', (SELECT COUNT(*)::text FROM questions WHERE category_id IS NULL)),
        ('questions_orphan_category', (
            SELECT COUNT(*)::text
            FROM questions q
            LEFT JOIN question_categories c ON c.id = q.category_id
            WHERE c.id IS NULL
        )),
        ('categories_without_field', (SELECT COUNT(*)::text FROM question_categories WHERE professional_field_id IS NULL)),
        ('categories_orphan_field', (
            SELECT COUNT(*)::text
            FROM question_categories c
            LEFT JOIN professional_fields f ON f.id = c.professional_field_id
            WHERE f.id IS NULL
        )),
        ('question_sets', (SELECT COUNT(*)::text FROM question_sets)),
        ('question_set_items', (SELECT COUNT(*)::text FROM question_set_items)),
        ('question_set_versions', (SELECT COUNT(*)::text FROM question_set_versions)),
        ('exam_configs', (SELECT COUNT(*)::text FROM exam_configs)),
        ('exam_config_distributions', (SELECT COUNT(*)::text FROM exam_config_distributions)),
        ('exam_papers', (SELECT COUNT(*)::text FROM exam_papers)),
        ('exam_assignments', (SELECT COUNT(*)::text FROM exam_assignments)),
        ('exam_attempts', (SELECT COUNT(*)::text FROM exam_attempts)),
        ('users', (SELECT COUNT(*)::text FROM users)),
        ('users_active_not_deleted', (
            SELECT COUNT(*)::text FROM users
            WHERE status = 'ACTIVE' AND COALESCE(is_deleted, false) = false
        )),
        ('users_inactive_not_deleted', (
            SELECT COUNT(*)::text FROM users
            WHERE status = 'INACTIVE' AND COALESCE(is_deleted, false) = false
        )),
        ('users_deleted', (SELECT COUNT(*)::text FROM users WHERE COALESCE(is_deleted, false) = true)),
        ('departments', (SELECT COUNT(*)::text FROM departments)),
        ('training_groups', (SELECT COUNT(*)::text FROM training_groups)),
        ('training_group_members', (SELECT COUNT(*)::text FROM training_group_members)),
        ('has_employment_start_date', (
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'users'
                  AND column_name = 'employment_start_date'
            )::text
        )),
        ('has_flyway_history', (
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'flyway_schema_history'
            )::text
        )),
        ('has_liquibase_history', (
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'databasechangelog'
            )::text
        ))
)
SELECT metric, value FROM metrics ORDER BY metric;

\echo [CATEGORY_COUNTS]
SELECT c.code, c.name, f.code, COUNT(q.id)
FROM question_categories c
JOIN professional_fields f ON f.id = c.professional_field_id
LEFT JOIN questions q ON q.category_id = c.id
GROUP BY c.id, c.code, c.name, f.code
ORDER BY c.code;

\echo [RELEVANT_COLUMNS]
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
      (table_name = 'questions' AND column_name IN ('category_id', 'difficulty', 'topic', 'professional_field_id', 'cognitive_level', 'source_document'))
      OR (table_name = 'question_categories' AND column_name = 'professional_field_id')
      OR (table_name = 'exam_configs' AND column_name = 'question_set_id')
      OR (table_name = 'exam_papers' AND column_name IN ('question_set_id', 'professional_field_id'))
      OR (table_name = 'exam_assignments' AND column_name = 'professional_field_id')
      OR (table_name = 'users' AND column_name = 'employment_start_date')
  )
ORDER BY table_name, column_name;

\echo [RELEVANT_FOREIGN_KEYS]
SELECT tc.table_name, kcu.column_name, ccu.table_name, ccu.column_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.constraint_schema = kcu.constraint_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
 AND tc.constraint_schema = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
 AND rc.unique_constraint_schema = ccu.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
      'questions', 'question_categories', 'question_sets', 'question_set_items',
      'question_set_versions', 'exam_configs', 'exam_config_distributions',
      'exam_papers', 'exam_paper_questions', 'exam_assignments', 'exam_attempts'
  )
ORDER BY tc.table_name, kcu.column_name, ccu.table_name;

\echo [RELEVANT_INDEXES]
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('questions', 'question_categories', 'question_sets', 'exam_configs', 'exam_papers')
ORDER BY tablename, indexname;

COMMIT;
