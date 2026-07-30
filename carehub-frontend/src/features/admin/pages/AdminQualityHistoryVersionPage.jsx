import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ApartmentOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FilterOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  UserSwitchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import { adminApi } from '../api/adminApi'
import { getChecklistDisplayCode } from '../utils/formCode.js'
import '../styles/AdminQualityHistoryPage.css'

const RESULT_OPTIONS = [
  { value: '', label: 'Tất cả kết quả' },
  { value: 'PASSED', label: 'Đạt' },
  { value: 'FAILED', label: 'Chưa đạt' },
  { value: 'FAILED_SCORE', label: 'Chưa đạt điểm' },
  { value: 'FAILED_CRITICAL', label: 'Không đạt câu trọng yếu' },
]
const PAGE_SIZE_OPTIONS = [10, 20, 50]
const UNBOUNDED_DATE_FROM = '1900-01-01'
const UNBOUNDED_DATE_TO = '2099-12-31'

function getPageContent(response) {
  const data = response?.data?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  return []
}

function getPageTotalPages(response) {
  const totalPages = Number(response?.data?.data?.totalPages)
  return Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1
}

function getPageData(response, fallbackSize = 10) {
  const data = response?.data?.data || {}
  return {
    content: Array.isArray(data.content) ? data.content : [],
    page: Number.isFinite(Number(data.page)) ? Number(data.page) : 0,
    size: Number.isFinite(Number(data.size)) ? Number(data.size) : fallbackSize,
    totalElements: Number.isFinite(Number(data.totalElements)) ? Number(data.totalElements) : 0,
    totalPages: Number.isFinite(Number(data.totalPages)) ? Number(data.totalPages) : 0,
  }
}

async function fetchAllPages(fetcher, baseParams = {}) {
  const pageSize = 100
  const firstResponse = await fetcher({ ...baseParams, page: 0, size: pageSize })
  const firstContent = getPageContent(firstResponse)
  const totalPages = getPageTotalPages(firstResponse)
  if (totalPages <= 1) return firstContent

  const restResponses = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => (
      fetcher({ ...baseParams, page: index + 1, size: pageSize })
    )),
  )
  return [...firstContent, ...restResponses.flatMap(getPageContent)]
}

function getVersionStatusLabel(status) {
  if (status === 'PUBLISHED') return 'Đang hoạt động'
  if (status === 'RETIRED') return 'Đã ngừng'
  return 'Chưa công bố'
}

function getVersionStatusClass(status) {
  if (status === 'PUBLISHED') return 'active'
  if (status === 'RETIRED') return 'retired'
  return 'draft'
}

function getResultLabel(result) {
  if (result === 'PASSED') return 'Đạt'
  if (result === 'FAILED_SCORE') return 'Chưa đạt điểm'
  if (result === 'FAILED_CRITICAL') return 'Không đạt câu trọng yếu'
  return 'Chưa tính điểm'
}

function getResultClass(result) {
  return result === 'PASSED' ? 'success' : 'danger'
}

