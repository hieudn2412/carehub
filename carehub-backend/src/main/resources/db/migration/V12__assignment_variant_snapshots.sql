-- Phase 6: assignment target/variant snapshots.  Existing assignments retain
-- their selected paper and use the safe KEEP_VARIANT default.

ALTER TABLE exam_assignments
    ADD COLUMN IF NOT EXISTS generation_batch_id BIGINT REFERENCES exam_paper_generation_batches(id),
    ADD COLUMN IF NOT EXISTS variant_policy VARCHAR(32) NOT NULL DEFAULT 'FIXED_PAPER',
    ADD COLUMN IF NOT EXISTS retake_variant_policy VARCHAR(32) NOT NULL DEFAULT 'KEEP_VARIANT',
    ADD COLUMN IF NOT EXISTS request_hash VARCHAR(64);

ALTER TABLE exam_assignment_targets
    ADD COLUMN IF NOT EXISTS assigned_exam_paper_id BIGINT REFERENCES exam_papers(id),
    ADD COLUMN IF NOT EXISTS assigned_variant_index INTEGER,
    ADD COLUMN IF NOT EXISTS variant_policy VARCHAR(32) NOT NULL DEFAULT 'FIXED_PAPER';

UPDATE exam_assignments
SET generation_batch_id = ep.generation_batch_id
FROM exam_papers ep
WHERE ep.id = exam_assignments.exam_paper_id
  AND exam_assignments.generation_batch_id IS NULL;

UPDATE exam_assignment_targets target
SET assigned_exam_paper_id = assignment.exam_paper_id,
    assigned_variant_index = COALESCE(paper.variant_index, paper.version, 1)
FROM exam_assignments assignment
JOIN exam_papers paper ON paper.id = assignment.exam_paper_id
WHERE assignment.id = target.assignment_id
  AND target.assigned_exam_paper_id IS NULL;

ALTER TABLE exam_assignment_targets
    ALTER COLUMN assigned_exam_paper_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exam_assignments_generation_batch
    ON exam_assignments (generation_batch_id, status);

CREATE INDEX IF NOT EXISTS idx_exam_assignment_targets_variant
    ON exam_assignment_targets (assignment_id, assigned_exam_paper_id);
