const DEFAULT_PAGE_SIZE = 100
const PAGE_BATCH_SIZE = 4

function responseData(response) {
  return response?.data?.data || {}
}

function pageItems(response) {
  const data = responseData(response)
  return Array.isArray(data) ? data : data.items || data.content || []
}

export async function loadAllDashboardItems(requestPage, params, pageSize = DEFAULT_PAGE_SIZE) {
  const firstResponse = await requestPage({ ...params, page: 0, size: pageSize })
  const firstData = responseData(firstResponse)
  const totalPages = Math.max(1, Number(firstData.totalPages) || 1)
  const items = [...pageItems(firstResponse)]

  for (let page = 1; page < totalPages; page += PAGE_BATCH_SIZE) {
    const pages = Array.from(
      { length: Math.min(PAGE_BATCH_SIZE, totalPages - page) },
      (_, index) => page + index,
    )
    const responses = await Promise.all(
      pages.map((pageNumber) => requestPage({ ...params, page: pageNumber, size: pageSize })),
    )
    responses.forEach((response) => items.push(...pageItems(response)))
  }

  return items
}
