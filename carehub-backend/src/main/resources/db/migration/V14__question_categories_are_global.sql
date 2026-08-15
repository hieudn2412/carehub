-- Category is a shared knowledge taxonomy. Professional field ownership lives
-- on questions and must not be stored or enforced on question_categories.

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid
         AND att.attnum = ANY (con.conkey)
        WHERE con.conrelid = 'question_categories'::regclass
          AND con.contype = 'f'
          AND att.attname = 'professional_field_id'
    LOOP
        EXECUTE format('ALTER TABLE question_categories DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

DROP INDEX IF EXISTS ix_question_categories_professional_field;

ALTER TABLE question_categories
    DROP COLUMN IF EXISTS professional_field_id;
