-- Phase 8 shadow matrix (READ-ONLY).
-- Sửa CTE requested bên dưới theo ma trận đã được business owner ký.
-- Không tạo exam_config/paper và không thay đổi dữ liệu.

WITH requested(field_code, cognitive_level, required_count) AS (
    VALUES
        ('CC-12', 'FOUNDATION', 3),
        ('CC-12', 'CLINICAL_APPLICATION', 5),
        ('CC-12', 'CLINICAL_REASONING_ANALYSIS', 2),
        ('VT-11', 'FOUNDATION', 3),
        ('VT-11', 'CLINICAL_APPLICATION', 4),
        ('VT-11', 'CLINICAL_REASONING_ANALYSIS', 3)
),
available AS (
    SELECT
        f.code AS field_code,
        q.cognitive_level,
        COUNT(DISTINCT q.id) AS available_count
    FROM questions q
    JOIN professional_fields f ON f.id = q.professional_field_id
    JOIN question_categories c ON c.id = q.category_id
    WHERE q.status = 'APPROVED'
      AND c.status = 'ACTIVE'
      AND f.is_active = TRUE
      AND q.cognitive_level IS NOT NULL
      AND q.cognitive_verified_at IS NOT NULL
      AND q.cognitive_verified_by IS NOT NULL
    GROUP BY f.code, q.cognitive_level
)
SELECT
    r.field_code,
    f.name AS field_name,
    r.cognitive_level,
    r.required_count,
    COALESCE(a.available_count, 0) AS available_count,
    GREATEST(r.required_count - COALESCE(a.available_count, 0), 0) AS shortage,
    CASE WHEN COALESCE(a.available_count, 0) >= r.required_count
         THEN 'READY' ELSE 'SHORTAGE' END AS result
FROM requested r
LEFT JOIN available a
       ON a.field_code = r.field_code
      AND a.cognitive_level = r.cognitive_level
LEFT JOIN professional_fields f ON f.code = r.field_code
ORDER BY r.field_code, r.cognitive_level;

-- Tổng kiểm tra: chỉ READY khi không thiếu ô nào và tổng yêu cầu > 0.
WITH requested(field_code, cognitive_level, required_count) AS (
    VALUES
        ('CC-12', 'FOUNDATION', 3),
        ('CC-12', 'CLINICAL_APPLICATION', 5),
        ('CC-12', 'CLINICAL_REASONING_ANALYSIS', 2),
        ('VT-11', 'FOUNDATION', 3),
        ('VT-11', 'CLINICAL_APPLICATION', 4),
        ('VT-11', 'CLINICAL_REASONING_ANALYSIS', 3)
),
available AS (
    SELECT f.code AS field_code, q.cognitive_level, COUNT(DISTINCT q.id) AS available_count
    FROM questions q
    JOIN professional_fields f ON f.id = q.professional_field_id
    JOIN question_categories c ON c.id = q.category_id
    WHERE q.status = 'APPROVED'
      AND c.status = 'ACTIVE'
      AND f.is_active = TRUE
      AND q.cognitive_level IS NOT NULL
      AND q.cognitive_verified_at IS NOT NULL
      AND q.cognitive_verified_by IS NOT NULL
    GROUP BY f.code, q.cognitive_level
)
SELECT
    SUM(required_count) AS requested_total,
    SUM(COALESCE(available_count, 0)) AS available_total,
    SUM(GREATEST(required_count - COALESCE(available_count, 0), 0)) AS shortage_total
FROM (
    SELECT r.required_count, a.available_count
    FROM requested r
    LEFT JOIN available a
      ON a.field_code = r.field_code
     AND a.cognitive_level = r.cognitive_level
) matrix;
