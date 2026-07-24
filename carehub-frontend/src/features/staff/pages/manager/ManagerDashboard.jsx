import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/sidebar.jsx'
import Header from '../../components/Header.jsx'
import OverviewDashboard from '../../../dashboard/components/OverviewDashboard.jsx'
import { staffApi } from '../../api/staffApi.js'
import { trainingApi } from '../../../training/api/trainingApi.js'
import { evaluationDashboardApi } from '../../../evaluation/api/evaluationDashboardApi.js'
import { tokenStorage } from '../../../auth/services/tokenStorage.js'
import {
  THEORY_DASHBOARD_PERMISSIONS,
  hasAnyPermission,
} from '../../../auth/utils/authNavigation.js'
import {
  getPermissionsFromAccessToken,
  getRolesFromAccessToken,
} from '../../../auth/utils/jwt.js'

function payload(response) {
  return response?.data?.data || {}
}

function pageTotal(response) {
  return Number(payload(response)?.totalElements) || 0
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
    fromDate: `${fromDate.toISOString().slice(0, 10)}T00:00:00`,
    toDate: `${toDate.toISOString().slice(0, 10)}T23:59:59`,
  }
}

export default function ManagerDashboard() {
  const navigate = useNavigate()
  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const permissions = getPermissionsFromAccessToken(accessToken)
  const canViewTheoryDashboard = hasAnyPermission(
    permissions,
    THEORY_DASHBOARD_PERMISSIONS,
    roles,
  )
  const [profile, setProfile] = useState(null)
  const [filters, setFilters] = useState({ departmentId: '', period: '30d', professionalFieldId: '' })
  const [professionalFields, setProfessionalFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const managerDepartmentId = profile?.departmentId || ''
  const [domains, setDomains] = useState({
    training: unavailable('Chưa có dữ liệu giờ đào tạo trong khoa.'),
    exams: unavailable('Backend chưa có API tổng hợp kiểm tra được giới hạn theo khoa của Manager.'),
    quality: unavailable('Backend chưa có API tổng hợp chất lượng được giới hạn theo khoa của Manager.'),
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
    if (!managerDepartmentId) return
    setLoading(true)
    setError('')
    const asOf = new Date().toISOString().slice(0, 10)
    const pageParams = {
      departmentId: managerDepartmentId,
      professionalFieldId: filters.professionalFieldId || undefined,
      asOf,
      page: 0,
      size: 1,
    }
    const theoryRequest = canViewTheoryDashboard
      ? evaluationDashboardApi.getExamResultsSummary({
          ...dashboardDateRange(filters.period),
          departmentId: managerDepartmentId,
          professionalFieldId: filters.professionalFieldId || undefined,
        })
      : Promise.resolve(null)
    const [allResult, passedResult, failedResult, riskResult, theoryResult] = await Promise.allSettled([
      trainingApi.getEmployeeTrainingStatuses(pageParams),
      trainingApi.getEmployeeTrainingStatuses({ ...pageParams, complianceStatus: 'COMPLIANT' }),
      trainingApi.getEmployeeTrainingStatuses({ ...pageParams, complianceStatus: 'NON_COMPLIANT' }),
      trainingApi.getEmployeeTrainingStatuses({ ...pageParams, complianceStatus: 'AT_RISK' }),
      theoryRequest,
    ])

    const total = allResult.status === 'fulfilled' ? pageTotal(allResult.value) : 0
    const passed = passedResult.status === 'fulfilled' ? pageTotal(passedResult.value) : 0
    const failed = (failedResult.status === 'fulfilled' ? pageTotal(failedResult.value) : 0)
      + (riskResult.status === 'fulfilled' ? pageTotal(riskResult.value) : 0)
    const theorySummary = canViewTheoryDashboard && theoryResult.status === 'fulfilled'
      ? payload(theoryResult.value)
      : null
    const theoryTotal = Number(theorySummary?.gradedAttempts) || 0
    const theoryPassed = Number(theorySummary?.passedAttempts) || 0
    const theoryFailed = Number(theorySummary?.failedAttempts) || 0
    const theoryPassRate = Number(theorySummary?.passRate)

    setDomains({
      training: allResult.status === 'fulfilled'
        ? {
            total,
            passed,
            failed,
            rate: total ? passed * 100 / total : 0,
            available: true,
            note: filters.period === 'all'
              ? 'Backend hiện chỉ trả trạng thái đào tạo tại thời điểm hiện tại, chưa có API tổng hợp toàn bộ lịch sử.'
              : 'Backend tự giới hạn theo khoa của Manager; dữ liệu đào tạo là trạng thái tại ngày hiện tại.',
            path: '/manager/reports/training-dashboard',
          }
        : unavailable('Không thể tải dữ liệu giờ đào tạo trong khoa.'),
      exams: {
        ...(theorySummary
          ? {
              total: theoryTotal,
              passed: theoryPassed,
              failed: theoryFailed,
              rate: Number.isFinite(theoryPassRate) ? theoryPassRate * 100 : 0,
              available: true,
              emptyMessage: 'Chưa có kết quả bài test trong phạm vi đang lọc.',
              note: 'Kết quả bài test lý thuyết của nhân viên trong khoa.',
            }
          : unavailable('Không thể tải dữ liệu điểm bài test trong khoa.')),
        path: '/manager/reports/quality-dashboard',
      },
      quality: {
        ...unavailable(filters.professionalFieldId
          ? 'Dashboard thực hành hiện chưa hỗ trợ lọc theo lĩnh vực chuyên môn.'
          : 'Mở dashboard thực hành để xem điểm đánh giá từ các checklist trong khoa.'),
        path: '/manager/reports/checklist-dashboard',
      },
    })

    if (allResult.status === 'rejected') {
      setError('Không thể tải dữ liệu đào tạo của khoa. Vui lòng kiểm tra kết nối máy chủ.')
    }
    setLoading(false)
  }, [canViewTheoryDashboard, filters.period, filters.professionalFieldId, managerDepartmentId])

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
    failedDetail: 'Thiếu giờ hoặc có nguy cơ',
    rateDetail: 'Tỷ lệ đạt trong khoa',
  }), [domains])

  const warnings = domains.training.failed > 0
    ? [{
        id: 'training',
        title: 'Nhân sự chưa đạt giờ đào tạo',
        detail: 'Cần theo dõi tiến độ trong khoa',
        value: domains.training.failed,
        tone: 'danger',
        path: '/manager/reports/training-dashboard',
      }]
    : []

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
            visibleDomains={[
              'training',
              ...(canViewTheoryDashboard ? ['exams'] : []),
            ]}
            warnings={warnings}
          />
        </div>
      </div>
    </div>
  )
}
