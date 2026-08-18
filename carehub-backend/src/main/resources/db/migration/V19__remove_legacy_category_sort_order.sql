ALTER TABLE IF EXISTS question_categories
    DROP COLUMN IF EXISTS sort_order;

ALTER TABLE IF EXISTS question_set_categories
    DROP COLUMN IF EXISTS sort_order;
