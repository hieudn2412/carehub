-- Drop start_time/end_time from training_records.
-- Both columns are dead: not used by the legacy Excel import path
-- (TrainingLegacyImportServiceImpl / TrainingLegacyDurationParser), not used
-- by any compliance-hour calculation (TrainingStatusServiceImpl sums
-- declared_hours only), and the only consumer (an end>start time check in
-- TrainingDomainValidator) never fired in practice (0/29 rows ever set them).
-- Run this AFTER deploying the code that removes the fields from
-- TrainingRecord/TrainingRecordFormRequest/TrainingRecordDetailResponse, so
-- Hibernate (ddl-auto: update) is no longer writing to these columns.

ALTER TABLE training_records DROP COLUMN start_time;
ALTER TABLE training_records DROP COLUMN end_time;
