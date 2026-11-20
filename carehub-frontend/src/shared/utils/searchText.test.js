import { describe, expect, it } from 'vitest'
import { matchesSearch, normalizeSearchText } from './searchText.js'

describe('Vietnamese search text', () => {
  it.each(['duong', 'DUONG', 'dương', 'DƯƠNG', 'dương', '  duong  ', 'ngoc hieu'])('matches Dương Ngọc Hiếu with %s', (query) => {
    expect(matchesSearch('Dương Ngọc Hiếu', query)).toBe(true)
  })
  it('handles đ, decomposed accents, whitespace and queries containing accents', () => {
    expect(normalizeSearchText(' ĐẶNG\t  DƯƠNG ')).toBe('dang duong')
    expect(matchesSearch('Dang Duong', 'Đặng Dương')).toBe(true)
    expect(matchesSearch('Đặng Dương'.normalize('NFD'), 'dang')).toBe(true)
    expect(matchesSearch('Dương Ngọc Hiếu', 'nguyen')).toBe(false)
  })
  it('preserves punctuation and supports nullable labels and numeric codes', () => {
    expect(normalizeSearchText('  ĐT_01@example.vn ')).toBe('dt_01@example.vn')
    expect(normalizeSearchText(null)).toBe('')
    expect(matchesSearch(undefined, 'duong')).toBe(false)
    expect(matchesSearch(12345, '234')).toBe(true)
    expect(matchesSearch('Dương', '')).toBe(true)
  })
})
