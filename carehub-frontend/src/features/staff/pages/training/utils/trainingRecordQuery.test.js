import { describe, expect, it } from 'vitest'
import {
  buildTrainingAllUrl,
  countActiveFilterGroups,
  isDateRangeValid,
  parseTrainingQuery,
  serializeTrainingQuery,
  toTrainingListApiParams,
} from './trainingRecordQuery.js'

describe('training record query helpers', () => {
  it('parses valid values and ignores invalid ids, dates and status', () => {
    expect(parseTrainingQuery('?q=%20%C4%91%C3%A0o%20&status=submitted&dateFrom=2026-01-01&dateTo=2026-12-31&professionalFieldId=12&activityTypeId=oops&page=3'))
      .toEqual({
        q: 'đào',
        status: 'SUBMITTED',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
        professionalFieldId: '12',
        activityTypeId: '',
        page: 3,
      })
    expect(parseTrainingQuery('?status=unknown&dateFrom=2026-02-30&page=0')).toMatchObject({
      status: '',
      dateFrom: '2026-01-01',
      page: 1,
    })
  })

  it('serializes a compact shareable URL and maps page to the zero-based API', () => {
    const filters = {
      q: '  khóa học  ',
      status: 'DRAFT',
      dateFrom: '2026-01-01',
      dateTo: '2026-03-31',
      professionalFieldId: '7',
      activityTypeId: 4,
      page: 2,
    }
    expect(serializeTrainingQuery(filters).toString())
      .toBe('q=kh%C3%B3a+h%E1%BB%8Dc&status=DRAFT&dateFrom=2026-01-01&dateTo=2026-03-31&professionalFieldId=7&activityTypeId=4&page=2')
    expect(buildTrainingAllUrl(filters)).toContain('/staff/training/all?')
    expect(toTrainingListApiParams(filters, 42, 10)).toEqual({
      page: 1,
      size: 10,
      titleKeyword: 'khóa học',
      workflowStatus: 'DRAFT',
      dateFrom: '2026-01-01',
      dateTo: '2026-03-31',
      professionalFieldId: 7,
      activityTypeId: 4,
      employeeId: 42,
    })
  })

  it('validates date ranges and counts active groups', () => {
    expect(isDateRangeValid('2026-03-01', '2026-03-01')).toBe(true)
    expect(isDateRangeValid('2026-04-01', '2026-03-31')).toBe(false)
    expect(isDateRangeValid('invalid', '')).toBe(false)
    expect(countActiveFilterGroups({
      status: 'SUBMITTED',
      dateFrom: '2026-01-01',
      professionalFieldId: '9',
    })).toBe(3)
  })
})
