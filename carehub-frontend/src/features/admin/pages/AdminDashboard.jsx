import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar.jsx'
import AdminHeader from '../components/AdminHeader.jsx'
import OverviewDashboard from '../../dashboard/components/OverviewDashboard.jsx'
import { adminApi } from '../api/adminApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import { competencyApi } from '../../evaluation/api/examAssignmentApi.js'
import { loadCompetencyOverview } from '../../dashboard/utils/competencyOverview.js'

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

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState({ departmentId: '' })
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [complianceChart, setComplianceChart] = useState([])
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
      .catch(() => setError('Không thể tải danh sách khoa/phòng.'))
  }, [])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    const dateParams = currentYearRange()
    const scopedParams = {
      ...dateParams,
      departmentId: filters.departmentId || undefined,
    }
    const trainingScope = {
      departmentId: filters.departmentId || undefined,
      asOf: dateParams.toDate,
    }
    const [trainingResult, qualityResult, checklistResult, competencyResult] = await Promise.allSettled([
      trainingApi.getTrainingDashboardSummary(trainingScope),
      adminApi.getDashboardFormSummary(scopedParams),
      adminApi.getQualityChecklistDashboard({ ...scopedParams, view: 'FILTERED', page: 0, size: 8 }),
      loadCompetencyOverview(competencyApi.getSummary, scopedParams),
    ])

    const trainingTotals = trainingResult.status === 'fulfilled'
      ? payload(trainingResult.value)?.totals || {}
      : {}
    const trainingTotal = Number(trainingTotals.employeeCount) || 0
    const trainingPassed = Number(trainingTotals.compliantCount) || 0
    const trainingFailed = (Number(trainingTotals.nonCompliantCount) || 0)
      + (Number(trainingTotals.atRiskCount) || 0)
      + (Number(trainingTotals.notConfiguredCount) || 0)
    const competency = competencyResult.status === 'fulfilled' ? competencyResult.value : null
    const quality = qualityResult.status === 'fulfilled' && qualityResult.value ? payload(qualityResult.value)?.responses || {} : null
    const submittedQuality = Number(quality?.submitted) || 0
    const qualityRate = Number(quality?.passRate) || 0
    const qualityPassed = Number(quality?.passed) || 0
    const qualityFailed = (Number(quality?.failedScore) || 0)
      + (Number(quality?.failedCritical) || 0)
    const checklistPage = checklistResult.status === 'fulfilled' && checklistResult.value
      ? payload(checklistResult.value)
      : null
    const checklistItems = Array.isArray(checklistPage)
      ? checklistPage
      : checklistPage?.content || checklistPage?.items || []

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
      quality: quality
        ? {
            total: submittedQuality,
            passed: qualityPassed,
            failed: qualityFailed,
            rate: qualityRate,
            available: true,
            note: `Điểm trung bình ${Number(quality.averageConvertedScore || 0).toFixed(2).replace('.', ',')}/10; kết quả đạt đã áp dụng điểm sàn và điểm liệt.`,
          }
        : emptyDomain('Không thể tải dữ liệu tuân thủ quy trình.'),
    })
    setComplianceChart(checklistItems.map((item) => ({
      id: item.formId,
      name: item.formTitle || item.formCode || `Bảng kiểm ${item.formId}`,
      target: Number(item.targetPercent) || 0,
      actual: Number(item.complianceRate) || 0,
      passed: Number(item.passedCount) || 0,
      total: Number(item.monitoringCount) || 0,
    })))

    if ([trainingResult, qualityResult, checklistResult, competencyResult].every((result) => result.status === 'rejected')) {
      setError('Không thể tải dashboard. Vui lòng kiểm tra kết nối đến máy chủ rồi thử lại.')
    }
    setLoading(false)
  }, [filters.departmentId])

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0)
    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  const domains = {
    training: { ...dashboard.training, path: '/admin/reports/training-dashboard' },
    exams: { ...dashboard.exams, path: '/admin/reports/quality-dashboard' },
    quality: { ...dashboard.quality, path: '/admin/reports/checklist-dashboard' },
  }

  const loadComplianceTrend = useCallback(async (formId) => {
    const response = await adminApi.getQualityChecklistTrend({
      ...currentYearRange(),
      departmentId: filters.departmentId || undefined,
      formId,
      bucket: 'DAY',
    })
    return payload(response)?.items || []
  }, [filters.departmentId])

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={[{ label: 'Dashboard tổng quan' }]} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <OverviewDashboard
              role="admin"
              loading={loading}
              error={error}
              filters={filters}
              departments={departments}
              onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
              onNavigate={navigate}
              domains={domains}
              complianceChart={complianceChart}
              onLoadComplianceTrend={loadComplianceTrend}
            />
          </main>
        </div>
      </div>
    </div>
  )
}
