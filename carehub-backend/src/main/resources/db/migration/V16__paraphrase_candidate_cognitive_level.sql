-- Keep paraphrase candidates aligned with ParaphraseCandidate.cognitiveLevel.
ALTER TABLE paraphrase_candidates
    ADD COLUMN IF NOT EXISTS cognitive_level VARCHAR(48);
