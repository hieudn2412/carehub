CREATE TABLE IF NOT EXISTS cme_scope_configuration (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    updated_by VARCHAR(255),
    scope_key VARCHAR(30) NOT NULL UNIQUE,
    lock_version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cme_scope_departments (
    configuration_id BIGINT NOT NULL,
    department_id BIGINT NOT NULL,
    PRIMARY KEY (configuration_id, department_id),
    CONSTRAINT fk_cme_scope_configuration
        FOREIGN KEY (configuration_id) REFERENCES cme_scope_configuration (id) ON DELETE CASCADE,
    CONSTRAINT fk_cme_scope_department
        FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE CASCADE
);
