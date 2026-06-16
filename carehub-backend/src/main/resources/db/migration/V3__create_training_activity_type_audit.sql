CREATE TABLE IF NOT EXISTS training_activity_type_change_logs (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    updated_by VARCHAR(255),
    activity_type_id BIGINT NOT NULL REFERENCES training_activity_types(id),
    version_no BIGINT NOT NULL,
    change_type VARCHAR(30) NOT NULL,
    before_data JSONB,
    after_data JSONB,
    changed_by_user_id BIGINT NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_training_activity_type_change_logs_type CHECK (
        change_type IN ('CREATED', 'UPDATED', 'ACTIVATED', 'DEACTIVATED')
    )
);

CREATE INDEX IF NOT EXISTS ix_training_activity_type_change_logs_activity_changed
    ON training_activity_type_change_logs(activity_type_id, changed_at DESC);
