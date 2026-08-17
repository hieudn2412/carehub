import { describe, expect, it, vi } from 'vitest'
import { loadCompetencyOverview } from './competencyOverview.js'

function response(data) {
  return { data: { data } }
}

describe('loadCompetencyOverview', () => {
  it('aggregates every page and ignores missing scores in score averages', async () => {
    const requestPage = vi.fn(({ page }) => Promise.resolve(response({
      page,
      totalPages: 2,
      totalElements: 3,
      targetScore: 7,
      fromDate: '2026-01-01',
      toDate: '2026-08-10',
      items: page === 0
        ? [
            { employeeId: 20, employeeCode: 'NV020', isPassed: true, knowledgeAverage: 8, skillAverage: 9, overallScore: 8.5 },
            { isPassed: false, knowledgeAverage: 6, skillAverage: null, overallScore: null },
          ]
        : [{ isPassed: true, knowledgeAverage: 7, skillAverage: 7, overallScore: 7 }],
    })))

    const result = await loadCompetencyOverview(requestPage, {
      departmentId: 10,
      fromDate: '2026-01-01',
      toDate: '2026-08-10',
    })

    expect(requestPage).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ total: 3, passed: 2, failed: 1, targetScore: 7, matchedEmployeeId: null })
    expect(result.rate).toBeCloseTo(66.67, 1)
    expect(result.knowledgeAverage).toBe(7)
    expect(result.skillAverage).toBe(8)
    expect(result.overallAverage).toBe(7.75)
  })

  it('uses an exact employee code so every dashboard domain can share one employee scope', async () => {
    const requestPage = vi.fn(() => Promise.resolve(response({
      totalPages: 1,
      totalElements: 2,
      items: [
        { employeeId: 20, employeeCode: 'NV020', isPassed: true, knowledgeAverage: 8, skillAverage: 9, overallScore: 8.5 },
        { employeeId: 21, employeeCode: 'NV0200', isPassed: false, knowledgeAverage: 4, skillAverage: 5, overallScore: 4.5 },
      ],
    })))

    const result = await loadCompetencyOverview(requestPage, { keyword: ' nv020 ' })

    expect(result).toMatchObject({ total: 1, passed: 1, failed: 0, matchedEmployeeId: 20 })
    expect(result.knowledgeAverage).toBe(8)
    expect(result.skillAverage).toBe(9)
  })

  it('returns an empty exact scope when the employee code does not exist', async () => {
    const requestPage = vi.fn(() => Promise.resolve(response({
      totalPages: 1,
      totalElements: 1,
      items: [{ employeeId: 20, employeeCode: 'NV020', isPassed: true }],
    })))

    const result = await loadCompetencyOverview(requestPage, { keyword: 'NV02' })

    expect(result).toMatchObject({ total: 0, passed: 0, failed: 0, rate: 0, matchedEmployeeId: null })
  })
})
