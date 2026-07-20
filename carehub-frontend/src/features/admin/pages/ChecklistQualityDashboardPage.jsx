import { useEffect, useMemo, useState } from 'react'
import {
  ApartmentOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileSearchOutlined,
  LoadingOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import AdminHeader from '../components/AdminHeader.jsx'
import AdminSidebar from '../components/AdminSidebar.jsx'
import Header from '../../staff/components/Header.jsx'
import Sidebar from '../../staff/components/sidebar.jsx'
import { adminApi } from '../api/adminApi.js'
import { staffApi } from '../../staff/api/staffApi.js'
import { apiData, apiErrorMessage } from '../../evaluation/utils/documentQuestionUi.js'
import '../styles/ChecklistQualityDashboardPage.css'

const today = new Date().toISOString().slice(0, 10)
const yearStart = `${new Date().getFullYear()}-01-01`

function pageItems(response) {
  const data = apiData(response, null)
  if (Array.isArray(data)) return data
  return data?.content || data?.items || []
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatPercent(value) {
  const parsed = numberOrNull(value)
  return parsed === null
    ? '—'
    : `${parsed.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function formatScore(value) {
  const parsed = numberOrNull(value)
  return parsed === null
    ? '—'
    : parsed.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function normalizeDepartment(item) {
  return {
    id: item?.id ?? item?.departmentId,
    name: item?.name ?? item?.departmentName ?? item?.displayName,
  }
}

function ChecklistQualityDashboardPage({ role = 'admin' }) {
  const isManager = role === 'manager'
  const LayoutSidebar = isManager ? Sidebar : AdminSidebar
  const LayoutHeader = isManager ? Header : AdminHeader
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [fromDate, setFromDate] = useState(yearStart)
  const [toDate, setToDate] = useState(today)
  const [search, setSearch] = useState('')
  const [forms, setForms] = useState([])
  const [selectedFormId, setSelectedFormId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadScope() {
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
        if (!active) return
        setDepartments(pageItems(response).map(normalizeDepartment).filter((item) => item.id && item.name))
      } catch (requestError) {
        if (active) setError(apiErrorMessage(requestError))
      }
    }

    loadScope()
    return () => { active = false }
  }, [isManager])

  useEffect(() => {
    if (isManager && !departmentId) return undefined
    let active = true

    async function loadDashboard() {
      setLoading(true)
      setError('')
      try {
        const params = {
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          departmentId: departmentId || undefined,
          page: 0,
          size: 100,
          sort: 'responseCount,desc',
        }
        const response = await adminApi.getDashboardFormPerformance(params)
        if (active) setForms(pageItems(response))
      } catch (requestError) {
        if (!active) return
        setForms([])
        setError(
          isManager && requestError?.response?.status === 403
            ? 'Backend chưa cấp quyền dashboard bảng kiểm cho Manager.'
            : apiErrorMessage(requestError),
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()
    return () => { active = false }
  }, [departmentId, fromDate, isManager, toDate])

  const visibleForms = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi-VN')
    return forms.filter((item) => {
      const matchesSearch = !keyword || [item.formTitle, item.formCode]
        .some((value) => String(value || '').toLocaleLowerCase('vi-VN').includes(keyword))
      return matchesSearch
    })
  }, [forms, search])

  const selectedForm = visibleForms.find((item) => String(item.formId) === String(selectedFormId))
    || visibleForms[0]
    || null
  const effectiveSelectedFormId = selectedForm ? String(selectedForm.formId) : ''
  const passedCount = selectedForm ? Number(selectedForm.passedCount || 0) : 0
  const submittedCount = selectedForm
    ? Number(selectedForm.submittedCount || selectedForm.responseCount || 0)
    : 0
  const failedCount = selectedForm
    ? Math.max(0, submittedCount - passedCount)
    : 0
  const evaluatedProcessCount = forms.filter((item) => Number(item.submittedCount || item.responseCount || 0) > 0).length

  return (
    <div className="dashboard-layout checklist-quality-page">
      <LayoutSidebar />
      <div className="dashboard-layout__content">
        <LayoutHeader
          breadcrumbs={[
            { label: 'Dashboard & Báo cáo' },
            { label: 'Dashboard chất lượng bảng kiểm' },
          ]}
        />

        <main className="checklist-quality-dashboard">
          <section className="checklist-quality-hero">
            <div>
              <span className="checklist-quality-hero__eyebrow">CHẤT LƯỢNG CHĂM SÓC</span>
              <h1>Dashboard chất lượng bảng kiểm</h1>
              <p>Theo dõi riêng từng bảng kiểm và quy trình, không gộp kết quả thành một chỉ số chung.</p>
            </div>
            <div className="checklist-quality-hero__count">
              <FileSearchOutlined />
              <span><strong>{evaluatedProcessCount}</strong> quy trình có đánh giá</span>
            </div>
          </section>

          <section className="checklist-quality-filters" aria-label="Bộ lọc dashboard bảng kiểm">
            <label className="checklist-quality-filter checklist-quality-filter--search">
              <span>Tên bảng kiểm</span>
              <div><SearchOutlined /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc mã..." /></div>
            </label>
            <label className="checklist-quality-filter">
              <span>Từ ngày</span>
              <div><CalendarOutlined /><input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></div>
            </label>
            <label className="checklist-quality-filter">
              <span>Đến ngày</span>
              <div><CalendarOutlined /><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></div>
            </label>
            <label className="checklist-quality-filter">
              <span>Khoa/phòng</span>
              <div><ApartmentOutlined /><select value={departmentId} disabled={isManager} onChange={(event) => setDepartmentId(event.target.value)}>
                {!isManager && <option value="">Toàn viện</option>}
                {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select></div>
            </label>
            <label className="checklist-quality-filter checklist-quality-filter--unavailable">
              <span>Kết quả</span>
              <select disabled><option>Chờ backend hỗ trợ</option></select>
            </label>
            {['Người được đánh giá', 'Người thực hiện', 'Quy trình'].map((label) => (
              <label className="checklist-quality-filter checklist-quality-filter--unavailable" key={label}>
                <span>{label}</span>
                <select disabled><option>Chờ backend hỗ trợ</option></select>
              </label>
            ))}
          </section>

          {error && <div className="checklist-quality-alert"><CloseCircleOutlined /> {error}</div>}

          <section className="checklist-quality-processes">
            <div className="checklist-quality-section-heading">
              <div><h2>Các bảng kiểm đã được đánh giá</h2><p>Chọn một thẻ để xem riêng kết quả của bảng kiểm đó.</p></div>
              <span>{visibleForms.length} bảng kiểm</span>
            </div>

            {loading ? (
              <div className="checklist-quality-loading"><LoadingOutlined spin /><span>Đang tải dữ liệu bảng kiểm...</span></div>
            ) : !visibleForms.length ? (
              <div className="checklist-quality-empty"><FileSearchOutlined /><strong>Chưa có bảng kiểm phù hợp</strong><span>Backend chưa trả về dữ liệu trong phạm vi bộ lọc hiện tại.</span></div>
            ) : (
              <div className="checklist-quality-process-grid">
                {visibleForms.map((item) => {
                  const active = String(item.formId) === effectiveSelectedFormId
                  return (
                    <button type="button" key={item.formId} className={`checklist-quality-process-card${active ? ' checklist-quality-process-card--active' : ''}`} onClick={() => setSelectedFormId(String(item.formId))}>
                      <span className="checklist-quality-process-card__code">{item.formCode || `Bảng kiểm #${item.formId}`}</span>
                      <strong>{item.formTitle || 'Bảng kiểm chưa có tiêu đề'}</strong>
                      <dl>
                        <div><dt>Người được kiểm tra</dt><dd>—</dd></div>
                        <div><dt>Lượt đánh giá</dt><dd>{Number(item.submittedCount || item.responseCount || 0)}</dd></div>
                        <div><dt>Tỷ lệ đạt</dt><dd>{formatPercent(item.passRate)}</dd></div>
                      </dl>
                      <small>Chờ API số người duy nhất</small>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {selectedForm && (
            <section className="checklist-quality-detail">
              <header className="checklist-quality-detail__header">
                <div><span>KẾT QUẢ BẢNG KIỂM ĐANG CHỌN</span><h2>{selectedForm.formTitle}</h2><p>{selectedForm.formCode} · Phiên bản v{selectedForm.currentVersionNumber || '—'}</p></div>
                <span className="checklist-quality-detail__rate">{formatPercent(selectedForm.passRate)} đạt</span>
              </header>

              <div className="checklist-quality-metrics">
                <Metric icon={<TeamOutlined />} label="Người được kiểm tra" value="—" note="Chờ API distinct subject" />
                <Metric icon={<BarChartOutlined />} label="Lượt đánh giá" value={submittedCount} note="Response đã nộp" />
                <Metric icon={<CheckCircleOutlined />} label="Số lượt đạt" value={passedCount} note="Theo kết quả backend" tone="success" />
                <Metric icon={<CloseCircleOutlined />} label="Số lượt chưa đạt" value={failedCount} note="Gồm điểm và tiêu chí trọng yếu" tone="danger" />
                <Metric icon={<BarChartOutlined />} label="Điểm trung bình" value={formatScore(selectedForm.averageConvertedScore)} note="Điểm quy đổi" />
              </div>

              <div className="checklist-quality-chart-grid">
                <article className="checklist-quality-panel">
                  <div className="checklist-quality-panel__heading"><div><h3>Phân bố kết quả</h3><p>Chỉ hiển thị dữ liệu của bảng kiểm đang chọn.</p></div></div>
                  <div className="checklist-quality-result-bars">
                    <ResultBar label="Đạt" value={passedCount} total={passedCount + failedCount} tone="success" />
                    <ResultBar label="Chưa đạt" value={failedCount} total={passedCount + failedCount} tone="danger" />
                  </div>
                </article>
                <article className="checklist-quality-panel checklist-quality-panel--empty">
                  <div className="checklist-quality-panel__heading"><div><h3>Xu hướng kết quả theo thời gian</h3><p>Theo từng bảng kiểm trong khoảng thời gian đã chọn.</p></div></div>
                  <BarChartOutlined />
                  <strong>Chưa có API xu hướng theo từng bảng kiểm</strong>
                  <span>Endpoint hiện tại chỉ trả xu hướng gộp toàn bộ bảng kiểm nên frontend không sử dụng để tránh sai số liệu.</span>
                </article>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

function Metric({ icon, label, value, note, tone = 'default' }) {
  return (
    <article className={`checklist-quality-metric checklist-quality-metric--${tone}`}>
      <span className="checklist-quality-metric__icon">{icon}</span>
      <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    </article>
  )
}

function ResultBar({ label, value, total, tone }) {
  const percent = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0
  return (
    <div className="checklist-quality-result-bar">
      <div><span>{label}</span><strong>{value} lượt · {formatPercent(percent)}</strong></div>
      <div className="checklist-quality-result-bar__track"><span className={`checklist-quality-result-bar__fill checklist-quality-result-bar__fill--${tone}`} style={{ width: `${percent}%` }} /></div>
    </div>
  )
}

export default ChecklistQualityDashboardPage
