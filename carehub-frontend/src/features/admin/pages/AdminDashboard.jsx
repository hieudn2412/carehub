import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../../shared/components/AppShell.jsx'
import OverviewDashboard from '../../dashboard/components/OverviewDashboard.jsx'
import { adminApi } from '../api/adminApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import { competencyApi } from '../../evaluation/api/examAssignmentApi.js'
import { loadCompetencyOverview } from '../../dashboard/utils/competencyOverview.js'
import { loadAllDashboardItems } from '../../dashboard/utils/paginatedDashboard.js'
import { findExactEmployee, mapChecklistPerformance } from '../../dashboard/utils/dashboardChecklistPerformance.js'

function payload(response) {
  return response?.data?.data || {}
}

function currentYearRange() {
  const today = new Date()
  const format = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return { fromDate: `${today.getFullYear()}-01-01`, toDate: format(today) }
}

const emptyDomain = (message) => ({
  total: 0,
  passed: 0,
  failed: 0,
  rate: 0,
  available: false,
  emptyMessage: message,
})

/**
 * `variant="care-quality"` là màn hình "Chất lượng chăm sóc": mở thẳng phần chi tiết theo
 * bảng kiểm của dashboard, nên chỉ cần dữ liệu bảng kiểm — bỏ qua giờ đào tạo và năng lực.
 */
