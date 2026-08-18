import { useEffect, useMemo, useState } from 'react'
import {
  ApartmentOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  FileSearchOutlined,
  FilterOutlined,
  LoadingOutlined,
  SearchOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import { adminApi } from '../api/adminApi.js'
import { staffApi } from '../../staff/api/staffApi.js'
import { apiData, apiErrorMessage } from '../../../shared/utils/apiUi.js'
import '../styles/ChecklistQualityDashboardPage.css'

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

const today = localDate()
const yearStart = `${new Date().getFullYear()}-01-01`
const PAGE_SIZES = [10, 20, 50]
const EXPORT_PAGE_SIZE = 100
const submittedAtFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
})

function pageData(response) {
  const data = apiData(response, {})
  return {
    content: Array.isArray(data) ? data : data?.content || data?.items || [],
    page: Number(data?.page) || 0,
    size: Number(data?.size) || 10,
    totalElements: Number(data?.totalElements) || 0,
    totalPages: Number(data?.totalPages) || 0,
  }
}

function pageItems(response) {
  return pageData(response).content
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
    : `${parsed.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

function formatScore(value) {
  const parsed = numberOrNull(value)
  return parsed === null
    ? '—'
    : parsed.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatSubmittedAt(value) {
  if (!value) return 'Chưa cập nhật'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : submittedAtFormatter.format(date)
}

function normalizeDepartment(item) {
  return {
    id: item?.id ?? item?.departmentId,
    name: item?.name ?? item?.departmentName ?? item?.displayName,
    code: item?.departmentCode ?? item?.code,
  }
}

function targetSourceLabel(source) {
  if (source === 'DEPARTMENT') return 'Mục tiêu khoa'
  if (source === 'HOSPITAL') return 'Mục tiêu bệnh viện'
  return 'Mặc định hệ thống'
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function downloadChecklistCsv(rows) {
  const csvRows = [
    ['Mã quy trình', 'Tên quy trình', 'Lượt giám sát', 'Số đạt', 'Số chưa đạt', 'Tỷ lệ tuân thủ', 'Mục tiêu']
      .map(csvCell).join(','),
    ...rows.map((item) => [
      item.formCode,
      item.formTitle,
      item.monitoringCount,
      item.passedCount,
      item.failedCount,
      formatPercent(item.complianceRate),
      formatPercent(item.targetPercent),
    ].map(csvCell).join(',')),
  ]
  const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `chat-luong-cham-soc-${localDate()}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

function ChecklistQualityDashboardPage({ role = 'admin' }) {
  const isAdmin = role === 'admin'
  const isManager = role === 'manager'
  const isUser = role === 'user'
  const [departments, setDepartments] = useState([])
  const [profileDepartment, setProfileDepartment] = useState(null)
  const [departmentId, setDepartmentId] = useState('')
  const [fromDate, setFromDate] = useState(yearStart)
  const [toDate, setToDate] = useState(today)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterOptions, setFilterOptions] = useState({ forms: [], subjects: [], evaluators: [] })
  const [forms, setForms] = useState([])
  const [pageInfo, setPageInfo] = useState({ page: 0, size: 10, totalElements: 0, totalPages: 0 })
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [processId, setProcessId] = useState('')
  const [resultStatus, setResultStatus] = useState('')
  const [subjectUserId, setSubjectUserId] = useState('')
  const [submittedByUserId, setSubmittedByUserId] = useState('')
  const [selectedFormId, setSelectedFormId] = useState('')
  const [trendItems, setTrendItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [trendLoading, setTrendLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [targetModalForm, setTargetModalForm] = useState(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let active = true
    async function loadScope() {
      try {
        if (!isAdmin) {
          const response = await staffApi.getProfile()
          const profile = apiData(response, null)
          if (!active) return
          const normalized = profile?.departmentId
            ? { id: profile.departmentId, name: profile.departmentName || 'Khoa của tôi' }
            : null
          setProfileDepartment(normalized)
          setDepartments(normalized ? [normalized] : [])
          if (isManager && normalized) setDepartmentId(String(normalized.id))
          return
        }
        const response = await adminApi.getDepartments()
        if (active) {
          setDepartments(pageItems(response).map(normalizeDepartment).filter((item) => item.id && item.name))
        }
      } catch (requestError) {
        if (active) setError(apiErrorMessage(requestError))
      }
    }
    loadScope()
    return () => { active = false }
  }, [isAdmin, isManager])

  const activeFilterCount = useMemo(() => [
    search.trim(),
    fromDate !== yearStart,
    toDate !== today,
    isAdmin && departmentId,
    processId,
    resultStatus,
    subjectUserId,
    !isUser && submittedByUserId,
  ].filter(Boolean).length, [
    departmentId, fromDate, isAdmin, isUser, processId, resultStatus,
    search, subjectUserId, submittedByUserId, toDate,
  ])
  const view = activeFilterCount > 0 ? 'FILTERED' : 'LATEST'

  const requestParams = useMemo(() => ({
    view,
    keyword: debouncedSearch || undefined,
    fromDate,
    toDate,
    departmentId: isAdmin ? departmentId || undefined : isManager ? departmentId || undefined : undefined,
    formId: processId || undefined,
    resultStatus: resultStatus || undefined,
    subjectUserId: subjectUserId || undefined,
    submittedByUserId: !isUser && submittedByUserId ? submittedByUserId : undefined,
  }), [
    debouncedSearch, departmentId, fromDate, isAdmin, isManager, isUser,
    processId, resultStatus, subjectUserId, submittedByUserId, toDate, view,
  ])

  useEffect(() => { setPage(0) }, [
    debouncedSearch, departmentId, fromDate, processId, resultStatus,
    subjectUserId, submittedByUserId, toDate, view,
  ])

  useEffect(() => {
    if (isManager && !departmentId) return undefined
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await adminApi.getQualityChecklistDashboard({
          ...requestParams,
          page: view === 'LATEST' ? 0 : page,
          size: view === 'LATEST' ? 1 : size,
        })
        if (!active) return
        const next = pageData(response)
        setForms(next.content)
        setPageInfo(next)
        setSelectedFormId((current) => (
          next.content.some((item) => String(item.formId) === String(current))
            ? current
            : String(next.content[0]?.formId || '')
        ))
      } catch (requestError) {
        if (active) {
          setForms([])
          setPageInfo({ page: 0, size, totalElements: 0, totalPages: 0 })
          setError(apiErrorMessage(requestError))
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [departmentId, isManager, page, reloadKey, requestParams, size, view])

  useEffect(() => {
    if (isManager && !departmentId) return undefined
    let active = true
    adminApi.getQualityChecklistFilterOptions({
      fromDate,
      toDate,
      departmentId: isAdmin ? departmentId || undefined : isManager ? departmentId || undefined : undefined,
    }).then((response) => {
      if (!active) return
      const data = apiData(response, {})
      setFilterOptions({ forms: data.forms || [], subjects: data.subjects || [], evaluators: data.evaluators || [] })
    }).catch((requestError) => {
      if (active) setError(apiErrorMessage(requestError))
    })
    return () => { active = false }
  }, [departmentId, fromDate, isAdmin, isManager, toDate, reloadKey])

  const selectedForm = forms.find((item) => String(item.formId) === String(selectedFormId)) || forms[0] || null

  useEffect(() => {
    if (!selectedForm?.formId) {
      setTrendItems([])
      return undefined
    }
    let active = true
    setTrendLoading(true)
    adminApi.getQualityChecklistTrend({ ...requestParams, view: undefined, keyword: undefined, formId: selectedForm.formId, bucket: 'MONTH' })
      .then((response) => {
        if (active) setTrendItems(apiData(response, {})?.items || [])
      })
      .catch((requestError) => {
        if (active) setError(apiErrorMessage(requestError))
      })
      .finally(() => { if (active) setTrendLoading(false) })
    return () => { active = false }
  }, [requestParams, selectedForm?.formId])

  function resetFilters() {
    setSearch('')
    setFromDate(yearStart)
    setToDate(today)
    if (isAdmin) setDepartmentId('')
    setProcessId('')
    setResultStatus('')
    setSubjectUserId('')
    setSubmittedByUserId('')
  }

  async function handleExport() {
    setExporting(true)
    setError('')
    try {
      const first = await adminApi.getQualityChecklistDashboard({ ...requestParams, page: 0, size: EXPORT_PAGE_SIZE })
      const firstPage = pageData(first)
      const remaining = firstPage.totalPages > 1
        ? await Promise.all(Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
          adminApi.getQualityChecklistDashboard({ ...requestParams, page: index + 1, size: EXPORT_PAGE_SIZE })))
        : []
      downloadChecklistCsv([...firstPage.content, ...remaining.flatMap(pageItems)])
    } catch (requestError) {
      setError(apiErrorMessage(requestError))
    } finally {
      setExporting(false)
    }
  }

  const pageTitle = isUser ? 'Chất lượng chăm sóc cá nhân' : 'Dashboard chất lượng chăm sóc'

  return (
    <AppShell
      title={pageTitle}
      breadcrumbs={isAdmin ? [{ label: 'Dashboard & Báo cáo' }, { label: 'Chất lượng chăm sóc' }] : undefined}
    >
      <div className="checklist-quality-dashboard">
        <section className="checklist-quality-toolbar admin-control-toolbar" aria-label="Công cụ dashboard chất lượng chăm sóc">
          <div className="admin-control-toolbar__main">
            <div className="admin-control-toolbar__controls">
              <div className="checklist-quality-search admin-control-toolbar__search">
                <SearchOutlined />
                <input aria-label="Tìm theo tên hoặc mã quy trình" value={search}
                  onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên hoặc mã quy trình..." />
              </div>
              <button type="button" className={`admin-control-toolbar__filter-trigger${isFilterOpen ? ' is-open' : ''}`}
                aria-controls="checklist-quality-filter-panel" aria-expanded={isFilterOpen}
                onClick={() => setIsFilterOpen((current) => !current)}>
                <FilterOutlined /> Bộ lọc
                {activeFilterCount > 0 && <span className="admin-control-toolbar__filter-count">{activeFilterCount}</span>}
              </button>
              {activeFilterCount > 0 && <button type="button" className="checklist-quality-reset" onClick={resetFilters}>Xóa bộ lọc</button>}
            </div>
            <div className="checklist-quality-toolbar__actions">
              <span className="checklist-quality-toolbar__count"><FileSearchOutlined />
                <strong>{pageInfo.totalElements}</strong> {view === 'LATEST' ? 'quy trình gần nhất' : 'quy trình phù hợp'}
              </span>
              {isAdmin && <button className="checklist-quality-export" disabled={exporting || loading || forms.length === 0}
                onClick={handleExport} type="button">
                {exporting ? <LoadingOutlined spin /> : <UploadOutlined />}
                {exporting ? 'Đang xuất...' : 'Xuất kết quả'}
              </button>}
            </div>
          </div>

          {isFilterOpen && <div id="checklist-quality-filter-panel" className="checklist-quality-filter-panel admin-control-toolbar__panel">
            <DateFilter label="Từ ngày" value={fromDate} max={toDate || undefined} onChange={setFromDate} />
            <DateFilter label="Đến ngày" value={toDate} min={fromDate || undefined} onChange={setToDate} />
            {isAdmin && <SelectFilter label="Khoa/phòng" icon={<ApartmentOutlined />}>
              <SearchableSelect value={departmentId} onChange={setDepartmentId} placeholder="Toàn viện"
                searchPlaceholder="Gõ tên khoa/phòng..." options={[
                  { value: '', label: 'Toàn viện' },
                  ...departments.map((item) => ({ value: item.id, label: item.name, searchText: item.code })),
                ]} />
            </SelectFilter>}
            <label className="checklist-quality-filter"><span>Kết quả</span><div><CheckCircleOutlined />
              <select value={resultStatus} onChange={(event) => setResultStatus(event.target.value)}>
                <option value="">Tất cả kết quả</option><option value="PASSED">Đạt</option>
                <option value="FAILED">Chưa đạt</option><option value="FAILED_SCORE">Chưa đạt điểm sàn</option>
                <option value="FAILED_CRITICAL">Không đạt câu trọng yếu</option>
              </select></div></label>
            <SelectFilter label="Người được đánh giá" icon={<TeamOutlined />}>
              <SearchableSelect value={subjectUserId} onChange={setSubjectUserId} placeholder="Tất cả nhân viên"
                searchPlaceholder="Gõ tên hoặc mã nhân viên..." options={userOptions(filterOptions.subjects, 'Tất cả nhân viên')} />
            </SelectFilter>
            {!isUser && <SelectFilter label="Người thực hiện" icon={<EditOutlined />}>
              <SearchableSelect value={submittedByUserId} onChange={setSubmittedByUserId} placeholder="Tất cả người thực hiện"
                searchPlaceholder="Gõ tên hoặc mã người thực hiện..." options={userOptions(filterOptions.evaluators, 'Tất cả người thực hiện')} />
            </SelectFilter>}
            <SelectFilter label="Quy trình" icon={<FileSearchOutlined />}>
              <SearchableSelect value={processId} onChange={setProcessId} placeholder="Tất cả quy trình"
                searchPlaceholder="Gõ tên hoặc mã quy trình..." options={[
                  { value: '', label: 'Tất cả quy trình' },
                  ...filterOptions.forms.map((item) => ({ value: item.id, label: item.title, description: item.code, searchText: item.code })),
                ]} />
            </SelectFilter>
          </div>}
        </section>

        {error && <div className="checklist-quality-alert"><CloseCircleOutlined /><span>{error}</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Thử lại</button></div>}

        <div className="checklist-quality-workspace">
          <section className="checklist-quality-processes">
            <div className="checklist-quality-section-heading">
              <div><h2>{view === 'LATEST' ? 'Bảng kiểm đã chấm gần nhất' : 'Danh sách bảng kiểm phù hợp'}</h2>
                <p>{view === 'LATEST' ? 'Tính từ đầu năm đến hiện tại.' : 'Số liệu cập nhật theo toàn bộ bộ lọc đang chọn.'}</p></div>
              <span>{pageInfo.totalElements} quy trình</span>
            </div>
            {loading ? <LoadingState /> : forms.length === 0
              ? <EmptyState isUser={isUser} filtered={view === 'FILTERED'} />
              : <div className={`checklist-quality-process-grid${view === 'LATEST' ? ' checklist-quality-process-grid--latest' : ''}`}>
                {forms.map((item) => <ProcessCard key={item.formId} item={item}
                  active={String(selectedForm?.formId) === String(item.formId)}
                  canConfigure={!isUser} onSelect={() => setSelectedFormId(String(item.formId))}
                  onConfigure={() => setTargetModalForm(item)} />)}
              </div>}
            {view === 'FILTERED' && pageInfo.totalPages > 0 && <Pagination page={page} size={size}
              totalElements={pageInfo.totalElements} totalPages={pageInfo.totalPages}
              onPage={setPage} onSize={(nextSize) => { setSize(nextSize); setPage(0) }} />}
          </section>

          {selectedForm ? <section className="checklist-quality-detail">
            <header className="checklist-quality-detail__header">
              <div><span>KẾT QUẢ BẢNG KIỂM ĐANG CHỌN</span><h2>{selectedForm.formTitle}</h2>
                <p>{selectedForm.formCode} · Phiên bản v{selectedForm.versionNumber || '—'}</p></div>
              <span className="checklist-quality-detail__rate">
                {selectedForm.monitoringCount > 0 ? `${formatPercent(selectedForm.complianceRate)} tuân thủ` : 'Chưa có dữ liệu'}
              </span>
            </header>
            <div className="checklist-quality-metrics">
              <Metric icon={<BarChartOutlined />} label="Lượt giám sát" value={selectedForm.monitoringCount} note="Kết quả đã nộp" />
              <Metric icon={<CheckCircleOutlined />} label="Đạt / Tổng" value={`${selectedForm.passedCount}/${selectedForm.monitoringCount}`} note="Tỷ lệ tuân thủ" tone="success" />
              <Metric icon={<CloseCircleOutlined />} label="Chưa đạt" value={selectedForm.failedCount} note="Điểm hoặc câu trọng yếu" tone="danger" />
              <Metric icon={<TeamOutlined />} label="Nhân viên được đánh giá" value={selectedForm.uniqueSubjectCount} note="Nhân viên duy nhất" />
              <Metric icon={<BarChartOutlined />} label={targetSourceLabel(selectedForm.targetSource)} value={formatPercent(selectedForm.targetPercent)} note="Mục tiêu đang áp dụng" />
            </div>
            <div className="checklist-quality-chart-grid">
              <article className="checklist-quality-panel">
                <div className="checklist-quality-panel__heading"><div><h3>Phân bố kết quả</h3><p>Đạt và chưa đạt trong phạm vi hiện tại.</p></div></div>
                <div className="checklist-quality-result-bars">
                  <ResultBar label="Đạt" value={selectedForm.passedCount} total={selectedForm.monitoringCount} tone="success" />
                  <ResultBar label="Chưa đạt" value={selectedForm.failedCount} total={selectedForm.monitoringCount} tone="danger" />
                </div>
              </article>
              <article className="checklist-quality-panel">
                <div className="checklist-quality-panel__heading"><div><h3>Xu hướng tuân thủ</h3><p>Tổng hợp theo thời gian và bộ lọc hiện tại.</p></div></div>
                {trendLoading ? <LoadingState compact /> : <TrendChart items={trendItems} />}
              </article>
            </div>
          </section> : !loading && <section className="checklist-quality-detail checklist-quality-detail--empty">
            <FileSearchOutlined />
            <strong>Chưa có dữ liệu dashboard</strong>
            <span>Hãy điều chỉnh bộ lọc để chọn một bảng kiểm có dữ liệu phù hợp.</span>
          </section>}
        </div>
      </div>

      {targetModalForm && <ComplianceTargetModal form={targetModalForm} isAdmin={isAdmin}
        departments={departments} currentDepartmentId={isAdmin ? departmentId : profileDepartment?.id}
        onClose={() => setTargetModalForm(null)} onSaved={() => { setTargetModalForm(null); setReloadKey((value) => value + 1) }} />}
    </AppShell>
  )
}

function userOptions(items, allLabel) {
  return [{ value: '', label: allLabel }, ...items.map((item) => ({
    value: item.id, label: item.name, description: item.employeeCode, searchText: item.employeeCode,
  }))]
}

function DateFilter({ label, value, min, max, onChange }) {
  return <label className="checklist-quality-filter"><span>{label}</span><div><CalendarOutlined />
    <input type="date" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} />
  </div></label>
}

function SelectFilter({ label, icon, children }) {
  return <label className="checklist-quality-filter"><span>{label}</span><div>{icon}{children}</div></label>
}

function ProcessCard({ item, active, canConfigure, onSelect, onConfigure }) {
  const hasData = Number(item.monitoringCount) > 0
  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect()
    }
  }
  return <article className={`checklist-quality-process-card${active ? ' checklist-quality-process-card--active' : ''}`}
    role="button" tabIndex={0} onClick={onSelect} onKeyDown={handleKeyDown}>
    <div className="checklist-quality-process-card__top">
      <span className="checklist-quality-process-card__code">{item.formCode || `Quy trình #${item.formId}`}</span>
      {canConfigure && <button type="button" onClick={(event) => { event.stopPropagation(); onConfigure() }}>
        <EditOutlined /> Cấu hình mục tiêu
      </button>}
    </div>
    <strong>{item.formTitle || 'Quy trình chưa có tiêu đề'}</strong>
    {hasData && <p className="checklist-quality-process-card__submitted-at">
      <CalendarOutlined />
      <span>Chấm gần nhất:</span>
      <time dateTime={item.lastSubmittedAt || undefined}>{formatSubmittedAt(item.lastSubmittedAt)}</time>
    </p>}
    <dl>
      <div><dt>Lượt giám sát</dt><dd>{item.monitoringCount}</dd></div>
      <div><dt>Đạt / Tổng</dt><dd>{item.passedCount}/{item.monitoringCount}</dd></div>
      <div><dt>Tỷ lệ tuân thủ</dt><dd>{hasData ? formatPercent(item.complianceRate) : 'Chưa có dữ liệu'}</dd></div>
      <div><dt>{targetSourceLabel(item.targetSource)}</dt><dd>{formatPercent(item.targetPercent)}</dd></div>
    </dl>
  </article>
}

