import { describe, expect, it } from 'vitest'
import { wrapChartLabel } from './chartLabel.js'

describe('wrapChartLabel', () => {
  it('keeps a short label on one line', () => {
    expect(wrapChartLabel('Ngoại khoa')).toEqual(['Ngoại khoa'])
  })

  it('breaks on word boundaries, never mid-word', () => {
    expect(wrapChartLabel('Quản lý nguồn lực')).toEqual(['Quản lý', 'nguồn lực'])
  })

  it('truncates with an ellipsis once the line budget runs out', () => {
    const lines = wrapChartLabel('Ứng dụng CNTT và quản lý dữ liệu điều dưỡng')
    expect(lines).toHaveLength(2)
    expect(lines.at(-1).endsWith('…')).toBe(true)
  })

  it('never lets a line exceed the character budget', () => {
    const labels = [
      'Chăm sóc người bệnh truyền nhiễm',
      'Nghiên cứu khoa học & Điều dưỡng dựa vào bằng chứng',
      'Hồi sức – Cấp cứu ban đầu',
      'Phục hồi chức năng',
      'Quản lý nguồn lực',
    ]
    labels.forEach((label) => {
      wrapChartLabel(label).forEach((line) => expect(line.length).toBeLessThanOrEqual(10))
    })
  })

  it('hard-splits a single word longer than one line', () => {
    // Một từ dài không có khoảng trắng vẫn phải bị bó trong bề ngang của cột.
    const lines = wrapChartLabel('Điềudưỡngcơbảnnângcaochuyênsâu')
    lines.forEach((line) => expect(line.length).toBeLessThanOrEqual(10))
    expect(lines.length).toBeLessThanOrEqual(2)
  })

  it('falls back to a placeholder for an empty label', () => {
    expect(wrapChartLabel('')).toEqual(['Chưa xác định'])
    expect(wrapChartLabel(null)).toEqual(['Chưa xác định'])
    expect(wrapChartLabel('   ')).toEqual(['Chưa xác định'])
  })

  it('respects a caller-supplied budget', () => {
    expect(wrapChartLabel('Quản lý nguồn lực', 30, 1)).toEqual(['Quản lý nguồn lực'])
  })
})
