-- Phase 4: direct field x cognitive exam configuration.
ALTER TABLE exam_configs
    ADD COLUMN IF NOT EXISTS audience_id BIGINT REFERENCES evaluation_audiences(id),
    ADD COLUMN IF NOT EXISTS source_scope VARCHAR(32) NOT NULL DEFAULT 'QUESTION_BANK',
    ADD COLUMN IF NOT EXISTS blueprint_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS pool_checksum VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_exam_configs_audience_status
    ON exam_configs (audience_id, status);

CREATE TABLE IF NOT EXISTS exam_config_source_filters (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),
    exam_config_id BIGINT NOT NULL REFERENCES exam_configs(id) ON DELETE CASCADE,
    filter_type VARCHAR(32) NOT NULL,
    reference_id BIGINT NOT NULL,
    CONSTRAINT ck_exam_config_source_filter_type CHECK (filter_type IN ('INCLUDE_CATEGORY', 'EXCLUDE_CATEGORY', 'INCLUDE_DOCUMENT', 'EXCLUDE_DOCUMENT')),
    CONSTRAINT uq_exam_config_source_filter UNIQUE (exam_config_id, filter_type, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_config_source_filters_config
    ON exam_config_source_filters (exam_config_id, filter_type);