function Metric({ icon, label, value, note, tone = 'default' }) {
  return <article className={`checklist-quality-metric checklist-quality-metric--${tone}`}>
    <span className="checklist-quality-metric__icon">{icon}</span>
    <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
  </article>
}

function ResultBar({ label, value, total, tone }) {
  const percent = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0
  return <div className="checklist-quality-result-bar">
    <div><span>{label}</span><strong>{value} lượt · {total > 0 ? formatPercent(percent) : 'Chưa có dữ liệu'}</strong></div>
    <div className="checklist-quality-result-bar__track"><span className={`checklist-quality-result-bar__fill checklist-quality-result-bar__fill--${tone}`} style={{ width: `${percent}%` }} /></div>
  </div>
}

function LoadingState({ compact = false }) {
  return <div className={`checklist-quality-loading${compact ? ' checklist-quality-loading--compact' : ''}`}>
    <LoadingOutlined spin /><span>Đang tải dữ liệu...</span>
  </div>
}

function EmptyState({ isUser, filtered }) {
  return <div className="checklist-quality-empty"><FileSearchOutlined />
    <strong>{isUser && !filtered ? 'Chưa có lượt đánh giá từ bảng kiểm được giao' : 'Chưa có bảng kiểm phù hợp'}</strong>
    <span>{filtered ? 'Hãy điều chỉnh hoặc xóa bộ lọc để xem dữ liệu khác.'
      : isUser ? 'Bạn chỉ thấy số liệu của các bảng kiểm đang được phân công.' : 'Chưa có kết quả đã nộp từ đầu năm đến hiện tại.'}</span>
  </div>
}

