-- V33: Thêm cột tab_switch_count để giám sát số lần rời màn hình làm bài (anti-cheat proctoring)
ALTER TABLE exam_attempts
    ADD COLUMN IF NOT EXISTS tab_switch_count INTEGER NOT NULL DEFAULT 0;
