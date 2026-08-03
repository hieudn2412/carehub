import { describe, expect, it } from 'vitest'
import {
  formatTrainingDate,
  formatTrainingHours,
  getTrainingStatusLabel,
  getTrainingStatusTone,
} from './trainingRecordFormatters.js'

describe('training record formatters', () => {
  it('formats valid dates in the Vietnamese display format', () => {
    expect(formatTrainingDate('2026-08-03')).toBe('03/08/2026')
  })

  it('returns a placeholder for missing or invalid dates', () => {
    expect(formatTrainingDate(null)).toBe('-')
    expect(formatTrainingDate('not-a-date')).toBe('-')
  })

  it('formats hours and handles missing values', () => {
    expect(formatTrainingHours(1.5)).toBe('1.5h')
    expect(formatTrainingHours(0)).toBe('0h')
    expect(formatTrainingHours(null)).toBe('-')
  })

  it('maps workflow statuses to Vietnamese labels and tones', () => {
    expect(getTrainingStatusLabel('DRAFT')).toBe('Bản nháp')
    expect(getTrainingStatusLabel('SUBMITTED')).toBe('Đã nộp')
    expect(getTrainingStatusLabel('CANCELLED')).toBe('Đã hủy')
    expect(getTrainingStatusLabel('UNKNOWN')).toBe('UNKNOWN')
    expect(getTrainingStatusTone('CANCELLED')).toBe('danger')
    expect(getTrainingStatusTone('DRAFT')).toBe('warning')
  })
})
