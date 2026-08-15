-- Read-only smoke checks for the remote database after V10.
SELECT installed_rank, version, description, success
FROM flyway_schema_history
WHERE success = TRUE
ORDER BY installed_rank DESC
LIMIT 5;

SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'exam_configs'
  AND column_name IN ('audience_id', 'source_scope', 'blueprint_version', 'pool_checksum')
ORDER BY column_name;

SELECT table_name
FROM information_schema.tables
WHERE table_name = 'exam_config_source_filters';

SELECT COUNT(*) AS blueprint_fields FROM exam_blueprint_fields;
SELECT COUNT(*) AS blueprint_cells FROM exam_blueprint_cells;
SELECT COUNT(*) AS approved_questions_with_cognitive
FROM questions
WHERE status = 'APPROVED'
  AND cognitive_level IS NOT NULL
  AND cognitive_verified_at IS NOT NULL
  AND cognitive_verified_by IS NOT NULL;