export default function AdminDashboard({ variant = 'overview' }) {
  const complianceOnly = variant === 'care-quality'
  const navigate = useNavigate()
  const dashboardRequestId = useRef(0)
  const [filters, setFilters] = useState(() => ({
    departmentId: '',
    employeeCode: '',
    content: 'all',
    ...currentYearRange(),
  }))
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [departmentsError, setDepartmentsError] = useState('')
  const [complianceChart, setComplianceChart] = useState([])
  const [filteredEmployeeId, setFilteredEmployeeId] = useState()
  const [dashboard, setDashboard] = useState({
    training: emptyDomain('Chưa có dữ liệu giờ đào tạo.'),
    exams: emptyDomain('Chưa có dữ liệu bài kiểm tra.'),
    quality: emptyDomain('Chưa có dữ liệu quy trình.'),
  })

  useEffect(() => {
    adminApi.getDepartments()
      .then((response) => {
        const data = payload(response)
        setDepartments(Array.isArray(data) ? data : data.content || [])
      })
      .catch(() => setDepartmentsError('Không thể tải danh sách khoa/phòng.'))
  }, [])

  useEffect(() => () => {
    dashboardRequestId.current += 1
  }, [])

  const loadDashboard = useCallback(async () => {
    const requestId = ++dashboardRequestId.current
    setLoading(true)
    setError('')
    const defaultDates = currentYearRange()
    const dateParams = {
      fromDate: filters.fromDate || defaultDates.fromDate,
      toDate: filters.toDate || defaultDates.toDate,
    }
    if (dateParams.fromDate > dateParams.toDate) {
      setError('Từ ngày không được lớn hơn Đến ngày.')
      setLoading(false)
      return
    }
    const scopedParams = {
      ...dateParams,
      departmentId: filters.departmentId || undefined,
      keyword: filters.employeeCode.trim() || undefined,
    }
    const employeeFilterActive = Boolean(filters.employeeCode.trim())
    const [competencyResult, employeeResult] = await Promise.allSettled([
      complianceOnly
        ? Promise.resolve(null)
        : loadCompetencyOverview(competencyApi.getSummary, scopedParams),
      employeeFilterActive
        ? loadAllDashboardItems(adminApi.getUsers, {
            keyword: filters.employeeCode.trim(),
            departmentId: filters.departmentId || undefined,
          })
        : Promise.resolve([]),
    ])
    const competency = competencyResult.status === 'fulfilled' ? competencyResult.value : null
    if (requestId !== dashboardRequestId.current) return
    const matchedEmployee = employeeResult.status === 'fulfilled'
      ? findExactEmployee(employeeResult.value, filters.employeeCode)
      : null
    const subjectUserId = employeeFilterActive ? (matchedEmployee?.id ?? -1) : undefined
    const employeeNotFound = employeeFilterActive
      && employeeResult.status === 'fulfilled'
      && subjectUserId === -1
    setFilteredEmployeeId(subjectUserId)
    const qualityParams = { ...scopedParams, keyword: undefined, subjectUserId }
    const trainingScope = {
      departmentId: filters.departmentId || undefined,
      employeeId: subjectUserId,
      asOf: dateParams.toDate,
    }
    const [trainingResult, checklistResult] = await Promise.allSettled([
      complianceOnly
        ? Promise.resolve(null)
        : trainingApi.getTrainingDashboardSummary(trainingScope),
      loadAllDashboardItems(
        adminApi.getDashboardFormPerformance,
        qualityParams,
      ),
    ])
    if (requestId !== dashboardRequestId.current) return

    const trainingTotals = trainingResult.status === 'fulfilled'
      ? payload(trainingResult.value)?.totals || {}
      : {}
    const trainingTotal = Number(trainingTotals.employeeCount) || 0
    const trainingPassed = Number(trainingTotals.compliantCount) || 0
    const trainingFailed = (Number(trainingTotals.nonCompliantCount) || 0)
      + (Number(trainingTotals.atRiskCount) || 0)
      + (Number(trainingTotals.notConfiguredCount) || 0)
    const checklistItems = checklistResult.status === 'fulfilled' ? checklistResult.value : []
    const { totals: qualityTotals, chart: qualityChart } = mapChecklistPerformance(checklistItems)
    const qualityAverageScore = qualityTotals.total
      ? qualityTotals.convertedScoreSum / qualityTotals.total
      : 0

    setDashboard({
      training: trainingResult.status === 'fulfilled'
        ? {
            total: trainingTotal,
            passed: trainingPassed,
            failed: trainingFailed,
            rate: trainingTotal ? trainingPassed * 100 / trainingTotal : 0,
            available: true,
            note: 'Tính theo chuẩn giờ đào tạo đang áp dụng cho nhân viên.',
          }
        : emptyDomain('Không thể tải dữ liệu giờ đào tạo từ máy chủ.'),
      exams: competency
        ? {
            ...competency,
            available: true,
            note: 'Điểm năng lực = trung bình điểm lý thuyết và điểm kỹ năng từ đầu năm.',
          }
        : emptyDomain('Không thể tải dữ liệu năng lực chuyên môn từ máy chủ.'),
      quality: checklistResult.status === 'fulfilled'
        ? {
            total: qualityTotals.total,
            passed: qualityTotals.passed,
            failed: qualityTotals.failed,
            rate: qualityTotals.total ? qualityTotals.passed * 100 / qualityTotals.total : 0,
            available: true,
            detail: 'Số lượt checklist đạt / tổng lượt giám sát trong lịch sử đánh giá.',
            note: `Điểm trung bình ${qualityAverageScore.toFixed(2).replace('.', ',')}/10; kết quả đạt đã áp dụng điểm sàn và điểm liệt.`,
          }
        : emptyDomain('Không thể tải dữ liệu tuân thủ quy trình.'),
    })
    setComplianceChart(qualityChart)

    if ([trainingResult, checklistResult, competencyResult].every((result) => result.status === 'rejected')) {
      setError('Không thể tải dashboard. Vui lòng kiểm tra kết nối đến máy chủ rồi thử lại.')
    } else if (employeeFilterActive && employeeResult.status === 'rejected') {
      setError('Không thể xác minh mã nhân viên. Vui lòng thử lại.')
    } else if (employeeNotFound) {
      setError(`Không tìm thấy nhân viên có mã "${filters.employeeCode.trim()}" trong phạm vi đang chọn.`)
    } else {
      const failedDomains = [
        trainingResult.status === 'rejected' && 'giờ đào tạo',
        checklistResult.status === 'rejected' && 'lịch sử bảng kiểm',
        competencyResult.status === 'rejected' && 'năng lực chuyên môn',
      ].filter(Boolean)
      if (failedDomains.length) {
        setError(`Không thể tải dữ liệu ${failedDomains.join(', ')}. Các chỉ số còn lại vẫn được hiển thị.`)
      }
    }
    setLoading(false)
  }, [complianceOnly, filters.departmentId, filters.employeeCode, filters.fromDate, filters.toDate])

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 350)
    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  const domains = {
    training: { ...dashboard.training, path: '/admin/reports/training-dashboard' },
    exams: { ...dashboard.exams, path: '/admin/reports/quality-dashboard' },
    quality: { ...dashboard.quality, path: '/admin/reports/checklist-dashboard' },
  }

  const loadComplianceTrend = useCallback(async (formId) => {
    const defaultDates = currentYearRange()
    const response = await adminApi.getDashboardFormTrend({
      fromDate: filters.fromDate || defaultDates.fromDate,
      toDate: filters.toDate || defaultDates.toDate,
      departmentId: filters.departmentId || undefined,
      subjectUserId: filteredEmployeeId,
      formId,
      bucket: 'DAY',
    })
    return payload(response)?.items || []
  }, [filteredEmployeeId, filters.departmentId, filters.fromDate, filters.toDate])

  return (
    <AppShell
      className="dashboard-layout"
      breadcrumbs={[{ label: complianceOnly ? 'Chất lượng chăm sóc' : 'Dashboard chất lượng chăm sóc' }]}
    >
      <OverviewDashboard
        role="admin"
        complianceOnly={complianceOnly}
        loading={loading}
        error={error || departmentsError}
        filters={filters}
        departments={departments}
        onFilterChange={(key, value) => {
          dashboardRequestId.current += 1
          setFilters((current) => ({ ...current, [key]: value }))
        }}
        onNavigate={navigate}
        domains={domains}
        complianceChart={complianceChart}
        onLoadComplianceTrend={loadComplianceTrend}
      />
    </AppShell>
  )
}
