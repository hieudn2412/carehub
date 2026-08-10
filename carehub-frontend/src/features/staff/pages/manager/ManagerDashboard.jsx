import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/sidebar.jsx'
import Header from '../../components/Header.jsx'
import OverviewDashboard from '../../../dashboard/components/OverviewDashboard.jsx'
import { staffApi } from '../../api/staffApi.js'
import { competencyApi } from '../../../evaluation/api/examAssignmentApi.js'
import { loadCompetencyOverview } from '../../../dashboard/utils/competencyOverview.js'

function payload(response) {
  return response?.data?.data || {}
}

function unavailable(message) {
  return { total: 0, passed: 0, failed: 0, rate: 0, available: false, emptyMessage: message }
}

function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function currentYearRange() {
  const today = new Date()
  return { fromDate: `${today.getFullYear()}-01-01`, toDate: formatLocalDate(today) }
}

export default function ManagerDashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [filters, setFilters] = useState({ departmentId: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [complianceChart, setComplianceChart] = useState([])
  const [domains, setDomains] = useState({
    training: unavailable('Chưa có dữ liệu giờ đào tạo trong khoa.'),
    exams: unavailable('Chưa có kết quả bài kiểm tra trong khoa.'),
    quality: unavailable('Chưa có kết quả checklist trong khoa.'),
  })

  useEffect(() => {
    staffApi.getProfile()
      .then((response) => {
        const managerProfile = payload(response)
        setProfile(managerProfile)
        setFilters((current) => ({
          ...current,
          departmentId: managerProfile?.departmentId ? String(managerProfile.departmentId) : '',
        }))
        if (!managerProfile?.departmentId) {
          setError('Tài khoản Manager chưa được gán khoa/phòng nên không thể xem dashboard.')
          setLoading(false)
        }
      })
      .catch(() => {
        setError('Không thể xác định khoa/phòng của Manager.')
        setLoading(false)
      })
  }, [])

  const loadDashboard = useCallback(async () => {
    if (!filters.departmentId) return
    setLoading(true)
    setError('')
    try {
      const dateRange = currentYearRange()
      const scopedParams = { ...dateRange, departmentId: filters.departmentId }
      const [overviewResult, checklistResult, competencyResult] = await Promise.allSettled([
        staffApi.getManagerDashboardOverview({
          ...dateRange,
        }),
        staffApi.getQualityChecklistDashboard({
          ...scopedParams,
          view: 'FILTERED',
          page: 0,
          size: 8,
        }),
        loadCompetencyOverview(competencyApi.getSummary, scopedParams),
      ])
      if (overviewResult.status === 'rejected') throw overviewResult.reason
      const overview = payload(overviewResult.value)
      const checklistPage = checklistResult.status === 'fulfilled'
        ? payload(checklistResult.value)
        : null
      const checklistItems = Array.isArray(checklistPage)
        ? checklistPage
        : checklistPage?.content || checklistPage?.items || []
      const competency = competencyResult.status === 'fulfilled' ? competencyResult.value : null
      const training = overview.training || {}
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
        exams: competency
          ? {
              ...competency,
              available: true,
              emptyMessage: 'Chưa có kết quả năng lực trong khoa.',
              note: 'Điểm năng lực = trung bình điểm lý thuyết và điểm kỹ năng từ đầu năm.',
              path: '/manager/reports/quality-dashboard',
            }
          : unavailable('Không thể tải dữ liệu năng lực chuyên môn trong khoa.'),
        quality: {
          total: Number(quality.submittedCount) || 0,
          passed: Number(quality.passedCount) || 0,
          failed: Number(quality.failedCount) || 0,
          rate: Number(quality.passRate) || 0,
          available: true,
          emptyMessage: 'Chưa có kết quả checklist trong phạm vi đang lọc.',
          note: `Điểm trung bình ${Number(quality.averageConvertedScore || 0).toFixed(2).replace('.', ',')}/10; kết quả đạt đã áp dụng điểm sàn và điểm liệt.`,
          path: '/manager/reports/checklist-dashboard',
        },
      })
      setComplianceChart(checklistItems.map((item) => ({
        id: item.formId,
        name: item.formTitle || item.formCode || `Bảng kiểm ${item.formId}`,
        target: Number(item.targetPercent) || 0,
        actual: Number(item.complianceRate) || 0,
        passed: Number(item.passedCount) || 0,
        total: Number(item.monitoringCount) || 0,
      })))
    } catch {
      setDomains({
        training: unavailable('Không thể tải dữ liệu giờ đào tạo trong khoa.'),
        exams: unavailable('Không thể tải dữ liệu bài kiểm tra trong khoa.'),
        quality: unavailable('Không thể tải dữ liệu checklist trong khoa.'),
      })
      setComplianceChart([])
      setError('Không thể tải dashboard của khoa. Vui lòng kiểm tra kết nối máy chủ.')
    } finally {
      setLoading(false)
    }
  }, [filters.departmentId])

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0)
    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  const loadComplianceTrend = useCallback(async (formId) => {
    const response = await staffApi.getQualityChecklistTrend({
      ...currentYearRange(),
      departmentId: filters.departmentId,
      formId,
      bucket: 'DAY',
    })
    return payload(response)?.items || []
  }, [filters.departmentId])

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
            onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
            onNavigate={navigate}
            domains={domains}
            complianceChart={complianceChart}
            onLoadComplianceTrend={loadComplianceTrend}
            visibleDomains={['training', 'exams', 'quality']}
          />
        </div>
      </div>
    </div>
  )
}