function Pagination({ page, size, totalElements, totalPages, onPage, onSize }) {
  return <div className="checklist-quality-pagination">
    <span>Hiển thị {totalElements === 0 ? 0 : page * size + 1}–{Math.min((page + 1) * size, totalElements)} / {totalElements}</span>
    <label>Số dòng <select value={size} onChange={(event) => onSize(Number(event.target.value))}>
      {PAGE_SIZES.map((item) => <option key={item} value={item}>{item}</option>)}
    </select></label>
    <div><button type="button" disabled={page <= 0} onClick={() => onPage(page - 1)} aria-label="Trang trước">‹</button>
      <strong>{page + 1}/{totalPages}</strong>
      <button type="button" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)} aria-label="Trang sau">›</button></div>
  </div>
}

function TrendChart({ items }) {
  const maxSubmitted = Math.max(1, ...items.map((item) => Number(item.submittedCount || 0)))
  if (!items.length) return <div className="checklist-quality-trend-empty"><BarChartOutlined />
    <strong>Chưa có dữ liệu xu hướng</strong><span>Không có kết quả đã nộp trong khoảng thời gian đang lọc.</span></div>
  return <div className="checklist-quality-trend" role="img" aria-label="Xu hướng tuân thủ theo thời gian">
    {items.map((item) => {
      const submitted = Number(item.submittedCount || 0)
      const passed = Number(item.passedCount || 0)
      const passRate = submitted > 0 ? (passed / submitted) * 100 : 0
      return <div className="checklist-quality-trend__item" key={item.period}>
        <div className="checklist-quality-trend__values"><strong>{formatPercent(passRate)}</strong>
          <span>{submitted} lượt · {formatScore(item.averageConvertedScore)} điểm</span></div>
        <div className="checklist-quality-trend__track">
          <span className="checklist-quality-trend__volume" style={{ height: `${Math.max(8, (submitted / maxSubmitted) * 100)}%` }} />
          <span className="checklist-quality-trend__pass" style={{ height: `${Math.max(0, Math.min(100, passRate))}%` }} />
        </div><span className="checklist-quality-trend__period">{item.period}</span>
      </div>
    })}
  </div>
}

