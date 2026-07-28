export const EXAM_DIFFICULTY_LEVELS = [
  { key: 'easy', label: 'Dễ' },
  { key: 'medium', label: 'Trung bình' },
  { key: 'hard', label: 'Khó' },
]

export function allocateDifficultyCounts(totalQuestions, percentages) {
  const total = Math.max(0, Number(totalQuestions) || 0)
  const tieOrder = { medium: 0, easy: 1, hard: 2 }
  const shares = EXAM_DIFFICULTY_LEVELS.map(({ key }) => {
    const product = total * (Number(percentages?.[key]) || 0)
    return { key, count: Math.floor(product / 100), remainder: product % 100 }
  })
  const percentageTotal = EXAM_DIFFICULTY_LEVELS
    .reduce((sum, { key }) => sum + (Number(percentages?.[key]) || 0), 0)
  if (percentageTotal !== 100) {
    return Object.fromEntries(shares.map(({ key, count }) => [key, count]))
  }
  const remaining = total - shares.reduce((sum, item) => sum + item.count, 0)
  const ranked = [...shares].sort((left, right) =>
    right.remainder - left.remainder || tieOrder[left.key] - tieOrder[right.key])
  for (let index = 0; index < Math.min(remaining, ranked.length); index += 1) {
    ranked[index].count += 1
  }
  return Object.fromEntries(shares.map(({ key, count }) => [key, count]))
}
