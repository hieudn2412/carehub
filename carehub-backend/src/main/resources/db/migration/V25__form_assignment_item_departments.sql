CREATE TABLE IF NOT EXISTS form_assignment_item_departments (
    assignment_item_id BIGINT NOT NULL,
    department_id BIGINT NOT NULL,
    CONSTRAINT pk_form_assignment_item_departments PRIMARY KEY (assignment_item_id, department_id),
    CONSTRAINT fk_fai_departments_item FOREIGN KEY (assignment_item_id) REFERENCES form_assignment_items(id) ON DELETE CASCADE,
    CONSTRAINT fk_fai_departments_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fai_departments_item ON form_assignment_item_departments(assignment_item_id);
CREATE INDEX IF NOT EXISTS idx_fai_departments_department ON form_assignment_item_departments(department_id);

INSERT INTO form_assignment_item_departments (assignment_item_id, department_id)
SELECT item.id, department.id
FROM form_assignment_items item
CROSS JOIN departments department
ON CONFLICT (assignment_item_id, department_id) DO NOTHING;
