-- Keep question sets aligned with QuestionSet.cognitiveLevel.
ALTER TABLE question_sets
    ADD COLUMN IF NOT EXISTS cognitive_level VARCHAR(48);
