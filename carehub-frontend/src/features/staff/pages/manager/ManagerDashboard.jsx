import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/sidebar.jsx'
import Header from '../../components/Header.jsx'
import OverviewDashboard from '../../../dashboard/components/OverviewDashboard.jsx'
import { staffApi } from '../../api/staffApi.js'
import { trainingApi } from '../../../training/api/trainingApi.js'

function payload(response) {
  return response?.data?.data || {}
}

function unavailable(message) {
  return { total: 0, passed: 0, failed: 0, rate: 0, available: false, emptyMessage: message }
}

function dashboardDateRange(period) {
  if (period === 'all') return {}

  const toDate = new Date()
  const fromDate = new Date(toDate)
  if (period === '30d') fromDate.setDate(fromDate.getDate() - 29)
  if (period === '90d') fromDate.setDate(fromDate.getDate() - 89)
  if (period === 'year') fromDate.setMonth(0, 1)

  return {
    fromDate: formatLocalDate(fromDate),
    toDate: formatLocalDate(toDate),
  }
}

function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ManagerDashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [filters, setFilters] = useState({ departmentId: '', period: '30d', professionalFieldId: '' })
  const [professionalFields, setProfessionalFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [domains, setDomains] = useState({
    training: unavailable('Chưa có dữ liệu giờ đào tạo trong khoa.'),
    exams: unavailable('Chưa có kết quả bài kiểm tra trong khoa.'),
    quality: unavailable('Chưa có kết quả checklist trong khoa.'),
  })

  useEffect(() => {
    Promise.allSettled([staffApi.getProfile(), trainingApi.getRecordOptions()])
      .then(([profileResult, optionResult]) => {
        if (profileResult.status === 'fulfilled') {
          const managerProfile = payload(profileResult.value)
          setProfile(managerProfile)
          setFilters((current) => ({
            ...current,
            departmentId: managerProfile?.departmentId ? String(managerProfile.departmentId) : '',
          }))
          if (!managerProfile?.departmentId) {
            setError('Tài khoản Manager chưa được gán khoa/phòng nên không thể xem dashboard.')
            setLoading(false)
          }
        } else {
          setError('Không thể xác định khoa/phòng của Manager.')
          setLoading(false)
        }
        if (optionResult.status === 'fulfilled') {
          setProfessionalFields(payload(optionResult.value)?.professionalFields || [])
        }
      })
  }, [])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await staffApi.getManagerDashboardOverview({
        ...dashboardDateRange(filters.period),
        allTime: filters.period === 'all' || undefined,
        professionalFieldId: filters.professionalFieldId || undefined,
      })
      const overview = payload(response)
      const training = overview.training || {}
      const theory = overview.theory || {}
      const quality = overview.quality || {}

      if (overview.scope?.departmentId) {
        setProfile((current) => current || {
          departmentId: overview.scope.departmentId,
          departmentName: overview.scope.departmentName,
        })
      }

      setDomains({
        training: {
          total: Number(training.employeeCount) || 0,
          passed: Number(training.compliantCount) || 0,
          failed: Number(training.needsAttentionCount) || 0,
          rate: Number(training.overallComplianceRate) || 0,
          available: true,
          emptyMessage: 'Chưa có nhân viên trong phạm vi đào tạo của khoa.',
          note: `${Number(training.notConfiguredCount) || 0} nhân viên chưa được cấu hình chuẩn đào tạo.`,
          path: '/manager/reports/training-dashboard',
        },
        exams: theory.available
          ? {
              total: Number(theory.gradedAttempts) || 0,
              passed: Number(theory.passedAttempts) || 0,
              failed: Number(theory.failedAttempts) || 0,
              rate: Number(theory.passRate) || 0,
              available: true,
              emptyMessage: 'Chưa có kết quả bài kiểm tra trong phạm vi đang lọc.',
              note: `${Number(theory.notStartedCount) || 0} lượt được phân công chưa bắt đầu.`,
              path: '/manager/reports/quality-dashboard',
            }
          : unavailable('Bạn chưa được cấp quyền xem kết quả bài kiểm tra.'),
        quality: {
          total: Number(quality.submittedCount) || 0,
          passed: Number(quality.passedCount) || 0,
          failed: Number(quality.failedCount) || 0,
          rate: Number(quality.passRate) || 0,
          available: true,
          emptyMessage: 'Chưa có kết quả checklist trong phạm vi đang lọc.',
          note: filters.professionalFieldId
            ? 'Số liệu checklist áp dụng cho toàn khoa trong khoảng thời gian đã chọn.'
            : `Điểm checklist trung bình ${Number(quality.averageConvertedScore || 0).toFixed(2).replace('.', ',')}.`,
          path: '/manager/reports/checklist-dashboard',
        },
      })
    } catch {
      setDomains({
        training: unavailable('Không thể tải dữ liệu giờ đào tạo trong khoa.'),
        exams: unavailable('Không thể tải dữ liệu bài kiểm tra trong khoa.'),
        quality: unavailable('Không thể tải dữ liệu checklist trong khoa.'),
      })
      setError('Không thể tải dashboard của khoa. Vui lòng kiểm tra kết nối máy chủ.')
    } finally {
      setLoading(false)
    }
  }, [filters.period, filters.professionalFieldId])

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0)
    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  const summary = useMemo(() => ({
    total: domains.training.total,
    passed: domains.training.passed,
    failed: domains.training.failed,
    rate: domains.training.rate,
    totalDetail: 'Nhân viên trong khoa',
    passedDetail: 'Đạt chuẩn giờ đào tạo',
    failedDetail: 'Cần chú ý hoặc chưa cấu hình',
    rateDetail: 'Tỷ lệ đạt trong khoa',
  }), [domains])

  const warnings = [
    domains.training.failed > 0 && {
        id: 'training',
        title: 'Nhân sự chưa đạt giờ đào tạo',
        detail: 'Cần theo dõi tiến độ trong khoa',
        value: domains.training.failed,
        tone: 'danger',
        path: '/manager/reports/training-dashboard',
      },
    domains.quality.failed > 0 && {
      id: 'quality',
      title: 'Checklist chưa đạt',
      detail: 'Cần rà soát kết quả thực hành trong khoa',
      value: domains.quality.failed,
      tone: 'danger',
      path: '/manager/reports/checklist-dashboard',
    },
    domains.exams.failed > 0 && {
      id: 'exams',
      title: 'Bài kiểm tra chưa đạt',
      detail: 'Cần rà soát kết quả lý thuyết trong khoa',
      value: domains.exams.failed,
      tone: 'danger',
      path: '/manager/reports/quality-dashboard',
    },
  ].filter(Boolean)

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Dashboard tổng quan" />
        <div className="dashboard-layout__body">
          <OverviewDashboard
            role="manager"
            profile={profile}
            loading={loading}
            error={error}
            filters={filters}
            professionalFields={professionalFields}
            onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
            onNavigate={navigate}
            summary={summary}
            domains={domains}
            visibleDomains={['training', 'exams', 'quality']}
            warnings={warnings}
          />
        </div>
      </div>
    </div>
  )
}
