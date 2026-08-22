import { describe, expect, it } from 'vitest'
import { findExactEmployee, mapChecklistPerformance } from './dashboardChecklistPerformance.js'

describe('dashboard checklist performance', () => {
  it('resolves an employee independently with an exact case-insensitive code', () => {
    const users = [
      { id: 10, employeeCode: 'NV01' },
      { id: 11, employeeCode: 'NV010' },
    ]

    expect(findExactEmployee(users, ' nv01 ')).toEqual(users[0])
    expect(findExactEmployee(users, 'NV0')).toBeNull()
  })

  it('aggregates 18/26 from submitted history and excludes unassessed forms', () => {
    const result = mapChecklistPerformance([
      { formId: 1, formTitle: 'Thụt tháo', submittedCount: 14, passedCount: 9,
        failedScoreCount: 3, failedCriticalCount: 2, averageConvertedScore: 7.5,
        passRate: 64.29, targetPercent: 80 },
      { formId: 2, formTitle: 'Thay băng vết thương', submittedCount: 4, passedCount: 3,
        failedScoreCount: 1, failedCriticalCount: 0, averageConvertedScore: 8,
        passRate: 75, targetPercent: 80 },
      { formId: 3, formTitle: 'Tiêm truyền tĩnh mạch', submittedCount: 8, passedCount: 6,
        failedScoreCount: 1, failedCriticalCount: 1, averageConvertedScore: 8.5,
        passRate: 75, targetPercent: 80 },
      { formId: 4, formTitle: 'Chưa chấm', submittedCount: 0, passedCount: 0,
        passRate: 0, targetPercent: 80 },
    ])

    expect(result.totals).toEqual({ total: 26, passed: 18, failed: 8, convertedScoreSum: 205 })
    expect(result.chart).toHaveLength(3)
  })

  it('maps Manager history response fields without changing their meaning', () => {
    const result = mapChecklistPerformance([{
      formId: 5,
      code: 'QT-A',
      title: 'Quy trình A',
      monitoringCount: 3,
      passedCount: 2,
      failedCount: 1,
      complianceRate: 66.67,
      targetPercent: 80,
    }])

    expect(result.totals).toMatchObject({ total: 3, passed: 2, failed: 1 })
    expect(result.chart[0]).toMatchObject({
      name: 'Quy trình A', total: 3, passed: 2, actual: 66.67, target: 80,
    })
  })
})
