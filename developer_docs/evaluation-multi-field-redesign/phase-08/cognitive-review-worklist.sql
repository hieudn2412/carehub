-- Phase 8 reviewer worklist (READ-ONLY).
-- Không chạy UPDATE trực tiếp trên database. Reviewer phân loại qua API/UI
-- để giữ audit actor, thời điểm và invalidate đúng snapshot khi sửa lại.

SELECT
    q.id AS question_id,
    q.status,
    q.stem,
    c.code AS category_code,
    c.name AS category_name,
    f.code AS professional_field_code,
    f.name AS professional_field_name,
    q.difficulty AS legacy_difficulty,
    q.source_document AS source_name,
    q.created_at,
    q.created_by
FROM questions q
JOIN question_categories c ON c.id = q.category_id
JOIN professional_fields f ON f.id = q.professional_field_id
WHERE q.status = 'APPROVED'
  AND (q.cognitive_verified_at IS NULL OR q.cognitive_verified_by IS NULL)
ORDER BY f.code, c.code, q.id;

-- Tóm tắt khối lượng reviewer theo lĩnh vực và danh mục.
SELECT
    f.code AS professional_field_code,
    f.name AS professional_field_name,
    c.code AS category_code,
    c.name AS category_name,
    COUNT(*) AS questions_to_review
FROM questions q
JOIN question_categories c ON c.id = q.category_id
JOIN professional_fields f ON f.id = q.professional_field_id
WHERE q.status = 'APPROVED'
  AND (q.cognitive_verified_at IS NULL OR q.cognitive_verified_by IS NULL)
GROUP BY f.id, f.code, f.name, c.id, c.code, c.name
ORDER BY f.code, c.code;

-- Sau khi reviewer hoàn tất, truy vấn này phải trả về 0 dòng.
SELECT COUNT(*) AS remaining_unverified
FROM questions
WHERE status = 'APPROVED'
  AND (cognitive_verified_at IS NULL OR cognitive_verified_by IS NULL);
