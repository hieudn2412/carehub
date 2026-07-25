import { useEffect, useMemo, useState } from 'react'
import {
  ApartmentOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
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
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
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
  const [filterOptions, setFilterOptions] = useState({ forms: [], subjects: [], evaluators: [] })
  const [trendItems, setTrendItems] = useState([])
  const [selectedFormId, setSelectedFormId] = useState('')
  const [processId, setProcessId] = useState('')
  const [resultStatus, setResultStatus] = useState('')
  const [subjectUserId, setSubjectUserId] = useState('')
  const [submittedByUserId, setSubmittedByUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [trendLoading, setTrendLoading] = useState(false)
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
          formId: processId || undefined,
          resultStatus: resultStatus || undefined,
          subjectUserId: subjectUserId || undefined,
          submittedByUserId: submittedByUserId || undefined,
          page: 0,
          size: 100,
          sort: 'responseCount,desc',
        }
        const [performanceResponse, optionsResponse] = await Promise.all([
          adminApi.getDashboardFormPerformance(params),
          adminApi.getDashboardFormFilterOptions({
            fromDate: params.fromDate,
            toDate: params.toDate,
            departmentId: params.departmentId,
          }),
        ])
        if (active) {
          const nextForms = pageItems(performanceResponse)
          const nextOptions = apiData(optionsResponse, {})
          setForms(nextForms)
          setFilterOptions({
            forms: nextOptions?.forms || [],
            subjects: nextOptions?.subjects || [],
            evaluators: nextOptions?.evaluators || [],
          })
          setProcessId((current) => (
            !current || nextOptions?.forms?.some((item) => String(item.id) === String(current))
              ? current
              : ''
          ))
          setSubjectUserId((current) => (
            !current || nextOptions?.subjects?.some((item) => String(item.id) === String(current))
              ? current
              : ''
          ))
          setSubmittedByUserId((current) => (
            !current || nextOptions?.evaluators?.some((item) => String(item.id) === String(current))
              ? current
              : ''
          ))
          setSelectedFormId((current) => (
            nextForms.some((item) => String(item.formId) === String(current))
              ? current
              : String(nextForms[0]?.formId || '')
          ))
        }
      } catch (requestError) {
        if (!active) return
        setForms([])
        setError(
          isManager && requestError?.response?.status === 403
            ? 'Tài khoản Manager không có quyền xem dữ liệu ngoài khoa/phòng được phân công.'
            : apiErrorMessage(requestError),
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()
    return () => { active = false }
  }, [
    departmentId,
    fromDate,
    isManager,
    processId,
    resultStatus,
    subjectUserId,
    submittedByUserId,
    toDate,
  ])

  useEffect(() => {
    if (!selectedFormId || (isManager && !departmentId)) {
      return undefined
    }
    let active = true

    async function loadTrend() {
      setTrendLoading(true)
      try {
        const response = await adminApi.getDashboardFormTrend({
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          departmentId: departmentId || undefined,
          formId: selectedFormId,
          resultStatus: resultStatus || undefined,
          subjectUserId: subjectUserId || undefined,
          submittedByUserId: submittedByUserId || undefined,
          bucket: 'MONTH',
        })
        if (active) setTrendItems(apiData(response, {})?.items || [])
      } catch (requestError) {
        if (active) {
          setTrendItems([])
          setError(apiErrorMessage(requestError))
        }
      } finally {
        if (active) setTrendLoading(false)
      }
    }

    loadTrend()
    return () => { active = false }
  }, [
    departmentId,
    fromDate,
    isManager,
    resultStatus,
    selectedFormId,
    subjectUserId,
    submittedByUserId,
    toDate,
  ])

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
          breadcrumbs={isManager ? undefined : [
            { label: 'Dashboard & Báo cáo' },
            { label: 'Dashboard thực hành' },
          ]}
          title={isManager ? 'Dashboard thực hành' : undefined}
        />

        <main className="checklist-quality-dashboard">
          <section className="checklist-quality-hero">
            <div>
              <span className="checklist-quality-hero__eyebrow">ĐIỂM THỰC HÀNH</span>
              <h1>Kết quả đánh giá checklist</h1>
              <p>
                {isManager
                  ? 'Tổng hợp điểm thực hành từ các checklist đã đánh giá trong khoa.'
                  : 'Tổng hợp điểm thực hành từ từng checklist và quy trình trên toàn viện hoặc theo khoa.'}
              </p>
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
              <div><ApartmentOutlined /><SearchableSelect
                value={departmentId}
                disabled={isManager}
                onChange={setDepartmentId}
                placeholder={isManager ? 'Khoa của tôi' : 'Toàn viện'}
                searchPlaceholder="Gõ tên khoa/phòng..."
                options={[
                  ...(!isManager ? [{ value: '', label: 'Toàn viện' }] : []),
                  ...departments.map((item) => ({
                    value: item.id,
                    label: item.name,
                    searchText: item.code || item.departmentCode,
                  })),
                ]}
              /></div>
            </label>
            <label className="checklist-quality-filter">
              <span>Kết quả</span>
              <div><CheckCircleOutlined /><select value={resultStatus} onChange={(event) => setResultStatus(event.target.value)}>
                <option value="">Tất cả kết quả</option>
                <option value="PASSED">Đạt</option>
                <option value="FAILED">Chưa đạt</option>
                <option value="FAILED_SCORE">Chưa đạt điểm sàn</option>
                <option value="FAILED_CRITICAL">Không đạt câu trọng yếu</option>
              </select></div>
            </label>
            <label className="checklist-quality-filter">
              <span>Người được đánh giá</span>
              <div><TeamOutlined /><SearchableSelect
                value={subjectUserId}
                onChange={setSubjectUserId}
                placeholder="Tất cả nhân viên"
                searchPlaceholder="Gõ tên hoặc mã nhân viên..."
                options={[
                  { value: '', label: 'Tất cả nhân viên' },
                  ...filterOptions.subjects.map((item) => ({
                    value: item.id,
                    label: item.name,
                    description: item.employeeCode,
                    searchText: item.employeeCode,
                  })),
                ]}
              /></div>
            </label>
            <label className="checklist-quality-filter">
              <span>Người thực hiện</span>
              <div><EditOutlined /><SearchableSelect
                value={submittedByUserId}
                onChange={setSubmittedByUserId}
                placeholder="Tất cả người thực hiện"
                searchPlaceholder="Gõ tên hoặc mã người thực hiện..."
                options={[
                  { value: '', label: 'Tất cả người thực hiện' },
                  ...filterOptions.evaluators.map((item) => ({
                    value: item.id,
                    label: item.name,
                    description: item.employeeCode,
                    searchText: item.employeeCode,
                  })),
                ]}
              /></div>
            </label>
            <label className="checklist-quality-filter">
              <span>Quy trình</span>
              <div><FileSearchOutlined /><SearchableSelect
                value={processId}
                onChange={setProcessId}
                placeholder="Tất cả quy trình"
                searchPlaceholder="Gõ tên hoặc mã quy trình..."
                options={[
                  { value: '', label: 'Tất cả quy trình' },
                  ...filterOptions.forms.map((item) => ({
                    value: item.id,
                    label: item.title,
                    description: item.code,
                    searchText: item.code,
                  })),
                ]}
              /></div>
            </label>
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
                        <div><dt>Người được kiểm tra</dt><dd>{Number(item.uniqueSubjectCount || 0)}</dd></div>
                        <div><dt>Lượt đánh giá</dt><dd>{Number(item.submittedCount || item.responseCount || 0)}</dd></div>
                        <div><dt>Tỷ lệ đạt</dt><dd>{formatPercent(item.passRate)}</dd></div>
                      </dl>
                      <small>{Number(item.failedCriticalCount || 0)} lượt không đạt tiêu chí trọng yếu</small>
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
                <Metric icon={<TeamOutlined />} label="Người được kiểm tra" value={Number(selectedForm.uniqueSubjectCount || 0)} note="Nhân viên duy nhất" />
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
                <article className="checklist-quality-panel">
                  <div className="checklist-quality-panel__heading">
                    <div>
                      <h3>Xu hướng của bảng kiểm đang chọn</h3>
                      <p>Tổng hợp theo thời gian và toàn bộ bộ lọc phía trên.</p>
                    </div>
                  </div>
                  {trendLoading
                    ? <div className="checklist-quality-loading"><LoadingOutlined spin /><span>Đang tải xu hướng...</span></div>
                    : <TrendChart items={trendItems} />}
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

