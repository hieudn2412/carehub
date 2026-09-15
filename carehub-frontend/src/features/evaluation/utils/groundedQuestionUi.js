export const COGNITIVE_MIX_FIELDS = [
  { key: 'foundation', label: 'Kiến thức nền tảng' },
  { key: 'application', label: 'Áp dụng lâm sàng' },
  { key: 'reasoning', label: 'Tư duy phân tích' },
]

export const DEFAULT_COGNITIVE_MIX = { foundation: 20, application: 50, reasoning: 30 }

export function cognitiveMixTotal(mix) {
  return COGNITIVE_MIX_FIELDS.reduce((sum, field) => sum + (Number(mix?.[field.key]) || 0), 0)
}

export function buildCreateQuestionJobPayload({
  questionsPerChunk,
  categoryId,
  targetCognitiveLevel,
  cognitiveMix,
}) {
  return {
    questionsPerChunk: Math.min(5, Math.max(1, Number(questionsPerChunk) || 1)),
    categoryId: categoryId ? Number(categoryId) : null,
    pipelineVersion: 'GROUNDED_V4',
    targetCognitiveLevel,
    cognitiveMixFoundation: Number(cognitiveMix?.foundation),
    cognitiveMixApplication: Number(cognitiveMix?.application),
    cognitiveMixReasoning: Number(cognitiveMix?.reasoning),
  }
}
