-- Cho phép admin đặt tỷ lệ ba mức nhận thức khi tạo phiên sinh câu hỏi từ tài liệu.
-- Bệnh viện quen gọi ba mức này là dễ / trung bình / khó.
-- NULL nghĩa là không đặt tỷ lệ, giữ nguyên hành vi theo target_cognitive_level.
ALTER TABLE document_question_jobs
    ADD COLUMN IF NOT EXISTS cognitive_mix_foundation  integer,
    ADD COLUMN IF NOT EXISTS cognitive_mix_application integer,
    ADD COLUMN IF NOT EXISTS cognitive_mix_reasoning   integer;

ALTER TABLE document_question_jobs
    DROP CONSTRAINT IF EXISTS ck_document_question_jobs_cognitive_mix;

-- Hoặc bỏ trống cả ba, hoặc điền cả ba và tổng đúng 100.
ALTER TABLE document_question_jobs
    ADD CONSTRAINT ck_document_question_jobs_cognitive_mix CHECK (
        (cognitive_mix_foundation IS NULL
             AND cognitive_mix_application IS NULL
             AND cognitive_mix_reasoning IS NULL)
        OR (cognitive_mix_foundation BETWEEN 0 AND 100
             AND cognitive_mix_application BETWEEN 0 AND 100
             AND cognitive_mix_reasoning BETWEEN 0 AND 100
             AND cognitive_mix_foundation + cognitive_mix_application + cognitive_mix_reasoning = 100)
    );
