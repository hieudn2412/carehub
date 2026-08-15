-- Phase 3: versioned audience rules and immutable assignment target snapshots.
CREATE TABLE IF NOT EXISTS evaluation_audiences (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    rule_version INTEGER NOT NULL DEFAULT 1,
    rule_json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    created_by VARCHAR(100),
    used_at TIMESTAMP,
    supersedes_id BIGINT REFERENCES evaluation_audiences(id),
    CONSTRAINT ck_evaluation_audience_rule_version CHECK (rule_version = 1),
    CONSTRAINT ck_evaluation_audience_status CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    CONSTRAINT uq_evaluation_audience_version UNIQUE (supersedes_id, version)
);

CREATE INDEX IF NOT EXISTS idx_evaluation_audiences_status_updated
    ON evaluation_audiences (status, updated_at);

ALTER TABLE exam_assignments
    ADD COLUMN IF NOT EXISTS audience_id BIGINT REFERENCES evaluation_audiences(id);

ALTER TABLE exam_assignment_targets
    ADD COLUMN IF NOT EXISTS audience_id BIGINT REFERENCES evaluation_audiences(id),
    ADD COLUMN IF NOT EXISTS audience_version INTEGER,
    ADD COLUMN IF NOT EXISTS audience_rule_version INTEGER,
    ADD COLUMN IF NOT EXISTS matched_rule_json TEXT,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS source_department_id BIGINT,
    ADD COLUMN IF NOT EXISTS source_department_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source_position_name VARCHAR(255);

UPDATE exam_assignment_targets
SET resolved_at = COALESCE(resolved_at, created_at)
WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_exam_assignment_targets_audience
    ON exam_assignment_targets (audience_id, resolved_at);
CREATE INDEX IF NOT EXISTS idx_exam_assignment_targets_assignment_user_snapshot
    ON exam_assignment_targets (assignment_id, user_id, resolved_at);
