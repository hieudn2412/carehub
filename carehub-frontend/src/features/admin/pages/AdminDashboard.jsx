import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar.jsx'
import AdminHeader from '../components/AdminHeader.jsx'
import OverviewDashboard from '../../dashboard/components/OverviewDashboard.jsx'
import { adminApi } from '../api/adminApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import { evaluationDashboardApi } from '../../evaluation/api/evaluationDashboardApi.js'

function payload(response) {
  return response?.data?.data || {}
}

function resolvePeriod(period) {
  if (period === 'all') return {}
  const toDate = new Date()
  const fromDate = new Date(toDate)
  if (period === 'year') fromDate.setMonth(0, 1)
  else fromDate.setDate(fromDate.getDate() - (period === '90d' ? 89 : 29))
  const format = (date) => date.toISOString().slice(0, 10)
  return { fromDate: format(fromDate), toDate: format(toDate) }
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
  const [filters, setFilters] = useState({ departmentId: '', period: '30d', professionalFieldId: '' })
  const [departments, setDepartments] = useState([])
  const [professionalFields, setProfessionalFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dashboard, setDashboard] = useState({
    totalEmployees: 0,
    training: emptyDomain('Chưa có dữ liệu giờ đào tạo.'),
    exams: emptyDomain('Chưa có dữ liệu bài kiểm tra.'),
    quality: emptyDomain('Chưa có dữ liệu bảng kiểm.'),
  })

  useEffect(() => {
    Promise.allSettled([adminApi.getDepartments(), trainingApi.getRecordOptions()])
      .then(([departmentResult, optionResult]) => {
        if (departmentResult.status === 'fulfilled') {
          const data = payload(departmentResult.value)
          setDepartments(Array.isArray(data) ? data : data.content || [])
        }
        if (optionResult.status === 'fulfilled') {
          setProfessionalFields(payload(optionResult.value)?.professionalFields || [])
        }
      })
  }, [])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    const dateParams = resolvePeriod(filters.period)
    const scopedParams = {
      ...dateParams,
      departmentId: filters.departmentId || undefined,
    }
    const examParams = {
      ...scopedParams,
      professionalFieldId: filters.professionalFieldId || undefined,
    }
    const trainingScope = {
      departmentId: filters.departmentId || undefined,
      professionalFieldId: filters.professionalFieldId || undefined,
      asOf: dateParams.toDate,
    }
    const supportsProfessionalField = !filters.professionalFieldId

    const [overviewResult, trainingResult, examResult, qualityResult] = await Promise.allSettled([
      adminApi.getDashboardOverview(scopedParams),
      trainingApi.getTrainingDashboardSummary(trainingScope),
      evaluationDashboardApi.getExamOverview(examParams),
      supportsProfessionalField ? adminApi.getDashboardFormSummary(scopedParams) : Promise.resolve(null),
    ])

    const overview = overviewResult.status === 'fulfilled' ? payload(overviewResult.value) : {}
    const trainingTotals = trainingResult.status === 'fulfilled'
      ? payload(trainingResult.value)?.totals || {}
      : {}
    const trainingTotal = Number(trainingTotals.employeeCount) || 0
    const trainingPassed = Number(trainingTotals.compliantCount) || 0
    const trainingFailed = (Number(trainingTotals.nonCompliantCount) || 0)
      + (Number(trainingTotals.atRiskCount) || 0)
      + (Number(trainingTotals.notConfiguredCount) || 0)
    const examOverview = examResult.status === 'fulfilled' && examResult.value
      ? payload(examResult.value)
      : null
    const examAttempts = examOverview?.attempts || null
    const quality = qualityResult.status === 'fulfilled' && qualityResult.value ? payload(qualityResult.value)?.responses || {} : null
    const submittedQuality = Number(quality?.submitted) || 0
    const qualityRate = Number(quality?.passRate) || 0
    const qualityPassed = Number(quality?.passed) || 0
    const qualityFailed = (Number(quality?.failedScore) || 0)
      + (Number(quality?.failedCritical) || 0)

    setDashboard({
      totalEmployees: filters.professionalFieldId
        ? trainingTotal
        : (Number(overview?.users?.total) || trainingTotal),
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
      exams: examOverview
        ? {
            total: Number(examOverview.targetCount) || Number(examAttempts?.totalAttempts) || 0,
            passed: Number(examAttempts?.passedAttempts) || 0,
            failed: Number(examAttempts?.failedAttempts) || 0,
            rate: (Number(examAttempts?.passRate) || 0) * 100,
            available: true,
            note: `${Number(examOverview.assignmentCount) || 0} bài kiểm tra · ${Number(examOverview.notStartedCount) || 0} lượt chưa bắt đầu · Điểm trung bình ${Number(examAttempts?.averageScore || 0).toFixed(1).replace('.', ',')}.`,
          }
        : emptyDomain('Không thể tải dữ liệu điểm bài kiểm tra từ máy chủ.'),
      quality: quality
        ? {
            total: submittedQuality,
            passed: qualityPassed,
            failed: qualityFailed,
            rate: qualityRate,
            available: true,
            note: `Điểm chất lượng trung bình ${Number(quality.averageConvertedScore || 0).toFixed(2).replace('.', ',')}.`,
          }
        : emptyDomain(filters.professionalFieldId
          ? 'Backend chưa hỗ trợ lọc kết quả chất lượng theo professionalFieldId.'
          : 'Không thể tải dữ liệu tuân thủ quy trình.'),
    })

    if ([overviewResult, trainingResult, examResult, qualityResult].every((result) => result.status === 'rejected')) {
      setError('Không thể tải dashboard. Vui lòng kiểm tra kết nối đến máy chủ rồi thử lại.')
    }
    setLoading(false)
  }, [filters.departmentId, filters.period, filters.professionalFieldId])

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0)
    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  const summary = useMemo(() => ({
    total: dashboard.totalEmployees,
    passed: dashboard.training.passed,
    failed: dashboard.training.failed,
    rate: dashboard.training.rate,
    totalDetail: filters.departmentId ? 'Trong khoa/phòng đang chọn' : 'Trên toàn viện',
    passedDetail: 'Theo chuẩn giờ đào tạo',
    failedDetail: 'Thiếu giờ hoặc có nguy cơ',
    rateDetail: 'Tỷ lệ đạt chuẩn đào tạo',
  }), [dashboard, filters.departmentId])

  const warnings = useMemo(() => [
    dashboard.training.failed > 0 && { id: 'training', title: 'Nhân viên chưa đạt giờ đào tạo', detail: 'Cần rà soát tiến độ và minh chứng', value: dashboard.training.failed, tone: 'danger', path: '/admin/reports/training-dashboard' },
    dashboard.exams.failed > 0 && { id: 'exams', title: 'Lượt kiểm tra chưa đạt', detail: 'Cần xem kết quả chuyên môn', value: dashboard.exams.failed, tone: 'warning', path: '/admin/reports/quality-dashboard' },
    dashboard.quality.failed > 0 && { id: 'quality', title: 'Bảng kiểm chưa đạt', detail: 'Cần ưu tiên kiểm tra tuân thủ', value: dashboard.quality.failed, tone: 'danger', path: '/admin/reports/checklist-dashboard' },
  ].filter(Boolean), [dashboard])

  const domains = {
    training: { ...dashboard.training, path: '/admin/reports/training-dashboard' },
    exams: { ...dashboard.exams, path: '/admin/reports/quality-dashboard' },
    quality: { ...dashboard.quality, path: '/admin/reports/checklist-dashboard' },
  }

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
              professionalFields={professionalFields}
              onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
              onExport={() => navigate('/admin/reports/export-training')}
              onNavigate={navigate}
              summary={summary}
              domains={domains}
              warnings={warnings}
            />
          </main>
        </div>
      </div>
    </div>
  )
}
