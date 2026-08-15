param(
    [string]$ConnectionString = $env:CAREHUB_DATABASE_URL,
    [string]$BackupPath = (Join-Path (Get-Location) ("evaluation-backup-{0}.dump" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))),
    [switch]$ConfirmReset
)

if (-not $ConfirmReset) {
    throw 'This is destructive. Re-run with -ConfirmReset after taking a database backup.'
}
if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    throw 'Set CAREHUB_DATABASE_URL or pass -ConnectionString.'
}

Write-Host "Creating backup at $BackupPath ..."
pg_dump $ConnectionString --format=custom --file=$BackupPath
if ($LASTEXITCODE -ne 0) {
    throw "Backup failed with exit code $LASTEXITCODE. No data was deleted."
}

$sql = @'
BEGIN;

-- Keep users, departments, training records, and professional fields.
-- Remove only records owned by the evaluation module, deepest dependencies first.
DELETE FROM exam_attempt_answers;
DELETE FROM exam_attempt_questions;
DELETE FROM exam_attempts;
DELETE FROM exam_assignment_targets;
DELETE FROM exam_assignments;
DELETE FROM exam_paper_question_snapshots;
DELETE FROM exam_paper_questions;
DELETE FROM exam_papers;
DO $$ BEGIN
    IF to_regclass('exam_paper_generation_batch_cells') IS NOT NULL THEN
        EXECUTE 'DELETE FROM exam_paper_generation_batch_cells';
    END IF;
    IF to_regclass('exam_paper_generation_batches') IS NOT NULL THEN
        EXECUTE 'DELETE FROM exam_paper_generation_batches';
    END IF;
END $$;
DELETE FROM exam_config_distributions;
DELETE FROM exam_config_source_filters;
DELETE FROM exam_blueprint_cells;
DELETE FROM exam_blueprint_fields;
DELETE FROM exam_configs;
DELETE FROM question_set_item_snapshots;
DELETE FROM question_set_version_items;
DELETE FROM question_set_versions;
DELETE FROM question_set_items;
DELETE FROM question_sets;
DELETE FROM question_embeddings;
DELETE FROM paraphrase_candidates;
DELETE FROM paraphrase_jobs;
DELETE FROM questions;
DELETE FROM question_classification_rules;
DELETE FROM document_knowledge_points;
DELETE FROM document_question_candidates;
DELETE FROM document_question_chunk_results;
DELETE FROM document_question_jobs;
DELETE FROM question_categories;
DELETE FROM question_set_categories;

-- Exam-created training/notification/audit records are traceable by reference.
DELETE FROM training_records WHERE source_reference LIKE 'EXAM_%';
DELETE FROM notifications WHERE dedup_key LIKE 'EXAM_%';
DELETE FROM evaluation_audit_logs WHERE entity_type LIKE 'EXAM%'
    OR entity_type LIKE 'QUESTION%';

-- After the evaluation data is reset, enforce only links that remain canonical.
ALTER TABLE questions ALTER COLUMN category_id SET NOT NULL;

COMMIT;
'@

psql $ConnectionString -v ON_ERROR_STOP=1 -c $sql
if ($LASTEXITCODE -ne 0) {
    throw "Evaluation reset failed with exit code $LASTEXITCODE."
}
Write-Host 'Evaluation module reset completed. Restart the application with seeding enabled.'
