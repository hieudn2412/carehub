-- Read-only verification after backend restart has applied V9.
SELECT installed_rank, version, description, success
FROM flyway_schema_history
ORDER BY installed_rank;

SELECT COUNT(*) AS eligible_all_employees
FROM users
WHERE status = 'ACTIVE' AND is_deleted = FALSE;

SELECT COUNT(*) AS evaluation_audiences FROM evaluation_audiences;
SELECT COUNT(*) AS assignment_targets_with_snapshot
FROM exam_assignment_targets
WHERE resolved_at IS NOT NULL;

SELECT column_name
FROM information_schema.columns
WHERE table_name IN ('exam_assignments', 'exam_assignment_targets')
  AND column_name IN ('audience_id', 'audience_version', 'audience_rule_version', 'matched_rule_json', 'resolved_at', 'source_department_id', 'source_department_name', 'source_position_name')
ORDER BY table_name, ordinal_position;
