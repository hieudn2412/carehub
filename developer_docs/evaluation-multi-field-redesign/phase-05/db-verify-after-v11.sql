-- Read-only smoke checks after Flyway V11. Do not reset or seed evaluation data.
SELECT version, description, success
FROM flyway_schema_history
WHERE version IN ('10', '11')
ORDER BY installed_rank;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('exam_paper_generation_batches', 'exam_paper_generation_batch_cells')
ORDER BY table_name;

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'exam_papers'
  AND column_name IN ('generation_batch_id', 'variant_index', 'config_version', 'generation_algorithm_version', 'generation_pool_checksum')
ORDER BY column_name;

SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'exam_paper_question_snapshots'
  AND column_name IN (
      'source_question_id', 'question_family_id', 'question_position', 'option_order_json',
      'cognitive_label', 'source_document_title', 'config_version', 'paper_seed',
      'generation_algorithm_version', 'generation_pool_checksum', 'generated_by', 'generated_at'
  )
ORDER BY column_name;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('uq_exam_paper_generation_batches_key', 'uq_exam_papers_generation_batch_variant')
ORDER BY indexname;

SELECT COUNT(*) AS batches, COALESCE(SUM(variant_count), 0) AS declared_variants
FROM exam_paper_generation_batches;

SELECT COUNT(*) AS papers_without_batch
FROM exam_papers
WHERE question_set_id IS NULL
  AND generation_batch_id IS NULL;
