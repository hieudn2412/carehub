-- Phase 6 verification — read only. Run in DBeaver after Flyway V12.

SELECT version, description, success, installed_on
FROM flyway_schema_history
WHERE version IN ('11', '12')
ORDER BY installed_rank;

SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'exam_assignments'
  AND column_name IN ('generation_batch_id', 'variant_policy', 'retake_variant_policy', 'request_hash')
ORDER BY column_name;

SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'exam_assignment_targets'
  AND column_name IN ('assigned_exam_paper_id', 'assigned_variant_index', 'variant_policy')
ORDER BY column_name;

SELECT COUNT(*) AS targets_without_paper_snapshot
FROM exam_assignment_targets
WHERE assigned_exam_paper_id IS NULL;

SELECT target.id AS target_id, assignment.id AS assignment_id,
       target.assigned_exam_paper_id, assignment.exam_paper_id,
       assignment.generation_batch_id
FROM exam_assignment_targets target
JOIN exam_assignments assignment ON assignment.id = target.assignment_id
LEFT JOIN exam_papers paper ON paper.id = target.assigned_exam_paper_id
WHERE paper.id IS NULL
   OR (assignment.generation_batch_id IS NULL AND target.assigned_exam_paper_id <> assignment.exam_paper_id)
   OR (assignment.generation_batch_id IS NOT NULL AND paper.generation_batch_id <> assignment.generation_batch_id);

SELECT id, name, professional_field_id, generation_batch_id, variant_policy, retake_variant_policy
FROM exam_assignments
WHERE created_at >= CURRENT_DATE
  AND professional_field_id IS NOT NULL
ORDER BY id DESC;
