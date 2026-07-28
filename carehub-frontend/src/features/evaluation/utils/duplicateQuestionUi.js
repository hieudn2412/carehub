export const DUPLICATE_REVIEW_THRESHOLD = 0.88
export const STRONG_DUPLICATE_THRESHOLD = 0.95

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
