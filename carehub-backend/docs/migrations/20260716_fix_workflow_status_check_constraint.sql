-- Fix training_records_workflow_status_check constraint
-- Root cause: constraint was created by an older version that didn't include 'SUBMITTED'
-- This causes HTTP 500 "DataIntegrityViolationException" when submitting training records

-- Step 1: Drop the old constraint
ALTER TABLE IF EXISTS training_records
    DROP CONSTRAINT IF EXISTS training_records_workflow_status_check;

-- Step 2: Recreate with all valid values
ALTER TABLE training_records
    ADD CONSTRAINT training_records_workflow_status_check
        CHECK (workflow_status IN ('DRAFT', 'SUBMITTED', 'CANCELLED'));

-- Verify
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conname = 'training_records_workflow_status_check';
