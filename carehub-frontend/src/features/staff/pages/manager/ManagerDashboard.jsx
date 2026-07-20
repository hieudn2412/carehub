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

function pageTotal(response) {
  return Number(payload(response)?.totalElements) || 0
}

function unavailable(message) {
  return { total: 0, passed: 0, failed: 0, rate: 0, available: false, emptyMessage: message }
}

export default function ManagerDashboard() {
  const navigate = useNavigate()
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
    const [allResult, passedResult, failedResult, riskResult] = await Promise.allSettled([
      trainingApi.getEmployeeTrainingStatuses(pageParams),
      trainingApi.getEmployeeTrainingStatuses({ ...pageParams, complianceStatus: 'COMPLIANT' }),
      trainingApi.getEmployeeTrainingStatuses({ ...pageParams, complianceStatus: 'NON_COMPLIANT' }),
      trainingApi.getEmployeeTrainingStatuses({ ...pageParams, complianceStatus: 'AT_RISK' }),
    ])

    const total = allResult.status === 'fulfilled' ? pageTotal(allResult.value) : 0
    const passed = passedResult.status === 'fulfilled' ? pageTotal(passedResult.value) : 0
    const failed = (failedResult.status === 'fulfilled' ? pageTotal(failedResult.value) : 0)
      + (riskResult.status === 'fulfilled' ? pageTotal(riskResult.value) : 0)

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
        ...unavailable(filters.professionalFieldId
          ? 'Dashboard bài kiểm tra chưa hỗ trợ lọc theo lĩnh vực chuyên môn.'
          : 'Mở dashboard bài kiểm tra để xem kết quả theo khoa.'),
        path: '/manager/reports/exam-dashboard',
      },
      quality: {
        ...unavailable(filters.professionalFieldId
          ? 'Dashboard tuân thủ hiện chưa hỗ trợ lọc theo lĩnh vực chuyên môn.'
          : 'Mở dashboard tuân thủ để xem điểm lý thuyết, thực hành và điểm tổng của khoa.'),
        path: '/manager/reports/quality-dashboard',
      },
    })

    if (allResult.status === 'rejected') {
      setError('Không thể tải dữ liệu đào tạo của khoa. Vui lòng kiểm tra kết nối máy chủ.')
    }
    setLoading(false)
  }, [filters.period, filters.professionalFieldId, managerDepartmentId])

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
            warnings={warnings}
          />
        </div>
      </div>
    </div>
  )
}
