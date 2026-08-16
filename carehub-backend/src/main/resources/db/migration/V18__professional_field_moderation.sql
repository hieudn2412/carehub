ALTER TABLE professional_fields
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(24),
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE professional_fields
SET moderation_status = CASE
    WHEN code LIKE 'CUSTOM_%' AND is_active = false THEN 'PENDING'
    ELSE 'APPROVED'
END
WHERE moderation_status IS NULL;

ALTER TABLE professional_fields
    ALTER COLUMN moderation_status SET DEFAULT 'APPROVED',
    ALTER COLUMN moderation_status SET NOT NULL;
