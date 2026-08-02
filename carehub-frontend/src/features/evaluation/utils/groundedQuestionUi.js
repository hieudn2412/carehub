export function buildCreateQuestionJobPayload({
  questionsPerChunk,
  categoryId,
  pipelineVersion,
  targetDifficulty,
}) {
  return {
    questionsPerChunk: Math.min(5, Math.max(1, Number(questionsPerChunk) || 1)),
    categoryId: categoryId ? Number(categoryId) : null,
    pipelineVersion,
    targetDifficulty,
  }
}
