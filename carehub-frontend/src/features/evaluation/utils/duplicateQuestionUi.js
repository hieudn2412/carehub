// Chỉ dùng khi backend không trả về cờ boolean. Giữ khớp với validation.duplicate.* ở
// application.yaml — hai ngưỡng này được hiệu chỉnh theo phân bố láng giềng gần nhất.
const DUPLICATE_REVIEW_THRESHOLD = 0.93
const STRONG_DUPLICATE_THRESHOLD = 0.97

export function hasPotentialDuplicate(candidate) {
  if (typeof candidate?.duplicateNeedsReview === 'boolean') {
    return candidate.duplicateNeedsReview
  }
  return Number(candidate?.duplicateMaxSimilarity || 0) >= DUPLICATE_REVIEW_THRESHOLD
}

export function hasStrongDuplicate(candidate) {
  if (typeof candidate?.strongDuplicate === 'boolean') {
    return candidate.strongDuplicate
  }
  return Number(candidate?.duplicateMaxSimilarity || 0) >= STRONG_DUPLICATE_THRESHOLD
}

export function formatSimilarity(value) {
  return `${Math.round(Number(value || 0) * 100)}%`
}
