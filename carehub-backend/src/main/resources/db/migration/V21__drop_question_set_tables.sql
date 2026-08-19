-- Drop the legacy "question set" (bộ câu hỏi) feature: dead in code and dead in data.
-- Live DB check (2026-08-18): question_sets/question_set_items/question_set_versions/
-- question_set_version_items/question_set_item_snapshots all have 0 rows;
-- question_set_categories has 6 orphaned rows (no set ever referenced them);
-- exam_configs.question_set_id and exam_papers.question_set_id are 0/18 and 0/11 non-null.
-- The frontend route already redirects away from /admin/evaluation/question-sets/*,
-- and ExamPaper.questionSet / ExamConfig.questionSet were the only remaining code
-- references (both @Deprecated / always-null legacy fields), now removed from the
-- entities. Run this AFTER deploying the code that removes QuestionSet* entities and
-- the questionSet field from ExamConfig/ExamPaper, so Hibernate (ddl-auto: update) is
-- no longer touching these tables/columns.

ALTER TABLE IF EXISTS exam_configs DROP COLUMN IF EXISTS question_set_id;
ALTER TABLE IF EXISTS exam_papers DROP COLUMN IF EXISTS question_set_id;

DROP TABLE IF EXISTS question_set_item_snapshots;
DROP TABLE IF EXISTS question_set_version_items;
DROP TABLE IF EXISTS question_set_versions;
DROP TABLE IF EXISTS question_set_items;
DROP TABLE IF EXISTS question_sets;
DROP TABLE IF EXISTS question_set_categories;

DELETE FROM permissions WHERE code = 'QUESTION_SET_MANAGER';
