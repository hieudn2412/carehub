import { describe, expect, it } from 'vitest'
import { currentYearDateRange, isValidDateInput, validateHistoricalDateRange } from './dateRange.js'

describe('dateRange', () => {
  it('creates a range from the beginning of the current year to the reference day', () => {
    expect(currentYearDateRange(new Date(2026, 7, 24))).toEqual({
      fromDate: '2026-01-01',
      toDate: '2026-08-24',
    })
  })

  it('rejects incomplete, impossible, reversed, and future ranges', () => {
    expect(validateHistoricalDateRange('', '2026-08-24', { maxDate: '2026-08-24' }))
      .toBe('Vui lòng chọn Từ ngày.')
    expect(isValidDateInput('2026-02-30')).toBe(false)
    expect(validateHistoricalDateRange('2026-09-01', '2026-08-24', { maxDate: '2026-08-24' }))
      .toBe('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
    expect(validateHistoricalDateRange('2026-01-01', '2026-08-25', { maxDate: '2026-08-24' }))
      .toBe('Đến ngày không được sau ngày hiện tại.')
  })

  it('accepts a custom historical range', () => {
    expect(validateHistoricalDateRange('2026-02-01', '2026-04-30', { maxDate: '2026-08-24' }))
      .toBe('')
  })
})
