-- Keep the document-question job schema aligned with DocumentQuestionJob.targetCognitiveLevel.
ALTER TABLE document_question_jobs
    ADD COLUMN IF NOT EXISTS target_cognitive_level VARCHAR(48);
