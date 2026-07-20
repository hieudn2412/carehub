import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExperimentOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  ReadOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import AdminHeader from '../components/AdminHeader.jsx'
import AdminSidebar from '../components/AdminSidebar.jsx'
import Sidebar from '../../staff/components/sidebar.jsx'
import Header from '../../staff/components/Header.jsx'
import { adminApi } from '../api/adminApi.js'
import { staffApi } from '../../staff/api/staffApi.js'
import { competencyApi } from '../../evaluation/api/examAssignmentApi.js'
import { apiData, apiErrorMessage } from '../../evaluation/utils/documentQuestionUi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import '../styles/QualityDashboardPage.css'

const today = new Date().toISOString().slice(0, 10)
const yearStart = `${new Date().getFullYear()}-01-01`

function average(items, field) {
  const values = items
    .map((item) => item?.[field])
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map(Number)
    .filter(Number.isFinite)
  if (!values.length) return null
  return values.reduce((total, value) => total + value, 0) / values.length
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatScore(value) {
  return Number.isFinite(value)
    ? value.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'
}

function formatPercent(value) {
  return Number.isFinite(value)
    ? `${value.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : '—'
}

function QualityDashboardPage({ role = 'admin' }) {
  const isManager = role === 'manager'
  const { showToast } = useToast()
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [fromDate, setFromDate] = useState(yearStart)
  const [toDate, setToDate] = useState(today)
  const [employeeId, setEmployeeId] = useState('all')
  const [status, setStatus] = useState('all')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadScope() {
      setLoading(true)
      try {
        if (isManager) {
          const response = await staffApi.getProfile()
          const profile = apiData(response, null)
          if (!profile?.departmentId) throw new Error('Tài khoản chưa được gán khoa/phòng')
          if (!active) return
          setDepartments([{ id: profile.departmentId, name: profile.departmentName || 'Khoa của tôi' }])
          setDepartmentId(String(profile.departmentId))
          return
        }

        const response = await adminApi.getDepartments()
        const items = apiData(response, [])
        if (!active) return
        setDepartments(Array.isArray(items) ? items : [])
      } catch (requestError) {
        if (!active) return
        setError(apiErrorMessage(requestError))
        setLoading(false)
      }
    }

    loadScope()
    return () => { active = false }
  }, [isManager])

  const loadDashboard = useCallback(async () => {
    if (!departmentId) {
      setData(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    try {
      const response = await competencyApi.getSummary({
        departmentId,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      })
      setData(apiData(response, null))
    } catch (requestError) {
      const message = apiErrorMessage(requestError)
      setError(message)
      setData(null)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }, [departmentId, fromDate, showToast, toDate])

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0)
    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  const allItems = useMemo(() => Array.isArray(data?.items) ? data.items : [], [data])
  const employees = useMemo(() => (
    [...allItems].sort((left, right) => String(left.employeeName).localeCompare(String(right.employeeName), 'vi'))
  ), [allItems])
  const filteredItems = useMemo(() => allItems.filter((item) => {
    if (employeeId !== 'all' && String(item.employeeId) !== employeeId) return false
    if (status === 'passed' && !item.isPassed) return false
    if (status === 'failed' && item.isPassed) return false
    return true
  }), [allItems, employeeId, status])

  const passedCount = filteredItems.filter((item) => item.isPassed).length
  const failedCount = filteredItems.length - passedCount
  const passRate = filteredItems.length ? (passedCount / filteredItems.length) * 100 : null
  const theoryAverage = average(filteredItems, 'knowledgeAverage')
  const practicalAverage = average(filteredItems, 'skillAverage')
  const totalAverage = average(filteredItems, 'overallScore')

  const LayoutSidebar = isManager ? Sidebar : AdminSidebar
  const LayoutHeader = isManager ? Header : AdminHeader
  const breadcrumbs = [
    { label: 'Dashboard & Báo cáo' },
    { label: 'Tuân thủ quy trình' },
  ]

  return (
    <div className="dashboard-layout compliance-page">
      <LayoutSidebar />
      <div className="dashboard-layout__content">
        <LayoutHeader
          breadcrumbs={isManager ? undefined : breadcrumbs}
          title={isManager ? 'Dashboard tuân thủ quy trình' : undefined}
        />
        <main className="compliance-dashboard">
          <section className="compliance-hero">
            <div>
              <span className="compliance-eyebrow">CHẤT LƯỢNG CHĂM SÓC</span>
              <h1>Dashboard tuân thủ quy trình</h1>
              <p>Theo dõi điểm lý thuyết, thực hành và kết quả năng lực theo khoa.</p>
            </div>
            {isManager && (
              <div className="compliance-target-box">
                <label htmlFor="department-target">Mục tiêu của khoa</label>
                <div>
                  <input id="department-target" value="" placeholder="—" disabled />
                  <button type="button" disabled>Lưu mục tiêu</button>
                </div>
                <small>Chưa có API đọc và cập nhật mục tiêu riêng của khoa.</small>
              </div>
            )}
          </section>

          <section className="compliance-filters" aria-label="Bộ lọc dashboard tuân thủ">
            <label>
              <span>Khoa/phòng</span>
              <select value={departmentId} onChange={(event) => {
                setDepartmentId(event.target.value)
                setEmployeeId('all')
              }} disabled={isManager}>
                {!isManager && <option value="">Toàn viện (chờ API tổng hợp)</option>}
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Từ ngày</span>
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label>
              <span>Đến ngày</span>
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
            <label>
              <span>Nhân viên</span>
              <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} disabled={!employees.length}>
                <option value="all">Tất cả nhân viên</option>
                {employees.map((employee) => (
                  <option key={employee.employeeId} value={employee.employeeId}>
                    {employee.employeeName} ({employee.employeeCode})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Trạng thái</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">Tất cả kết quả</option>
                <option value="passed">Đạt</option>
                <option value="failed">Chưa đạt</option>
              </select>
            </label>
            <label className="compliance-filter--unavailable">
              <span>Quy trình</span>
              <select disabled><option>Chưa có API lọc</option></select>
            </label>
            <label className="compliance-filter--unavailable">
              <span>Lĩnh vực chuyên môn</span>
              <select disabled><option>Chưa có API lọc</option></select>
            </label>
          </section>

          {!departmentId && !isManager && (
            <div className="compliance-notice"><InfoCircleOutlined /> Backend chưa có endpoint tổng hợp toàn viện. Hãy chọn một khoa để xem dữ liệu hiện có.</div>
          )}
          {error && <div className="compliance-notice compliance-notice--error"><InfoCircleOutlined /> {error}</div>}

          {loading ? (
            <div className="compliance-loading"><LoadingOutlined spin /><span>Đang tải dữ liệu tuân thủ...</span></div>
          ) : (
            <>
              <section className="compliance-metrics">
                <MetricCard icon={<ApartmentOutlined />} label="Điểm trung bình khoa" value={formatScore(totalAverage)} suffix="điểm" />
                <MetricCard icon={<TeamOutlined />} label="Nhân viên được đánh giá" value={filteredItems.length || '—'} />
                <MetricCard icon={<CheckCircleOutlined />} label="Số người đạt" value={filteredItems.length ? passedCount : '—'} tone="success" />
                <MetricCard icon={<CloseCircleOutlined />} label="Số người chưa đạt" value={filteredItems.length ? failedCount : '—'} tone="danger" />
                <MetricCard icon={<TrophyOutlined />} label="Tỷ lệ đạt" value={formatPercent(passRate)} tone="success" />
                <MetricCard icon={<ReadOutlined />} label="Điểm lý thuyết TB" value={formatScore(theoryAverage)} suffix="điểm" />
                <MetricCard icon={<ExperimentOutlined />} label="Điểm thực hành TB" value={formatScore(practicalAverage)} suffix="điểm" />
                <MetricCard icon={<TrophyOutlined />} label="Điểm tổng TB" value={formatScore(totalAverage)} suffix="điểm" />
              </section>

              <section className="compliance-result-panel">
                <div className="compliance-result-panel__header">
                  <div>
                    <h2>Kết quả theo nhân viên</h2>
                    <p>Dữ liệu lấy từ API tổng hợp năng lực của khoa.</p>
                  </div>
                  <span>{filteredItems.length} kết quả</span>
                </div>
                {!filteredItems.length ? (
                  <div className="compliance-empty">Chưa có dữ liệu phù hợp với phạm vi lọc.</div>
                ) : (
                  <div className="compliance-table-wrap">
                    <table className="compliance-table">
                      <thead><tr><th>Nhân viên</th><th>Lý thuyết</th><th>Thực hành</th><th>Điểm tổng</th><th>Kết quả</th><th>So với mục tiêu khoa</th></tr></thead>
                      <tbody>
                        {filteredItems.map((item) => (
                          <tr key={item.employeeId}>
                            <td><strong>{item.employeeName || '—'}</strong><span>{item.employeeCode || '—'}</span></td>
                            <td>{formatScore(nullableNumber(item.knowledgeAverage))}</td>
                            <td>{formatScore(nullableNumber(item.skillAverage))}</td>
                            <td>{formatScore(nullableNumber(item.overallScore))}</td>
                            <td><span className={`compliance-status compliance-status--${item.isPassed ? 'passed' : 'failed'}`}>{item.isPassed ? 'Đạt' : 'Chưa đạt'}</span></td>
                            <td className="compliance-muted">Chưa có mục tiêu khoa</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value, suffix, tone = 'default' }) {
  return (
    <article className={`compliance-metric compliance-metric--${tone}`}>
      <span className="compliance-metric__icon">{icon}</span>
      <div><span>{label}</span><strong>{value}{value !== '—' && suffix ? ` ${suffix}` : ''}</strong></div>
    </article>
  )
}

export default QualityDashboardPage
