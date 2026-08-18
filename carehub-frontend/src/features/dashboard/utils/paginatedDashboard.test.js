import { describe, expect, it, vi } from 'vitest'
import { loadAllDashboardItems } from './paginatedDashboard.js'

function response(data) {
  return { data: { data } }
}

describe('loadAllDashboardItems', () => {
  it('loads every result page instead of silently limiting dashboard totals to the first page', async () => {
    const requestPage = vi.fn(({ page }) => Promise.resolve(response({
      totalPages: 3,
      content: [{ formId: page + 1 }],
    })))

    const result = await loadAllDashboardItems(requestPage, { view: 'FILTERED' })

    expect(requestPage).toHaveBeenCalledTimes(3)
    expect(requestPage).toHaveBeenNthCalledWith(1, { view: 'FILTERED', page: 0, size: 100 })
    expect(result).toEqual([{ formId: 1 }, { formId: 2 }, { formId: 3 }])
  })
})
