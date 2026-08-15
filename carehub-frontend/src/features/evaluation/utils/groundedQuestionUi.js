export function buildCreateQuestionJobPayload({
  questionsPerChunk,
  categoryId,
  targetCognitiveLevel,
}) {
  return {
    questionsPerChunk: Math.min(5, Math.max(1, Number(questionsPerChunk) || 1)),
    categoryId: categoryId ? Number(categoryId) : null,
    targetCognitiveLevel,
  }
}
