import { describe, expect, it } from 'vitest'
import { allocateDifficultyCounts } from './examDifficulty.js'

describe('allocateDifficultyCounts', () => {
  it('keeps the default 30/50/20 mix for twenty questions', () => {
    expect(allocateDifficultyCounts(20, { easy: 30, medium: 50, hard: 20 }))
      .toEqual({ easy: 6, medium: 10, hard: 4 })
  })

  it('uses largest remainder and gives tied remainder to medium first', () => {
    expect(allocateDifficultyCounts(5, { easy: 30, medium: 50, hard: 20 }))
      .toEqual({ easy: 1, medium: 3, hard: 1 })
    expect(allocateDifficultyCounts(7, { easy: 30, medium: 50, hard: 20 }))
      .toEqual({ easy: 2, medium: 4, hard: 1 })
  })

  it('does not crash while the user is editing an incomplete percentage total', () => {
    expect(allocateDifficultyCounts(30, { easy: '', medium: 50, hard: 20 }))
      .toEqual({ easy: 0, medium: 15, hard: 6 })
    expect(allocateDifficultyCounts(30, { easy: 80, medium: 50, hard: 20 }))
      .toEqual({ easy: 24, medium: 15, hard: 6 })
    expect(allocateDifficultyCounts(30))
      .toEqual({ easy: 0, medium: 0, hard: 0 })
  })
})