function ComplianceTargetModal({ form, isAdmin, departments, currentDepartmentId, onClose, onSaved }) {
  const [config, setConfig] = useState(null)
  const [scope, setScope] = useState(isAdmin && !currentDepartmentId ? 'hospital' : 'department')
  const [departmentId, setDepartmentId] = useState(String(currentDepartmentId || departments[0]?.id || ''))
  const [value, setValue] = useState('80')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    adminApi.getComplianceTargets(form.formId).then((response) => {
      if (active) setConfig(apiData(response, null))
    }).catch((requestError) => {
      if (active) setError(apiErrorMessage(requestError))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [form.formId])

  const directTarget = scope === 'hospital'
    ? config?.hospitalTarget
    : config?.departmentTargets?.find((item) => String(item.departmentId) === String(departmentId))
  const inheritedValue = config?.hospitalTarget?.targetPercent ?? 80

  useEffect(() => {
    if (!config) return
    const target = scope === 'hospital' ? config.hospitalTarget
      : config.departmentTargets?.find((item) => String(item.departmentId) === String(departmentId))
    setValue(String(target?.targetPercent ?? (scope === 'department' ? inheritedValue : 80)))
  }, [config, departmentId, inheritedValue, scope])

  async function save() {
    const parsed = Number(value.replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100 || !/^\d{1,3}(?:[.,]\d{1,2})?$/.test(value.trim())) {
      setError('Mục tiêu phải từ 0 đến 100 và có tối đa hai chữ số thập phân.')
      return
    }
    if (scope === 'department' && !departmentId) {
      setError('Vui lòng chọn khoa/phòng.')
      return
    }
    setSaving(true); setError('')
    const payload = { targetPercent: parsed, lockVersion: directTarget?.lockVersion ?? null }
    try {
      if (scope === 'hospital') await adminApi.updateHospitalComplianceTarget(form.formId, payload)
      else await adminApi.updateDepartmentComplianceTarget(form.formId, departmentId, payload)
      onSaved()
    } catch (requestError) {
      setError(apiErrorMessage(requestError))
    } finally { setSaving(false) }
  }

  async function inheritHospital() {
    if (!directTarget || scope !== 'department') return
    setSaving(true); setError('')
    try {
      await adminApi.deleteDepartmentComplianceTarget(form.formId, departmentId, directTarget.lockVersion)
      onSaved()
    } catch (requestError) {
      setError(apiErrorMessage(requestError))
    } finally { setSaving(false) }
  }

  return <div className="checklist-target-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="target-modal-title">
      <header><div><span>CẤU HÌNH MỤC TIÊU TUÂN THỦ</span><h2 id="target-modal-title">{form.formTitle}</h2>
        <p>{form.formCode} · Mục tiêu theo phần trăm</p></div>
        <button type="button" onClick={onClose} aria-label="Đóng">×</button></header>
      <div className="checklist-target-modal__body">
        {loading ? <LoadingState /> : <>
          {isAdmin && <div className="checklist-target-modal__scope" role="group" aria-label="Cấp mục tiêu">
            <button type="button" className={scope === 'hospital' ? 'is-active' : ''} onClick={() => setScope('hospital')}>Bệnh viện</button>
            <button type="button" className={scope === 'department' ? 'is-active' : ''} onClick={() => setScope('department')}>Khoa/phòng</button>
          </div>}
          {scope === 'department' && <label><span>Khoa/phòng</span><SearchableSelect value={departmentId}
            disabled={!isAdmin} onChange={(next) => setDepartmentId(String(next))} searchPlaceholder="Tìm khoa/phòng..."
            options={departments.map((item) => ({ value: item.id, label: item.name, searchText: item.code }))} /></label>}
          <label><span>Mục tiêu áp dụng</span><div className="checklist-target-modal__input">
            <input type="text" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} aria-label="Mục tiêu tuân thủ" />
            <strong>%</strong></div></label>
          <p className="checklist-target-modal__hint">{directTarget
            ? 'Đang dùng cấu hình riêng ở cấp được chọn.'
            : scope === 'department' ? `Đang kế thừa mục tiêu bệnh viện ${formatPercent(inheritedValue)}.`
              : 'Chưa cấu hình riêng, hệ thống đang dùng mặc định 80,00%.'}</p>
          {error && <div className="checklist-quality-alert"><CloseCircleOutlined /> {error}</div>}
        </>}
      </div>
      <footer>{scope === 'department' && directTarget && <button type="button" className="checklist-target-modal__inherit" disabled={saving} onClick={inheritHospital}>Dùng mục tiêu bệnh viện</button>}
        <span /><button type="button" onClick={onClose}>Hủy</button>
        <button type="button" className="checklist-target-modal__save" disabled={loading || saving} onClick={save}>
          {saving ? <LoadingOutlined spin /> : <CheckCircleOutlined />} {saving ? 'Đang lưu...' : 'Lưu mục tiêu'}
        </button></footer>
    </section>
  </div>
}

export default ChecklistQualityDashboardPage
