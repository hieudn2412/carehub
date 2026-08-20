-- Dọn rác module Exam: cột/bảng chết từ 2 lần đổi kiến trúc cũ.
-- 1) Pipeline "độ khó" (easy/medium/hard) đã bị gỡ hoàn toàn (xem javadoc ExamConfigService)
--    nhưng để lại 6 cột orphan (không entity field nào map tới) và bảng exam_config_distributions
--    (0 entity tham chiếu, 0 dòng).
-- 2) Chọn câu theo từng lượt thi (PER_ATTEMPT_BALANCED) đã bị khoá cứng về FIXED_PAPER;
--    exam_attempt_questions không bao giờ được ghi (0 dòng, write path là no-op).
-- 3) ExamPaper.professionalField / ExamAssignment.professionalField: @deprecated, chỉ đọc
--    không bao giờ ghi (0/11 và 0/10 non-null).
-- 4) ExamConfig.selectionStrategy: field khai báo nhưng không code nào đọc/ghi (0/18 non-null).
-- Run this AFTER deploying the code that removes the corresponding entity fields, so
-- Hibernate (ddl-auto: update) is no longer touching these tables/columns.

ALTER TABLE IF EXISTS exam_configs DROP COLUMN IF EXISTS easy_percentage;
ALTER TABLE IF EXISTS exam_configs DROP COLUMN IF EXISTS medium_percentage;
ALTER TABLE IF EXISTS exam_configs DROP COLUMN IF EXISTS hard_percentage;
ALTER TABLE IF EXISTS exam_configs DROP COLUMN IF EXISTS selection_strategy;

ALTER TABLE IF EXISTS exam_papers DROP COLUMN IF EXISTS easy_percentage;
ALTER TABLE IF EXISTS exam_papers DROP COLUMN IF EXISTS medium_percentage;
ALTER TABLE IF EXISTS exam_papers DROP COLUMN IF EXISTS hard_percentage;
ALTER TABLE IF EXISTS exam_papers DROP COLUMN IF EXISTS professional_field_id;

ALTER TABLE IF EXISTS exam_assignments DROP COLUMN IF EXISTS professional_field_id;

DROP TABLE IF EXISTS exam_config_distributions;
DROP TABLE IF EXISTS exam_attempt_questions;
