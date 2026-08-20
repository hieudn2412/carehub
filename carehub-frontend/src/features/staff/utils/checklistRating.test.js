import { describe, expect, it } from 'vitest'
import {
  answerLabel,
  indexAnswersByQuestion,
  ratingByScore,
  resolveStepRating,
} from './checklistRating.js'

const step = (baseScore, questionKey = 'q1') => ({ questionKey, baseScore })
const choice = (questionKey, label) => ({ questionKey, value: { label } })

describe('ratingByScore', () => {
  it.each([
    [-1, 'Không thực hiện'],
    [0, 'Thực hiện nhưng không đạt'],
    [1, 'Đạt'],
    [1.2, 'Tốt'],
    [1.5, 'Rất tốt'],
  ])('maps %s to "%s"', (score, label) => {
    expect(ratingByScore(score)?.label).toBe(label)
  })

  it('accepts the scaled decimals the API serialises', () => {
    expect(ratingByScore('1.2000')?.label).toBe('Tốt')
    expect(ratingByScore('-1.0000')?.label).toBe('Không thực hiện')
  })

  it('returns null for a score outside the standard scale', () => {
    expect(ratingByScore(0.5)).toBeNull()
    expect(ratingByScore(null)).toBeNull()
  })
})

describe('answerLabel', () => {
  it('reads the single-choice label', () => {
    expect(answerLabel(choice('q1', 'Đạt'))).toBe('Đạt')
  })

  it('joins multiple-choice labels', () => {
    expect(answerLabel({ value: { labels: ['Đạt', 'Tốt'] } })).toBe('Đạt, Tốt')
  })

  it('returns an empty string for non-choice answers', () => {
    expect(answerLabel({ value: { numberValue: 3 } })).toBe('')
    expect(answerLabel(undefined)).toBe('')
  })
})

describe('resolveStepRating', () => {
  it('shows "Chưa trả lời" instead of reading 0 as a failure', () => {
    expect(resolveStepRating(step(0), undefined)).toEqual({
      label: 'Chưa trả lời',
      tone: 'unanswered',
      answered: false,
    })
  })

  it('prefers the label the assessor actually picked', () => {
    expect(resolveStepRating(step(1), choice('q1', 'Có vệ sinh tay'))).toEqual({
      label: 'Có vệ sinh tay',
      tone: 'passed',
      answered: true,
    })
  })

  it('falls back to the standard scale when the answer carries no label', () => {
    expect(resolveStepRating(step(1.5), { questionKey: 'q1', value: { numberValue: 1.5 } })).toEqual({
      label: 'Rất tốt',
      tone: 'excellent',
      answered: true,
    })
  })

  it('degrades gracefully for a checklist with a custom scale', () => {
    expect(resolveStepRating(step(0.5), { questionKey: 'q1', value: { textValue: 'x' } })).toEqual({
      label: 'Đã ghi nhận',
      tone: 'neutral',
      answered: true,
    })
  })
})

describe('indexAnswersByQuestion', () => {
  it('indexes by string key so UUIDs from either source match', () => {
    const index = indexAnswersByQuestion([choice('q1', 'Đạt'), { questionKey: null }])
    expect(index.size).toBe(1)
    expect(answerLabel(index.get('q1'))).toBe('Đạt')
  })

  it('tolerates a missing answers list', () => {
    expect(indexAnswersByQuestion(undefined).size).toBe(0)
  })
})
