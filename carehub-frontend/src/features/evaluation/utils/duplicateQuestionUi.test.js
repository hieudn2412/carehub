import { describe, expect, it } from 'vitest'
import {
  formatSimilarity,
  hasPotentialDuplicate,
  hasStrongDuplicate,
} from './duplicateQuestionUi.js'

describe('duplicateQuestionUi', () => {
  it('phân biệt đúng ngưỡng nghi vấn và trùng mạnh', () => {
    expect(hasPotentialDuplicate({ duplicateMaxSimilarity: 0.92 })).toBe(false)
    expect(hasPotentialDuplicate({ duplicateMaxSimilarity: 0.93 })).toBe(true)
    expect(hasStrongDuplicate({ duplicateMaxSimilarity: 0.96 })).toBe(false)
    expect(hasStrongDuplicate({ duplicateMaxSimilarity: 0.97 })).toBe(true)
    expect(hasPotentialDuplicate({ duplicateNeedsReview: false, duplicateMaxSimilarity: 1 })).toBe(false)
    expect(hasStrongDuplicate({ strongDuplicate: false, duplicateMaxSimilarity: 1 })).toBe(false)
  })

  it('định dạng độ tương đồng thành phần trăm dễ đọc', () => {
    expect(formatSimilarity(0.884)).toBe('88%')
    expect(formatSimilarity(0.956)).toBe('96%')
    expect(formatSimilarity(null)).toBe('0%')
  })
})
