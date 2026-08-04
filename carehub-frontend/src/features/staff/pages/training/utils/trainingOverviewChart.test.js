import { describe, expect, it } from 'vitest'
import {
  formatChartHours,
  formatChartNumber,
  normalizeChartYears,
  truncateChartLabel,
} from './trainingOverviewChart.js'

describe('training overview chart helpers', () => {
  it('formats decimal hours with the vi-VN locale', () => {
    expect(formatChartNumber(24.5)).toBe('24,5')
    expect(formatChartHours(24.5)).toBe('24,5 giờ')
  })

  it('truncates long axis labels while preserving short labels', () => {
    expect(truncateChartLabel('Hồi sức cấp cứu')).toBe('Hồi sức cấp cứu')
    expect(truncateChartLabel('Lĩnh vực chuyên môn có tên rất dài', 18)).toBe('Lĩnh vực chuyên…')
  })

  it('normalizes, deduplicates and sorts available years', () => {
    expect(normalizeChartYears([2024, '2026', 2024], 2025)).toEqual([2026, 2025, 2024])
  })
})
