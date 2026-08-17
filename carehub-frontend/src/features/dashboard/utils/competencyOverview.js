const PAGE_SIZE = 100
const PAGE_BATCH_SIZE = 4

function responseData(response) {
  return response?.data?.data || {}
}

function pageItems(response) {
  const data = responseData(response)
  return Array.isArray(data) ? data : data.items || data.content || []
}

function average(values) {
  const numericValues = values
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(Number)
    .filter(Number.isFinite)
  if (!numericValues.length) return null
  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
}

export async function loadCompetencyOverview(requestPage, params) {
  const firstResponse = await requestPage({ ...params, page: 0, size: PAGE_SIZE })
  const firstData = responseData(firstResponse)
  const totalPages = Math.max(1, Number(firstData.totalPages) || 1)
  const items = [...pageItems(firstResponse)]

  for (let page = 1; page < totalPages; page += PAGE_BATCH_SIZE) {
    const pages = Array.from(
      { length: Math.min(PAGE_BATCH_SIZE, totalPages - page) },
      (_, index) => page + index,
    )
    const responses = await Promise.all(
      pages.map((pageNumber) => requestPage({ ...params, page: pageNumber, size: PAGE_SIZE })),
    )
    responses.forEach((response) => items.push(...pageItems(response)))
  }

  const normalizedEmployeeCode = String(params.keyword || '').trim().toLocaleLowerCase('vi')
  const aggregateItems = normalizedEmployeeCode
    ? items.filter((item) => String(item.employeeCode || '').trim().toLocaleLowerCase('vi') === normalizedEmployeeCode)
    : items
  const total = aggregateItems.length
  const passed = aggregateItems.filter((item) => item.isPassed).length
  const classificationCounts = aggregateItems.reduce((counts, item) => {
    const label = item.levelLabel || item.level || 'Chưa phân loại'
    counts[label] = (counts[label] || 0) + 1
    return counts
  }, {})
  const matchedEmployee = normalizedEmployeeCode ? aggregateItems[0] || null : null

  return {
    total,
    passed,
    failed: Math.max(0, total - passed),
    rate: total ? passed * 100 / total : 0,
    available: true,
    knowledgeAverage: average(aggregateItems.map((item) => item.knowledgeAverage)),
    skillAverage: average(aggregateItems.map((item) => item.skillAverage)),
    overallAverage: average(aggregateItems.map((item) => item.overallScore)),
    targetScore: firstData.targetScore == null ? null : Number(firstData.targetScore),
    classificationCounts,
    matchedEmployeeId: matchedEmployee?.employeeId ?? null,
    fromDate: firstData.fromDate || params.fromDate,
    toDate: firstData.toDate || params.toDate,
  }
}
