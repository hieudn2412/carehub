import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../../../shared/components/AppShell.jsx'
import OverviewDashboard from '../../../dashboard/components/OverviewDashboard.jsx'
import { staffApi } from '../../api/staffApi.js'
import { competencyApi } from '../../../evaluation/api/examAssignmentApi.js'
import { trainingApi } from '../../../training/api/trainingApi.js'
import { loadCompetencyOverview } from '../../../dashboard/utils/competencyOverview.js'
import { loadAllDashboardItems } from '../../../dashboard/utils/paginatedDashboard.js'

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
  const dashboardRequestId = useRef(0)
  const [profile, setProfile] = useState(null)
  const [filters, setFilters] = useState(() => ({
    departmentId: '',
    employeeCode: '',
    content: 'all',
    ...currentYearRange(),
  }))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [complianceChart, setComplianceChart] = useState([])
  const [filteredEmployeeId, setFilteredEmployeeId] = useState()
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

  useEffect(() => () => {
    dashboardRequestId.current += 1
  }, [])

  const loadDashboard = useCallback(async () => {
    if (!filters.departmentId) return
    const requestId = ++dashboardRequestId.current
    setLoading(true)
    setError('')
    try {
      const defaultDates = currentYearRange()
      const dateRange = {
        fromDate: filters.fromDate || defaultDates.fromDate,
        toDate: filters.toDate || defaultDates.toDate,
      }
      if (dateRange.fromDate > dateRange.toDate) {
        setError('Từ ngày không được lớn hơn Đến ngày.')
        setLoading(false)
        return
      }
      const scopedParams = {
        ...dateRange,
        departmentId: filters.departmentId,
        keyword: filters.employeeCode.trim() || undefined,
      }
      const [competencyResult] = await Promise.allSettled([
        loadCompetencyOverview(competencyApi.getSummary, scopedParams),
      ])
      const competency = competencyResult.status === 'fulfilled' ? competencyResult.value : null
      if (requestId !== dashboardRequestId.current) return
      const employeeFilterActive = Boolean(filters.employeeCode.trim())
      const subjectUserId = employeeFilterActive ? (competency?.matchedEmployeeId ?? -1) : undefined
      const employeeNotFound = employeeFilterActive
        && competencyResult.status === 'fulfilled'
        && subjectUserId === -1
      setFilteredEmployeeId(subjectUserId)
      const qualityParams = { ...scopedParams, keyword: undefined, subjectUserId }
      const [trainingResult, qualityResult, checklistResult] = await Promise.allSettled([
        trainingApi.getTrainingDashboardSummary({
          departmentId: filters.departmentId,
          employeeId: subjectUserId,
          asOf: dateRange.toDate,
        }),
        staffApi.getManagerQualityHistorySummary({
          fromDate: qualityParams.fromDate,
          toDate: qualityParams.toDate,
          subjectUserId,
        }),
        loadAllDashboardItems(
          staffApi.getQualityChecklistDashboard,
          { ...qualityParams, view: 'FILTERED' },
        ),
      ])
      if (requestId !== dashboardRequestId.current) return
      if ([trainingResult, qualityResult, checklistResult, competencyResult]
        .every((result) => result.status === 'rejected')) throw trainingResult.reason
      const checklistItems = checklistResult.status === 'fulfilled' ? checklistResult.value : []
      const training = trainingResult.status === 'fulfilled'
        ? payload(trainingResult.value)?.totals || {}
        : {}
      const quality = qualityResult.status === 'fulfilled'
        ? payload(qualityResult.value)
        : null

      setDomains({
        training: {
          total: Number(training.employeeCount) || 0,
          passed: Number(training.compliantCount) || 0,
          failed: (Number(training.nonCompliantCount) || 0)
            + (Number(training.atRiskCount) || 0)
            + (Number(training.notConfiguredCount) || 0),
          rate: Number(training.complianceRate) || 0,
          available: trainingResult.status === 'fulfilled',
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
        quality: quality ? {
          total: Number(quality.monitoringCount) || 0,
          passed: Number(quality.passedCount) || 0,
          failed: Number(quality.failedCount) || 0,
          rate: Number(quality.complianceRate) || 0,
          available: qualityResult.status === 'fulfilled',
          emptyMessage: 'Chưa có kết quả checklist trong phạm vi đang lọc.',
          detail: 'Số lượt checklist đạt / tổng lượt checklist đã chấm từ đầu năm.',
          note: `Điểm trung bình ${Number(quality.averageConvertedScore || 0).toFixed(2).replace('.', ',')}/10; kết quả đạt đã áp dụng điểm sàn và điểm liệt.`,
          path: '/manager/reports/checklist-dashboard',
        } : unavailable('Không thể tải dữ liệu checklist trong khoa.'),
      })
      setComplianceChart(checklistItems.map((item) => ({
        id: item.formId,
        name: item.formTitle || item.formCode || `Bảng kiểm ${item.formId}`,
        target: Number(item.targetPercent) || 0,
        actual: Number(item.complianceRate) || 0,
        passed: Number(item.passedCount) || 0,
        total: Number(item.monitoringCount) || 0,
      })))
      if (employeeNotFound) {
        setError(`Không tìm thấy nhân viên có mã "${filters.employeeCode.trim()}" trong khoa của bạn.`)
      }
    } catch {
      if (requestId !== dashboardRequestId.current) return
      setDomains({
        training: unavailable('Không thể tải dữ liệu giờ đào tạo trong khoa.'),
        exams: unavailable('Không thể tải dữ liệu bài kiểm tra trong khoa.'),
        quality: unavailable('Không thể tải dữ liệu checklist trong khoa.'),
      })
      setComplianceChart([])
      setError('Không thể tải dashboard của khoa. Vui lòng kiểm tra kết nối máy chủ.')
    } finally {
      if (requestId === dashboardRequestId.current) setLoading(false)
    }
  }, [filters.departmentId, filters.employeeCode, filters.fromDate, filters.toDate])

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 350)
    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  const loadComplianceTrend = useCallback(async (formId) => {
    const defaultDates = currentYearRange()
    const response = await staffApi.getQualityChecklistTrend({
      fromDate: filters.fromDate || defaultDates.fromDate,
      toDate: filters.toDate || defaultDates.toDate,
      departmentId: filters.departmentId,
      subjectUserId: filteredEmployeeId,
      formId,
      bucket: 'DAY',
    })
    return payload(response)?.items || []
  }, [filteredEmployeeId, filters.departmentId, filters.fromDate, filters.toDate])

  return (
    <AppShell className="dashboard-layout" title="Dashboard tổng quan">
      <OverviewDashboard
        role="manager"
        profile={profile}
        loading={loading}
        error={error}
        filters={filters}
        onFilterChange={(key, value) => {
          dashboardRequestId.current += 1
          setFilters((current) => ({ ...current, [key]: value }))
        }}
        onNavigate={navigate}
        domains={domains}
        complianceChart={complianceChart}
        onLoadComplianceTrend={loadComplianceTrend}
        visibleDomains={['training', 'exams', 'quality']}
      />
    </AppShell>
  )
}
