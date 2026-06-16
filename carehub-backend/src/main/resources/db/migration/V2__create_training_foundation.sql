CREATE TABLE IF NOT EXISTS professional_fields (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    updated_by VARCHAR(255),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS training_activity_types (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    updated_by VARCHAR(255),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_duration_unit VARCHAR(20) NOT NULL DEFAULT 'HOUR',
    requires_evidence BOOLEAN NOT NULL DEFAULT TRUE,
    max_credited_hours_per_record NUMERIC(8,2),
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_user_id BIGINT REFERENCES users(id),
    updated_by_user_id BIGINT REFERENCES users(id),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_training_activity_types_duration_unit CHECK (
        default_duration_unit IN ('HOUR', 'LESSON', 'CREDIT', 'DAY', 'MONTH', 'YEAR', 'OTHER')
    ),
    CONSTRAINT ck_training_activity_types_max_hours CHECK (
        max_credited_hours_per_record IS NULL OR max_credited_hours_per_record >= 0
    )
);

CREATE TABLE IF NOT EXISTS training_import_batches (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    updated_by VARCHAR(255),
    original_filename VARCHAR(500) NOT NULL,
    status VARCHAR(30) NOT NULL,
    total_rows INT NOT NULL DEFAULT 0,
    success_rows INT NOT NULL DEFAULT 0,
    failed_rows INT NOT NULL DEFAULT 0,
    warning_rows INT NOT NULL DEFAULT 0,
    imported_by_user_id BIGINT NOT NULL REFERENCES users(id),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_training_import_batches_status CHECK (
        status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'COMPLETED_WITH_WARNINGS')
    ),
    CONSTRAINT ck_training_import_batches_counts CHECK (
        total_rows >= 0 AND success_rows >= 0 AND failed_rows >= 0 AND warning_rows >= 0
    )
);

CREATE TABLE IF NOT EXISTS training_requirements (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    updated_by VARCHAR(255),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    required_hours NUMERIC(8,2) NOT NULL DEFAULT 120,
    cycle_years INT NOT NULL DEFAULT 5,
    job_position_id BIGINT REFERENCES positions(id),
    department_id BIGINT REFERENCES departments(id),
    professional_field_id BIGINT REFERENCES professional_fields(id),
    warning_threshold_hours NUMERIC(8,2),
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_user_id BIGINT REFERENCES users(id),
    updated_by_user_id BIGINT REFERENCES users(id),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_training_requirements_required_hours CHECK (required_hours >= 0 AND required_hours <= 500),
    CONSTRAINT ck_training_requirements_cycle_years CHECK (cycle_years > 0),
    CONSTRAINT ck_training_requirements_effective_range CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT ck_training_requirements_warning_threshold CHECK (
        warning_threshold_hours IS NULL OR warning_threshold_hours >= 0
    )
);

CREATE TABLE IF NOT EXISTS training_records (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    updated_by VARCHAR(255),
    employee_id BIGINT NOT NULL REFERENCES users(id),
    employee_department_id_snapshot BIGINT REFERENCES departments(id),
    activity_type_id BIGINT NOT NULL REFERENCES training_activity_types(id),
    professional_field_id BIGINT REFERENCES professional_fields(id),
    title VARCHAR(500) NOT NULL,
    provider VARCHAR(255),
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    start_time TIME,
    end_time TIME,
    duration_value NUMERIC(10,2),
    duration_unit VARCHAR(20) NOT NULL DEFAULT 'HOUR',
    duration_raw_text VARCHAR(100),
    declared_hours NUMERIC(8,2),
    approved_hours NUMERIC(8,2),
    workflow_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    edit_count INT NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ,
    latest_reviewed_by_user_id BIGINT REFERENCES users(id),
    latest_reviewed_at TIMESTAMPTZ,
    latest_rejection_reason TEXT,
    source_type VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    source_reference VARCHAR(255),
    source_submitted_at TIMESTAMPTZ,
    import_batch_id BIGINT REFERENCES training_import_batches(id),
    created_by_user_id BIGINT NOT NULL REFERENCES users(id),
    updated_by_user_id BIGINT REFERENCES users(id),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_training_records_duration_unit CHECK (
        duration_unit IN ('HOUR', 'LESSON', 'CREDIT', 'DAY', 'MONTH', 'YEAR', 'OTHER')
    ),
    CONSTRAINT ck_training_records_workflow_status CHECK (
        workflow_status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED')
    ),
    CONSTRAINT ck_training_records_source_type CHECK (
        source_type IN ('MANUAL', 'LEGACY_IMPORT', 'ADMIN_IMPORT')
    ),
    CONSTRAINT ck_training_records_date_range CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT ck_training_records_time_range CHECK (
        start_time IS NULL OR end_time IS NULL OR end_date IS NOT NULL OR end_time >= start_time
    ),
    CONSTRAINT ck_training_records_declared_hours CHECK (declared_hours IS NULL OR declared_hours > 0),
    CONSTRAINT ck_training_records_approved_hours CHECK (
        approved_hours IS NULL OR (approved_hours >= 0 AND workflow_status = 'APPROVED')
    ),
    CONSTRAINT ck_training_records_edit_count CHECK (edit_count >= 0)
);