function TrendChart({ items }) {
  const maxSubmitted = Math.max(1, ...items.map((item) => Number(item.submittedCount || 0)))

  if (!items.length) {
    return (
      <div className="checklist-quality-trend-empty">
        <BarChartOutlined />
        <strong>Chưa có dữ liệu xu hướng</strong>
        <span>Không có response đã nộp trong khoảng thời gian đang lọc.</span>
      </div>
    )
  }

  return (
    <div className="checklist-quality-trend" role="img" aria-label="Xu hướng kết quả bảng kiểm theo thời gian">
      {items.map((item) => {
        const submitted = Number(item.submittedCount || 0)
        const passed = Number(item.passedCount || 0)
        const passRate = submitted > 0 ? (passed / submitted) * 100 : 0
        return (
          <div className="checklist-quality-trend__item" key={item.period}>
            <div className="checklist-quality-trend__values">
              <strong>{formatPercent(passRate)}</strong>
              <span>{submitted} lượt · {formatScore(item.averageConvertedScore)} điểm</span>
            </div>
            <div className="checklist-quality-trend__track">
              <span
                className="checklist-quality-trend__volume"
                style={{ height: `${Math.max(8, (submitted / maxSubmitted) * 100)}%` }}
              />
              <span
                className="checklist-quality-trend__pass"
                style={{ height: `${Math.max(0, Math.min(100, passRate))}%` }}
              />
            </div>
            <span className="checklist-quality-trend__period">{item.period}</span>
          </div>
        )
      })}
    </div>
  )
}

export default ChecklistQualityDashboardPage
