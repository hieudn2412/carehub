import { describe, expect, it } from 'vitest'
import { buildCsv, csvCell, exportFileName } from './tableExport.js'

describe('csvCell', () => {
  it('quotes every cell and escapes embedded quotes', () => {
    expect(csvCell('Đạt')).toBe('"Đạt"')
    expect(csvCell('Khoa "A"')).toBe('"Khoa ""A"""')
  })

  it('turns null and undefined into an empty cell', () => {
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
  })

  it('keeps a comma inside the cell instead of splitting the column', () => {
    expect(csvCell('Tuân thủ quy trình, quy định')).toBe('"Tuân thủ quy trình, quy định"')
  })
})

describe('buildCsv', () => {
  it('writes the header row first and one line per row', () => {
    expect(buildCsv(['Mã', 'Tên'], [['NV01', 'Trần A'], ['NV02', 'Lê B']]))
      .toBe('"Mã","Tên"\r\n"NV01","Trần A"\r\n"NV02","Lê B"')
  })

  it('keeps only the header when there is nothing to export', () => {
    expect(buildCsv(['Mã'], [])).toBe('"Mã"')
  })
})

describe('exportFileName', () => {
  it('stamps the local date, not the UTC date', () => {
    const lateEvening = new Date(2026, 7, 20, 23, 30)
    expect(exportFileName('nhan-su-dao-tao', lateEvening)).toBe('nhan-su-dao-tao-2026-08-20.csv')
  })
})
