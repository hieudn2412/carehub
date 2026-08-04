create table if not exists form_compliance_targets (
    id bigserial primary key,
    form_template_id bigint not null references form_templates(id),
    department_id bigint references departments(id),
    target_percent numeric(5,2) not null,
    lock_version bigint not null default 0,
    created_at timestamp not null default current_timestamp,
    updated_at timestamp,
    updated_by varchar(255),
    constraint ck_form_compliance_target_percent check (target_percent between 0 and 100)
);

create unique index if not exists uk_form_compliance_target_hospital
    on form_compliance_targets(form_template_id) where department_id is null;

create unique index if not exists uk_form_compliance_target_department
    on form_compliance_targets(form_template_id, department_id) where department_id is not null;

create index if not exists idx_form_compliance_target_department
    on form_compliance_targets(department_id, form_template_id);