CREATE TABLE IF NOT EXISTS training_evidence_files (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    updated_by VARCHAR(255),
    training_record_id BIGINT NOT NULL REFERENCES training_records(id),
    original_filename VARCHAR(500) NOT NULL,
    object_key TEXT,
    legacy_external_url TEXT,
    mime_type VARCHAR(100),
    file_size_bytes BIGINT,
    checksum_sha256 VARCHAR(64),
    moderation_status VARCHAR(30) NOT NULL DEFAULT 'NOT_REQUESTED',
    moderation_provider VARCHAR(100),
    moderation_result JSONB,
    moderation_checked_at TIMESTAMPTZ,
    uploaded_by_user_id BIGINT NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT ck_training_evidence_files_moderation_status CHECK (
        moderation_status IN ('NOT_REQUESTED', 'PENDING', 'PASSED', 'FAILED', 'ERROR')
    ),
    CONSTRAINT ck_training_evidence_files_size CHECK (
        file_size_bytes IS NULL OR (file_size_bytes > 0 AND file_size_bytes <= 5242880)
    ),
    CONSTRAINT ck_training_evidence_files_mime CHECK (
        mime_type IS NULL OR mime_type IN ('image/jpeg', 'image/png', 'application/pdf')
    ),
    CONSTRAINT ck_training_evidence_files_location CHECK (
        object_key IS NOT NULL OR legacy_external_url IS NOT NULL
    )
);

CREATE TABLE IF NOT EXISTS training_record_reviews (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    updated_by VARCHAR(255),
    training_record_id BIGINT NOT NULL REFERENCES training_records(id),
    decision VARCHAR(30) NOT NULL,
    declared_hours_snapshot NUMERIC(8,2),
    approved_hours NUMERIC(8,2),
    reason TEXT,
    reviewed_by_user_id BIGINT NOT NULL REFERENCES users(id),
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_training_record_reviews_decision CHECK (decision IN ('APPROVED', 'REJECTED')),
    CONSTRAINT ck_training_record_reviews_declared_hours CHECK (
        declared_hours_snapshot IS NULL OR declared_hours_snapshot > 0
    ),
    CONSTRAINT ck_training_record_reviews_approved_hours CHECK (approved_hours IS NULL OR approved_hours >= 0),
    CONSTRAINT ck_training_record_reviews_rejection_reason CHECK (
        decision <> 'REJECTED' OR (reason IS NOT NULL AND length(trim(reason)) > 0)
    )
);

CREATE TABLE IF NOT EXISTS training_record_change_logs (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    updated_by VARCHAR(255),
    training_record_id BIGINT NOT NULL REFERENCES training_records(id),
    version_no BIGINT NOT NULL,
    change_type VARCHAR(30) NOT NULL,
    before_data JSONB,
    after_data JSONB,
    changed_by_user_id BIGINT NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_training_record_change_logs_type CHECK (
        change_type IN ('CREATED', 'UPDATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'EVIDENCE_UPLOADED', 'EVIDENCE_DELETED')
    )
);

CREATE TABLE IF NOT EXISTS training_import_rows (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    updated_by VARCHAR(255),
    import_batch_id BIGINT NOT NULL REFERENCES training_import_batches(id),
    source_row_number INT NOT NULL,
    raw_data JSONB NOT NULL,
    normalized_data JSONB,
    validation_status VARCHAR(30) NOT NULL,
    validation_messages JSONB,
    training_record_id BIGINT REFERENCES training_records(id),
    CONSTRAINT ck_training_import_rows_source_row CHECK (source_row_number > 0),
    CONSTRAINT ck_training_import_rows_status CHECK (
        validation_status IN ('VALID', 'WARNING', 'INVALID', 'IMPORTED', 'SKIPPED')
    )
);

CREATE INDEX IF NOT EXISTS ix_training_records_employee_start_date ON training_records(employee_id, start_date DESC);
CREATE INDEX IF NOT EXISTS ix_training_records_workflow_submitted ON training_records(workflow_status, submitted_at);
CREATE INDEX IF NOT EXISTS ix_training_records_activity_start_date ON training_records(activity_type_id, start_date);
CREATE INDEX IF NOT EXISTS ix_training_records_professional_start_date ON training_records(professional_field_id, start_date);
CREATE INDEX IF NOT EXISTS ix_training_records_department_start_date ON training_records(employee_department_id_snapshot, start_date);
CREATE INDEX IF NOT EXISTS ix_training_records_import_batch ON training_records(import_batch_id);
CREATE INDEX IF NOT EXISTS ix_training_evidence_files_record_active ON training_evidence_files(training_record_id, is_active);
CREATE INDEX IF NOT EXISTS ix_training_evidence_files_moderation ON training_evidence_files(moderation_status);
CREATE INDEX IF NOT EXISTS ix_training_record_reviews_record_reviewed ON training_record_reviews(training_record_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS ix_training_requirements_scope_effective ON training_requirements(job_position_id, department_id, professional_field_id, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS ix_training_activity_types_active_sort_name ON training_activity_types(is_active, sort_order, name);
CREATE INDEX IF NOT EXISTS ix_training_import_rows_batch_status ON training_import_rows(import_batch_id, validation_status);