function formatDateTime(value) {
  if (!value) return 'Chưa có'
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function formatScore(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return '--'
  return numberValue.toLocaleString('vi-VN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function getManagerName(manager) {
  return manager?.fullName || manager?.name || manager?.employeeCode || 'Người nhận chưa có tên'
}

function getAssignmentErrorMessage(error) {
  const statusCode = error?.response?.status
  if (!error?.response) return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.'
  if (statusCode === 403) return 'Bạn không có quyền quản lý phân quyền quy trình.'
  if (statusCode === 409) return 'Người này đang có phân quyền hiệu lực cho phiên bản hiện tại.'
  return error?.response?.data?.message || 'Không thể cập nhật phân quyền. Vui lòng thử lại.'
}

function normalizeDepartments(response) {
  const data = response?.data?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  return []
}

function parsePage(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index)
  const pages = [...new Set([0, totalPages - 1, currentPage - 1, currentPage, currentPage + 1])]
    .filter((page) => page >= 0 && page < totalPages)
    .sort((left, right) => left - right)
  return pages.flatMap((page, index) => (
    index === 0 || page === pages[index - 1] + 1 ? [page] : [`ellipsis-${page}`, page]
  ))
}

function AdminQualityHistoryVersionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { formId, versionId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.get('size')))
    ? Number(searchParams.get('size'))
    : 10
  const keyword = searchParams.get('keyword') || ''
  const submittedByUserId = searchParams.get('submittedByUserId') || ''
  const departmentId = searchParams.get('departmentId') || ''
  const result = searchParams.get('result') || ''
  const dateFrom = searchParams.get('dateFrom') || ''
  const dateTo = searchParams.get('dateTo') || ''

  const [keywordInput, setKeywordInput] = useState(keyword)
  const [form, setForm] = useState(null)
  const [version, setVersion] = useState(null)
  const [summary, setSummary] = useState({ total: 0, passed: 0, failed: 0, averageConvertedScore: null })
  const [submissionData, setSubmissionData] = useState({ content: [], page: 0, size: pageSize, totalElements: 0, totalPages: 0 })
  const [metadataLoading, setMetadataLoading] = useState(true)
  const [metadataError, setMetadataError] = useState('')
  const [resultsLoading, setResultsLoading] = useState(true)
  const [resultsError, setResultsError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [departments, setDepartments] = useState([])
  const [evaluatorQuery, setEvaluatorQuery] = useState('')
  const [evaluatorOptions, setEvaluatorOptions] = useState([])
  const [selectedEvaluatorFallback, setSelectedEvaluatorFallback] = useState(null)
  const [evaluatorsLoading, setEvaluatorsLoading] = useState(false)
  const evaluatorRequestId = useRef(0)

  const [assignments, setAssignments] = useState([])
  const [managerUsers, setManagerUsers] = useState([])
  const [managerUsersLoaded, setManagerUsersLoaded] = useState(false)
  const [managerModalOpen, setManagerModalOpen] = useState(false)
  const [selectedManagerIds, setSelectedManagerIds] = useState([])
  const [validUntil, setValidUntil] = useState('')
  const [managerBusy, setManagerBusy] = useState(false)
  const [managerMessage, setManagerMessage] = useState(null)
  const [confirmRevoke, setConfirmRevoke] = useState(null)

  const updateQuery = useCallback((changes, resetPage = true) => {
    setResultsLoading(true)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      Object.entries(changes).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) next.delete(key)
        else next.set(key, String(value))
      })
      if (resetPage && !Object.prototype.hasOwnProperty.call(changes, 'page')) next.delete('page')
      return next
    }, { replace: true })
  }, [setSearchParams])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (keywordInput.trim() !== keyword) updateQuery({ keyword: keywordInput.trim() })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [keyword, keywordInput, updateQuery])

  const loadAssignments = useCallback(async () => {
    const nextAssignments = await fetchAllPages(
      (params) => adminApi.getFormAssignmentsByForm(formId, params),
      { status: 'ACTIVE' },
    )
    setAssignments(nextAssignments.filter((item) => (
      String(item.formVersionId) === String(versionId)
      && item.effectiveStatus === 'ACTIVE'
      && item.itemStatus === 'ACTIVE'
    )))
  }, [formId, versionId])

  useEffect(() => {
    let alive = true
    Promise.all([
      adminApi.getFormById(formId),
      adminApi.getFormVersionById(formId, versionId),
      adminApi.getDepartments(),
      fetchAllPages((params) => adminApi.getFormAssignmentsByForm(formId, params), { status: 'ACTIVE' }),
    ])
      .then(([formResponse, versionResponse, departmentResponse, nextAssignments]) => {
        if (!alive) return
        setForm(formResponse.data?.data || null)
        setVersion(versionResponse.data?.data || null)
        setDepartments(normalizeDepartments(departmentResponse))
        setAssignments(nextAssignments.filter((item) => (
          String(item.formVersionId) === String(versionId)
          && item.effectiveStatus === 'ACTIVE'
          && item.itemStatus === 'ACTIVE'
        )))
        setMetadataError('')
      })
      .catch((error) => {
        if (!alive) return
        setMetadataError(error?.response?.data?.message || 'Không thể tải thông tin phiên bản quy trình.')
      })
      .finally(() => {
        if (alive) setMetadataLoading(false)
      })
    return () => {
      alive = false
    }
  }, [formId, refreshKey, versionId])

  const requestParams = useMemo(() => ({
    status: 'SUBMITTED',
    keyword: keyword || undefined,
    submittedByUserId: submittedByUserId || undefined,
    departmentId: departmentId || undefined,
    result: result || undefined,
    // Always send typed date values. PostgreSQL cannot infer a timestamp type
    // from a null optional parameter in the shared history predicates.
    dateFrom: dateFrom || UNBOUNDED_DATE_FROM,
    dateTo: dateTo || UNBOUNDED_DATE_TO,
  }), [dateFrom, dateTo, departmentId, keyword, result, submittedByUserId])

  useEffect(() => {
    let alive = true
    Promise.all([
      adminApi.getFormVersionSubmissions(formId, versionId, {
        ...requestParams,
        page,
        size: pageSize,
      }),
      adminApi.getFormVersionSubmissionSummary(formId, versionId, requestParams),
    ])
      .then(([submissionsResponse, summaryResponse]) => {
        if (!alive) return
        const nextPage = getPageData(submissionsResponse, pageSize)
        if (nextPage.totalPages > 0 && page >= nextPage.totalPages) {
          updateQuery({ page: nextPage.totalPages - 1 }, false)
          return
        }
        setSubmissionData(nextPage)
        setSummary(summaryResponse?.data?.data || { total: 0, passed: 0, failed: 0, averageConvertedScore: null })
        setResultsError('')
      })
      .catch((error) => {
        if (!alive) return
        setSubmissionData({ content: [], page, size: pageSize, totalElements: 0, totalPages: 0 })
        setSummary({ total: 0, passed: 0, failed: 0, averageConvertedScore: null })
        setResultsError(error?.response?.data?.message || 'Không thể tải danh sách kết quả.')
      })
      .finally(() => {
        if (alive) setResultsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [formId, page, pageSize, refreshKey, requestParams, updateQuery, versionId])

  useEffect(() => {
    const requestId = evaluatorRequestId.current + 1
    evaluatorRequestId.current = requestId
    const timer = window.setTimeout(() => {
      setEvaluatorsLoading(true)
      adminApi.getUsers({
        keyword: evaluatorQuery.trim() || undefined,
        page: 0,
        size: 30,
        sort: 'name,asc',
      })
        .then((response) => {
          if (evaluatorRequestId.current !== requestId) return
          setEvaluatorOptions(getPageContent(response))
        })
        .catch(() => {
          if (evaluatorRequestId.current === requestId) setEvaluatorOptions([])
        })
        .finally(() => {
          if (evaluatorRequestId.current === requestId) setEvaluatorsLoading(false)
        })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [evaluatorQuery])

  useEffect(() => {
    if (!submittedByUserId) return
    const existing = evaluatorOptions.find((user) => String(user.id) === String(submittedByUserId))
    if (existing) return
    adminApi.getUserById(submittedByUserId)
      .then((response) => setSelectedEvaluatorFallback(response?.data?.data || null))
      .catch(() => setSelectedEvaluatorFallback(null))
  }, [evaluatorOptions, submittedByUserId])

  useEffect(() => {
    if (!managerModalOpen) return undefined
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !confirmRevoke) setManagerModalOpen(false)
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [confirmRevoke, managerModalOpen])

  const managers = assignments
  const assignedManagerIds = useMemo(() => new Set(managers.map((item) => String(item.manager?.id))), [managers])
  const availableManagers = useMemo(() => (
    managerUsers.filter((manager) => !assignedManagerIds.has(String(manager.id)))
  ), [assignedManagerIds, managerUsers])
  const effectiveSelectedManagerIds = selectedManagerIds.filter((id) => (
    availableManagers.some((manager) => String(manager.id) === String(id))
  ))

  const openManagerModal = async () => {
    setManagerModalOpen(true)
    setManagerMessage(null)
    if (managerUsersLoaded) return
    try {
      setManagerBusy(true)
      const users = await fetchAllPages((params) => adminApi.getUsers(params), { status: 'ACTIVE' })
      setManagerUsers(users)
      setManagerUsersLoaded(true)
    } catch (error) {
      setManagerMessage({ type: 'error', text: getAssignmentErrorMessage(error) })
    } finally {
      setManagerBusy(false)
    }
  }

  const submitAssignment = async (event) => {
    event.preventDefault()
    if (effectiveSelectedManagerIds.length === 0) {
      setManagerMessage({ type: 'error', text: 'Vui lòng chọn ít nhất một người nhận.' })
      return
    }
    try {
      setManagerBusy(true)
      setManagerMessage(null)
      await adminApi.createFormAssignment({
        assigneeIds: effectiveSelectedManagerIds.map(Number),
        formVersionIds: [Number(versionId)],
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
      })
      await loadAssignments()
      setSelectedManagerIds([])
      setValidUntil('')
      setManagerMessage({ type: 'success', text: `Đã thêm ${effectiveSelectedManagerIds.length} người nhận.` })
    } catch (error) {
      setManagerMessage({ type: 'error', text: getAssignmentErrorMessage(error) })
    } finally {
      setManagerBusy(false)
    }
  }

  const revokeAssignment = async () => {
    if (!confirmRevoke?.assignmentItemId) return
    try {
      setManagerBusy(true)
      setManagerMessage(null)
      await adminApi.revokeFormAssignmentItem(confirmRevoke.assignmentItemId)
      await loadAssignments()
      setManagerMessage({ type: 'success', text: `Đã thu hồi phân quyền của ${getManagerName(confirmRevoke.manager)}.` })
      setConfirmRevoke(null)
    } catch (error) {
      setManagerMessage({ type: 'error', text: getAssignmentErrorMessage(error) })
    } finally {
      setManagerBusy(false)
    }
  }

  const exportResponses = async () => {
    setExporting(true)
    setExportError('')
    try {
      const exportParams = {
        keyword: requestParams.keyword,
        submittedByUserId: requestParams.submittedByUserId,
        departmentId: requestParams.departmentId,
        result: requestParams.result,
        dateFrom: requestParams.dateFrom,
        dateTo: requestParams.dateTo,
      }
      const response = await adminApi.exportFormVersionResponses(formId, versionId, exportParams)
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const safeCode = getChecklistDisplayCode(form?.code || 'bang-kiem').replace(/[^A-Za-z0-9._-]/g, '-')
      link.href = url
      link.download = `ket-qua-${safeCode}-v${version?.versionNumber || versionId}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setExportError(error?.response?.data?.message || 'Không thể xuất Excel. Vui lòng thử lại.')
    } finally {
      setExporting(false)
    }
  }

  const hasFilters = Boolean(keyword || submittedByUserId || departmentId || result || dateFrom || dateTo)
  const evaluatorSelectOptions = [
    { value: '', label: 'Tất cả người chấm' },
    ...evaluatorOptions.map((user) => ({
      value: user.id,
      label: getManagerName(user),
      description: user.employeeCode || 'Chưa có mã nhân viên',
      searchText: user.employeeCode || '',
    })),
  ]
  const departmentOptions = [
    { value: '', label: 'Tất cả khoa/phòng' },
    ...departments.map((department) => ({
      value: department.id,
      label: department.name,
      description: department.code || '',
    })),
  ]
  const selectedEvaluator = evaluatorOptions.find((user) => String(user.id) === String(submittedByUserId))
    || (String(selectedEvaluatorFallback?.id) === String(submittedByUserId) ? selectedEvaluatorFallback : null)
  const selectedEvaluatorOption = selectedEvaluator ? {
    value: selectedEvaluator.id,
    label: getManagerName(selectedEvaluator),
    description: selectedEvaluator.employeeCode || 'Chưa có mã nhân viên',
  } : undefined
  const resultFrom = submissionData.totalElements === 0 ? 0 : submissionData.page * submissionData.size + 1
  const resultTo = Math.min((submissionData.page + 1) * submissionData.size, submissionData.totalElements)
  const pageItems = getPaginationItems(submissionData.page, submissionData.totalPages)
  const returnTo = `${location.pathname}${location.search}`

  return (
    <AppShell
      className="admin-quality-history-page"
      back={{ to: `/admin/quality/history?formId=${encodeURIComponent(formId)}`, label: 'Quay lại' }}
      breadcrumbs={[
        { label: 'Chất lượng' },
        { label: 'Lịch sử đánh giá', link: '/admin/quality/history' },
        { label: `Phiên bản v${version?.versionNumber || ''}` },
      ]}
    >
        <div className="admin-quality-history admin-quality-history--version">
          {metadataLoading ? (
            <section className="aqh-empty-state"><LoadingOutlined spin /><span>Đang tải thông tin phiên bản...</span></section>
          ) : metadataError ? (
            <section className="aqh-error-state" role="alert">
              <WarningOutlined /><strong>Không thể tải phiên bản</strong><span>{metadataError}</span>
              <button onClick={() => { setMetadataLoading(true); setMetadataError(''); setRefreshKey((value) => value + 1) }} type="button"><ReloadOutlined /> Thử lại</button>
            </section>
          ) : (
            <>
              <section className="aqh-version-detail">
                <header className="aqh-version-detail__header">
                  <div>
                    <span className="aqh-form-code">{getChecklistDisplayCode(form?.code)}</span>
                    <h2>{version?.title || form?.title || 'Quy trình'}<small>v{version?.versionNumber}</small></h2>
                    <p>{version?.description || form?.description || 'Chưa có mô tả'}</p>
                  </div>
                  <span className={`aqh-version-status aqh-version-status--${getVersionStatusClass(version?.status)}`}>
                    {getVersionStatusLabel(version?.status)}
                  </span>
                </header>

                <div className="aqh-summary-grid aqh-summary-grid--history">
                  <article><span>Tổng lượt</span><strong>{resultsLoading ? '…' : summary.total}</strong><small>Theo bộ lọc hiện tại</small></article>
                  <article><span>Đạt</span><strong>{resultsLoading ? '…' : summary.passed}</strong><small>Chưa đạt: {summary.failed}</small></article>
                  <article><span>Điểm trung bình</span><strong>{resultsLoading ? '…' : formatScore(summary.averageConvertedScore)}</strong><small>Thang điểm 10</small></article>
                  <button className="aqh-summary-manager" onClick={openManagerModal} type="button">
                    <span><UserSwitchOutlined /> Người được giao</span><strong>{managers.length}</strong><small>Nhấn để quản lý</small>
                  </button>
                </div>
              </section>

              <section className="aqh-response-panel aqh-response-panel--full">
                <div className="aqh-panel-heading aqh-panel-heading--results">
                  <div><h3>Kết quả đánh giá</h3><p>{resultsLoading ? 'Đang cập nhật...' : `${submissionData.totalElements} kết quả phù hợp`}</p></div>
                  <button
                    className="aqh-export-button"
                    disabled={exporting || resultsLoading || submissionData.totalElements === 0}
                    onClick={exportResponses}
                    type="button"
                  >
                    {exporting ? <LoadingOutlined spin /> : <FileExcelOutlined />}
                    {exporting ? 'Đang xuất...' : 'Xuất Excel'}
                  </button>
                </div>

                <div className="aqh-history-filters">
                  <div className="aqh-history-filter-toolbar">
                    <div className="aqh-history-search">
                      <SearchOutlined />
                      <input
                        aria-label="Tìm nhân viên được đánh giá"
                        type="text"
                        value={keywordInput}
                        onChange={(event) => setKeywordInput(event.target.value)}
                        placeholder="Tìm theo tên hoặc mã nhân viên..."
                      />
                    </div>
                    <button
                      aria-controls="quality-history-filter-panel"
                      aria-expanded={isFilterOpen}
                      className={`aqh-history-filter-trigger${isFilterOpen ? ' is-open' : ''}`}
                      onClick={() => setIsFilterOpen((current) => !current)}
                      type="button"
                    >
                      <FilterOutlined /> Bộ lọc
                      {[submittedByUserId, departmentId, result, dateFrom, dateTo].filter(Boolean).length > 0 && (
                        <span className="aqh-history-filter-count">
                          {[submittedByUserId, departmentId, result, dateFrom, dateTo].filter(Boolean).length}
                        </span>
                      )}
                    </button>
                  </div>
                  {isFilterOpen && (
                    <div className="aqh-history-filter-panel" id="quality-history-filter-panel">
                    <label className="aqh-filter-field">
                      <span>Người thực hiện chấm</span>
                      <SearchableSelect
                        ariaLabel="Lọc theo người thực hiện chấm"
                        loading={evaluatorsLoading}
                        onChange={(value) => updateQuery({ submittedByUserId: value })}
                        onSearch={setEvaluatorQuery}
                        options={evaluatorSelectOptions}
                        placeholder="Tất cả người chấm"
                        searchPlaceholder="Tìm tên hoặc mã người chấm..."
                        selectedOption={selectedEvaluatorOption}
                        value={submittedByUserId}
                      />
                    </label>
                    <label className="aqh-filter-field">
                      <span>Khoa/phòng</span>
                      <SearchableSelect
                        ariaLabel="Lọc theo khoa phòng"
                        onChange={(value) => updateQuery({ departmentId: value })}
                        options={departmentOptions}
                        placeholder="Tất cả khoa/phòng"
                        searchPlaceholder="Tìm khoa/phòng..."
                        value={departmentId}
                      />
                    </label>
                    <label className="aqh-filter-field">
                      <span>Kết quả</span>
                      <select value={result} onChange={(event) => updateQuery({ result: event.target.value })}>
                        {RESULT_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="aqh-filter-field"><span>Từ ngày</span><input type="date" value={dateFrom} onChange={(event) => updateQuery({ dateFrom: event.target.value })} /></label>
                    <label className="aqh-filter-field"><span>Đến ngày</span><input type="date" value={dateTo} onChange={(event) => updateQuery({ dateTo: event.target.value })} /></label>
                    {hasFilters && <button className="aqh-filter-reset" onClick={() => { setKeywordInput(''); setSearchParams({ size: String(pageSize) }, { replace: true }) }} type="button"><ReloadOutlined /> Xóa lọc</button>}
                    </div>
                  )}
                </div>

                {exportError && <div className="aqh-export-error" role="alert">{exportError}</div>}
                {resultsError ? (
                  <div className="aqh-inline-error" role="alert"><WarningOutlined /><span>{resultsError}</span><button onClick={() => { setResultsLoading(true); setResultsError(''); setRefreshKey((value) => value + 1) }} type="button">Thử lại</button></div>
                ) : resultsLoading ? (
                  <div className="aqh-results-loading"><LoadingOutlined spin /><span>Đang tải kết quả...</span></div>
                ) : submissionData.content.length === 0 ? (
                  <div className="aqh-results-empty"><CheckCircleIcon /><strong>Chưa có kết quả phù hợp</strong><span>Hãy thay đổi bộ lọc hoặc khoảng thời gian.</span></div>
                ) : (
                  <>
                    <div className="aqh-results-table-wrap">
                      <table className="aqh-results-table admin-table-uppercase">
                        <thead>
                          <tr>
                            <th>Nhân viên</th>
                            <th>Khoa/phòng</th>
                            <th>Người chấm</th>
                            <th>Ngày nộp</th>
                            <th>Điểm</th>
                            <th>Kết quả</th>
                            <th>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {submissionData.content.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <div className="aqh-results-table__person">
                                  <strong>{item.subject?.fullName || 'Chưa có tên'}</strong>
                                  <small>{item.subject?.employeeCode || 'Chưa có mã'}</small>
                                </div>
                              </td>
                              <td>
                                <div className="aqh-results-table__inline">
                                  <ApartmentOutlined />
                                  <span>{item.subject?.department || 'Chưa xác định'}</span>
                                </div>
                              </td>
                              <td>
                                <div className="aqh-results-table__person">
                                  <span>{item.submittedBy?.fullName || 'Chưa xác định'}</span>
                                  <small>{item.submittedBy?.employeeCode || ''}</small>
                                </div>
                              </td>
                              <td>
                                <div className="aqh-results-table__inline">
                                  <ClockCircleOutlined />
                                  <span>{formatDateTime(item.submittedAt || item.updatedAt)}</span>
                                </div>
                              </td>
                              <td><strong className="aqh-response-score">{formatScore(item.convertedScore)}/10</strong></td>
                              <td><span className={`admin-quality-history__badge admin-quality-history__badge--${getResultClass(item.result)}`}>{getResultLabel(item.result)}</span></td>
                              <td>
                                <div className="admin-table-actions">
                                  <button
                                    aria-label={`Xem chi tiết kết quả của ${item.subject?.fullName || 'nhân viên'}`}
                                    className="admin-table-action admin-table-action--icon admin-table-action--primary"
                                    onClick={() => navigate(`/admin/quality/history/${item.id}?returnTo=${encodeURIComponent(returnTo)}`)}
                                    title="Xem chi tiết"
                                    type="button"
                                  ><EyeOutlined /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <footer className="aqh-pagination">
                      <div className="aqh-pagination__summary">Hiển thị <strong>{resultFrom}–{resultTo}</strong> trong <strong>{submissionData.totalElements}</strong> kết quả</div>
                      <div className="aqh-pagination__controls">
                        <label>Số dòng<select value={pageSize} onChange={(event) => updateQuery({ size: Number(event.target.value), page: 0 }, false)}>{PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
                        <button disabled={submissionData.page <= 0} onClick={() => updateQuery({ page: Math.max(0, submissionData.page - 1) }, false)} type="button">Trước</button>
                        <div className="aqh-pagination__pages" aria-label="Chọn trang kết quả">
                          {pageItems.map((item) => typeof item === 'number' ? (
                            <button aria-current={item === submissionData.page ? 'page' : undefined} className={item === submissionData.page ? 'is-active' : ''} key={item} onClick={() => updateQuery({ page: item }, false)} type="button">{item + 1}</button>
                          ) : <span key={item}>…</span>)}
                        </div>
                        <button disabled={submissionData.page >= submissionData.totalPages - 1} onClick={() => updateQuery({ page: Math.min(submissionData.totalPages - 1, submissionData.page + 1) }, false)} type="button">Sau</button>
                      </div>
                    </footer>
                  </>
                )}
              </section>
            </>
          )}
        </div>

      {managerModalOpen && (
        <div className="aqh-manager-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !confirmRevoke) setManagerModalOpen(false) }} role="presentation">
          <section aria-labelledby="aqh-manager-modal-title" aria-modal="true" className="aqh-manager-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <header className="aqh-manager-modal__header">
              <div><span>PHÂN QUYỀN PHIÊN BẢN v{version?.versionNumber}</span><h2 id="aqh-manager-modal-title">Người được giao</h2><p>Thêm hoặc thu hồi người được phép thực hiện quy trình này.</p></div>
              <button aria-label="Đóng cửa sổ quản lý phân quyền" className="aqh-manager-modal__close" onClick={() => setManagerModalOpen(false)} type="button"><CloseOutlined /></button>
            </header>
            <div className="aqh-manager-modal__body">
              {version?.status === 'PUBLISHED' ? (
                <form className="aqh-manager-assign" onSubmit={submitAssignment}>
                  <div className="aqh-manager-assign__field aqh-manager-assign__field--people">
                    <label htmlFor="aqh-manager-search">Người nhận mới</label>
                    <SearchableSelect
                      multiple
                      ariaLabel="Tìm và chọn người nhận mới"
                      disabled={managerBusy || !managerUsersLoaded}
                      emptyMessage="Không còn người nhận phù hợp"
                      id="aqh-manager-search"
                      onChange={setSelectedManagerIds}
                      options={availableManagers.map((manager) => ({ value: manager.id, label: getManagerName(manager), description: manager.employeeCode || 'Chưa có mã nhân viên', searchText: `${manager.employeeCode || ''} ${manager.departmentName || manager.department?.name || ''}` }))}
                      placeholder={managerBusy && !managerUsersLoaded ? 'Đang tải danh sách...' : 'Tìm theo tên hoặc mã nhân viên...'}
                      value={selectedManagerIds}
                    />
                  </div>
                  <div className="aqh-manager-assign__field"><label htmlFor="aqh-manager-valid-until">Hiệu lực đến</label><input disabled={managerBusy} id="aqh-manager-valid-until" onChange={(event) => setValidUntil(event.target.value)} type="datetime-local" value={validUntil} /></div>
                  <button className="aqh-manager-assign__submit" disabled={managerBusy || effectiveSelectedManagerIds.length === 0} type="submit">{managerBusy ? <LoadingOutlined spin /> : <PlusOutlined />} Thêm người nhận</button>
                </form>
              ) : <div className="aqh-manager-modal__notice">Phiên bản không còn hoạt động nên không thể thêm phân quyền mới.</div>}

              {managerMessage && <div className={`aqh-manager-message aqh-manager-message--${managerMessage.type}`} role="status">{managerMessage.text}</div>}
              <div className="aqh-manager-modal__list-heading"><div><h3>Danh sách đang hiệu lực</h3><p>{managers.length} người đang được giao</p></div></div>
              {managerBusy && !managerUsersLoaded ? (
                <div className="aqh-results-loading"><LoadingOutlined spin /><span>Đang tải danh sách...</span></div>
              ) : managers.length === 0 ? (
                <div className="aqh-manager-empty"><UserSwitchOutlined /><strong>Chưa có người được giao</strong><span>Chọn người nhận ở phía trên để bắt đầu phân quyền.</span></div>
              ) : (
                <div className="aqh-manager-modal__list">
                  {managers.map((item) => {
                    const managerName = getManagerName(item.manager)
                    return (
                      <article key={item.assignmentItemId}>
                        <span className="aqh-manager-avatar" aria-hidden="true">{managerName.charAt(0).toUpperCase()}</span>
                        <div className="aqh-manager-identity"><strong>{managerName}</strong><span>{item.manager?.employeeCode || 'Chưa có mã nhân viên'}</span></div>
                        <div className="aqh-manager-validity"><ClockCircleOutlined /><span>{item.validUntil ? `Đến ${formatDateTime(item.validUntil)}` : 'Không giới hạn'}</span></div>
                        <button className="aqh-manager-revoke" disabled={managerBusy} onClick={() => setConfirmRevoke(item)} type="button"><StopOutlined /> Thu hồi</button>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <ConfirmModal
        danger
        isOpen={Boolean(confirmRevoke)}
        message={confirmRevoke ? `Thu hồi quyền thực hiện quy trình của ${getManagerName(confirmRevoke.manager)}?` : ''}
        onCancel={() => setConfirmRevoke(null)}
        onConfirm={revokeAssignment}
        title="Thu hồi phân quyền"
      />
    </AppShell>
  )
}

function CheckCircleIcon() {
  return <span className="aqh-results-empty__icon">✓</span>
}

export default AdminQualityHistoryVersionPage
