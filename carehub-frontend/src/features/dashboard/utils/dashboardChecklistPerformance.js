export function findExactEmployee(items, employeeCode, idKey = 'id') {
  const normalizedCode = String(employeeCode || '').trim().toLocaleLowerCase('vi')
  if (!normalizedCode) return null

  const match = items.find((item) => (
    String(item.employeeCode || '').trim().toLocaleLowerCase('vi') === normalizedCode
  )) || null
  if (!match) return null

  return { ...match, id: match[idKey] ?? match.id }
}

export function mapChecklistPerformance(items = []) {
  const assessedItems = items.filter((item) => (
    (Number(item.submittedCount ?? item.monitoringCount) || 0) > 0
  ))
  const totals = assessedItems.reduce((result, item) => {
    const submittedCount = Number(item.submittedCount ?? item.monitoringCount) || 0
    result.total += submittedCount
    result.passed += Number(item.passedCount) || 0
    result.failed += item.failedCount == null
      ? (Number(item.failedScoreCount) || 0) + (Number(item.failedCriticalCount) || 0)
      : Number(item.failedCount) || 0
    result.convertedScoreSum += (Number(item.averageConvertedScore) || 0) * submittedCount
    return result
  }, { total: 0, passed: 0, failed: 0, convertedScoreSum: 0 })

  return {
    totals,
    chart: assessedItems.map((item) => ({
      id: item.formId,
      name: item.formTitle || item.title || item.formCode || item.code || `Bảng kiểm ${item.formId}`,
      target: Number(item.targetPercent) || 0,
      actual: Number(item.passRate ?? item.complianceRate) || 0,
      passed: Number(item.passedCount) || 0,
      total: Number(item.submittedCount ?? item.monitoringCount) || 0,
    })),
  }
}
