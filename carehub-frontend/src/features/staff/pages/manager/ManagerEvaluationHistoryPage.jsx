import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  EyeOutlined,
  LoadingOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import AppliedFilterToolbar from '../../../../shared/components/AppliedFilterToolbar.jsx'
import KeyboardDatePicker from '../../../../shared/components/KeyboardDatePicker.jsx'
import SearchableSelect from '../../../../shared/components/SearchableSelect.jsx'
import { validateHistoricalDateRange } from '../../../../shared/utils/dateRange.js'
import { adminApi } from '../../../admin/api/adminApi.js'
import '../../../../shared/styles/admin-tables.css'
import '../../../admin/styles/AdminQualityHistoryPage.css'

const RESULT_OPTIONS = [
  { value: '', label: 'Tất cả kết quả' },
  { value: 'PASSED', label: 'Đạt' },
  { value: 'FAILED', label: 'Chưa đạt' },
  { value: 'FAILED_SCORE', label: 'Chưa đạt điểm' },
  { value: 'FAILED_CRITICAL', label: 'Không đạt câu trọng yếu' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50]

function getDefaultDateRange() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return {
    dateFrom: `${today.getFullYear()}-01-01`,
    dateTo: `${today.getFullYear()}-${month}-${day}`,
  }
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

function getResultLabel(result) {
  if (result === 'PASSED') return 'Đạt'
  if (result === 'FAILED_SCORE') return 'Chưa đạt điểm'
  if (result === 'FAILED_CRITICAL') return 'Không đạt câu trọng yếu'
  return 'Chưa tính điểm'
}

function getResultClass(result) {
  return result === 'PASSED' ? 'success' : 'danger'
}

function parsePage(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function numericParam(value) {
  const match = String(value || '').match(/^\d+/)
  return match ? match[0] : ''
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

function normalizeDepartments(response) {
  const list = response?.data?.data?.content || response?.data?.data || []
  return Array.isArray(list) ? list.map((item) => ({
    id: String(item.id),
    name: item.name || item.departmentName || '',
    code: item.code || '',
  })) : []
}

function ManagerEvaluationHistoryPage({ historyPath = '/manager/quality/history' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const defaultDateRange = useMemo(() => getDefaultDateRange(), [])
  const [searchParams, setSearchParams] = useSearchParams()

  const page = parsePage(searchParams.get('page'))
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.get('size')))
    ? Number(searchParams.get('size'))
    : 10
  const keyword = searchParams.get('keyword') || ''
  const formId = numericParam(searchParams.get('formId'))
  const departmentId = numericParam(searchParams.get('departmentId'))
  const result = searchParams.get('result') || ''
  const dateFrom = searchParams.get('dateFrom') || defaultDateRange.dateFrom
  const dateTo = searchParams.get('dateTo') || defaultDateRange.dateTo

  const [keywordInput, setKeywordInput] = useState(keyword)
  const [draftFormId, setDraftFormId] = useState(formId)
  const [draftDepartmentId, setDraftDepartmentId] = useState(departmentId)
  const [draftResult, setDraftResult] = useState(result)
  const [draftDateFrom, setDraftDateFrom] = useState(dateFrom)
  const [draftDateTo, setDraftDateTo] = useState(dateTo)

  const [departments, setDepartments] = useState([])
  const [forms, setForms] = useState([])
  const [summary, setSummary] = useState({ total: 0, passed: 0, failed: 0, averageConvertedScore: null })
  const [submissionData, setSubmissionData] = useState({ content: [], page: 0, size: pageSize, totalElements: 0, totalPages: 0 })
  const [resultsLoading, setResultsLoading] = useState(true)
  const [resultsError, setResultsError] = useState('')
  const [filterError, setFilterError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

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
    setKeywordInput(keyword)
    setDraftFormId(formId)
    setDraftDepartmentId(departmentId)
    setDraftResult(result)
    setDraftDateFrom(dateFrom)
    setDraftDateTo(dateTo)
  }, [dateFrom, dateTo, departmentId, formId, keyword, result])

  useEffect(() => {
    if (!isFilterOpen) return undefined
    let alive = true
    Promise.all([
      adminApi.getDepartments(),
      adminApi.getQualityChecklistFilterOptions({ fromDate: dateFrom, toDate: dateTo }),
    ])
      .then(([deptRes, filterRes]) => {
        if (!alive) return
        setDepartments(normalizeDepartments(deptRes))
        const filterData = filterRes?.data?.data || {}
        setForms(Array.isArray(filterData.forms) ? filterData.forms : [])
      })
      .catch(() => {})
    return () => { alive = false }
  }, [dateFrom, dateTo, isFilterOpen])

  const requestParams = useMemo(() => ({
    keyword: keyword || undefined,
    formId: formId || undefined,
    departmentId: departmentId || undefined,
    result: result || undefined,
    dateFrom,
    dateTo,
  }), [dateFrom, dateTo, departmentId, formId, keyword, result])

  useEffect(() => {
    let alive = true
    setResultsLoading(true)
    setResultsError('')
    Promise.all([
      adminApi.getEvaluationHistory({
        ...requestParams,
        page,
        size: pageSize,
      }),
      adminApi.getEvaluationHistorySummary(requestParams),
    ])
      .then(([resList, resSummary]) => {
        if (!alive) return
        const listData = resList?.data?.data || {}
        setSubmissionData({
          content: Array.isArray(listData.content) ? listData.content : [],
          page: Number(listData.page || 0),
          size: Number(listData.size || pageSize),
          totalElements: Number(listData.totalElements || 0),
          totalPages: Number(listData.totalPages || 0),
        })
        const sumData = resSummary?.data?.data || {}
        setSummary({
          total: Number(sumData.total || 0),
          passed: Number(sumData.passed || 0),
          failed: Number(sumData.failed || 0),
          averageConvertedScore: sumData.averageConvertedScore,
        })
      })
      .catch((err) => {
        if (!alive) return
        setResultsError(err?.response?.data?.message || 'Không thể tải lịch sử đánh giá.')
      })
      .finally(() => {
        if (alive) setResultsLoading(false)
      })
    return () => { alive = false }
  }, [page, pageSize, refreshKey, requestParams])

  const activeFilterCount = [
    formId,
    departmentId,
    result,
    dateFrom !== defaultDateRange.dateFrom,
    dateTo !== defaultDateRange.dateTo,
  ].filter(Boolean).length

  function handleApplyFilters() {
    const validationError = validateHistoricalDateRange(draftDateFrom, draftDateTo, {
      maxDate: defaultDateRange.dateTo,
    })
    if (validationError) {
      setFilterError(validationError)
      return
    }
    setFilterError('')
    updateQuery({
      formId: draftFormId,
      departmentId: draftDepartmentId,
      result: draftResult,
      dateFrom: draftDateFrom,
      dateTo: draftDateTo,
    })
  }

  function handleResetFilters() {
    setFilterError('')
    setDraftFormId('')
    setDraftDepartmentId('')
    setDraftResult('')
    setDraftDateFrom(defaultDateRange.dateFrom)
    setDraftDateTo(defaultDateRange.dateTo)
    updateQuery({
      formId: '',
      departmentId: '',
      result: '',
      dateFrom: defaultDateRange.dateFrom,
      dateTo: defaultDateRange.dateTo,
    })
  }

  const resultFrom = submissionData.totalElements === 0 ? 0 : submissionData.page * submissionData.size + 1
  const resultTo = Math.min((submissionData.page + 1) * submissionData.size, submissionData.totalElements)
  const pageItems = getPaginationItems(submissionData.page, submissionData.totalPages)
  const returnTo = `${location.pathname}${location.search}`

  const departmentOptions = useMemo(() => [
    { value: '', label: 'Tất cả khoa' },
    ...departments.map((dept) => ({
      value: dept.id,
      label: dept.name,
      searchText: `${dept.name} ${dept.code}`,
    })),
  ], [departments])

  const formOptions = useMemo(() => [
    { value: '', label: 'Tất cả quy trình' },
    ...forms.map((f) => ({
      value: String(f.id),
      label: f.title || f.name,
      searchText: `${f.title || f.name} ${f.code || ''}`,
    })),
  ], [forms])

  return (
    <AppShell
      className="admin-quality-history-page"
      title="Lịch sử đánh giá"
      breadcrumbs={[
        { label: 'Giám sát tuân thủ' },
        { label: 'Lịch sử đánh giá' },
      ]}
    >
      <div className="admin-quality-history admin-quality-history--version">
        <section className="aqh-version-detail">
          <header className="aqh-version-detail__header">
            <div>
              <h2>Lịch sử đánh giá</h2>
              <p>Tất cả các lượt đánh giá và chấm điểm bảng kiểm do bạn thực hiện (bao gồm cả các khoa/phòng khác).</p>
            </div>
          </header>

          <div className="aqh-summary-grid aqh-summary-grid--history">
            <article>
              <span>Tổng lượt</span>
              <strong>{resultsLoading ? '…' : summary.total}</strong>
              <small>Theo bộ lọc hiện tại</small>
            </article>
            <article>
              <span>Đạt</span>
              <strong>{resultsLoading ? '…' : summary.passed}</strong>
              <small>Chưa đạt: {summary.failed}</small>
            </article>
            <article>
              <span>Điểm trung bình</span>
              <strong>{resultsLoading ? '…' : formatScore(summary.averageConvertedScore)}</strong>
              <small>Thang điểm 10</small>
            </article>
          </div>
        </section>

        <section className="aqh-response-panel aqh-response-panel--full">
          <div className="aqh-panel-heading aqh-panel-heading--results">
            <div>
              <h3>Kết quả đánh giá</h3>
              <p>{resultsLoading ? 'Đang cập nhật...' : `${submissionData.totalElements} kết quả phù hợp`}</p>
            </div>
          </div>

          <AppliedFilterToolbar
            activeCount={activeFilterCount}
            className="aqh-results-filter"
            errorMessage={filterError}
            isOpen={isFilterOpen}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
            onSearchChange={setKeywordInput}
            onToggle={() => {
              setFilterError('')
              setIsFilterOpen((v) => !v)
            }}
            searchPlaceholder="Tìm theo tên hoặc mã nhân viên..."
            searchValue={keywordInput}
          >
            <label className="admin-control-toolbar__field">
              <span>Quy trình / Bảng kiểm</span>
              <SearchableSelect
                ariaLabel="Lọc theo quy trình"
                onChange={setDraftFormId}
                options={formOptions}
                placeholder="Tất cả quy trình"
                searchPlaceholder="Tìm quy trình..."
                showDescriptions={false}
                value={draftFormId}
              />
            </label>
            <label className="admin-control-toolbar__field">
              <span>Khoa/phòng</span>
              <SearchableSelect
                ariaLabel="Lọc theo khoa phòng"
                onChange={setDraftDepartmentId}
                options={departmentOptions}
                placeholder="Tất cả khoa"
                searchPlaceholder="Tìm khoa/phòng..."
                showDescriptions={false}
                value={draftDepartmentId}
              />
            </label>
            <label className="admin-control-toolbar__field">
              <span>Kết quả</span>
              <SearchableSelect
                ariaLabel="Lọc theo kết quả"
                onChange={setDraftResult}
                options={RESULT_OPTIONS}
                searchable={false}
                showDescriptions={false}
                value={draftResult}
              />
            </label>
            <label className="admin-control-toolbar__field aqh-results-filter__date">
              <span>Từ ngày</span>
              <KeyboardDatePicker
                allowInvalidValue
                value={draftDateFrom}
                max={draftDateTo || defaultDateRange.dateTo}
                onChange={(value) => { setFilterError(''); setDraftDateFrom(value) }}
              />
            </label>
            <label className="admin-control-toolbar__field aqh-results-filter__date">
              <span>Đến ngày</span>
              <KeyboardDatePicker
                allowInvalidValue
                value={draftDateTo}
                min={draftDateFrom || undefined}
                max={defaultDateRange.dateTo}
                onChange={(value) => { setFilterError(''); setDraftDateTo(value) }}
              />
            </label>
          </AppliedFilterToolbar>

          {resultsError ? (
            <div className="aqh-inline-error" role="alert">
              <WarningOutlined />
              <span>{resultsError}</span>
              <button
                onClick={() => {
                  setResultsLoading(true)
                  setResultsError('')
                  setRefreshKey((value) => value + 1)
                }}
                type="button"
              >
                Thử lại
              </button>
            </div>
          ) : resultsLoading ? (
            <div className="aqh-results-loading">
              <LoadingOutlined spin />
              <span>Đang tải kết quả...</span>
            </div>
          ) : submissionData.content.length === 0 ? (
            <div className="aqh-results-empty">
              <CheckCircleOutlined style={{ fontSize: 32, color: '#94a3b8', marginBottom: 8 }} />
              <strong>Chưa có kết quả phù hợp</strong>
              <span>Hãy thay đổi bộ lọc hoặc khoảng thời gian.</span>
            </div>
          ) : (
            <>
              <div className="aqh-results-table-wrap">
                <table className="aqh-results-table admin-table-uppercase">
                  <thead>
                    <tr>
                      <th className="aqh-result-col-employee">Nhân viên</th>
                      <th className="aqh-result-col-department">Khoa/phòng</th>
                      <th className="aqh-result-col-grader">Bảng kiểm</th>
                      <th className="aqh-result-col-submitted">Ngày nộp</th>
                      <th className="aqh-result-col-score">Điểm</th>
                      <th className="aqh-result-col-result">Kết quả</th>
                      <th className="aqh-result-col-actions">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissionData.content.map((item) => {
                      const subjectName = item.subject?.fullName || item.subjectContext?.fullName || '---'
                      const deptName = item.subject?.departmentName || item.subject?.department || item.subjectContext?.department || item.subjectContext?.subjectUser?.department?.name || '---'
                      const formTitle = item.formTitle || item.title || item.formVersion?.form?.title || item.formVersion?.title || 'Bảng kiểm'
                      const versionNum = item.versionNumber || item.formVersion?.versionNumber || 1

                      return (
                        <tr key={item.id}>
                          <td className="aqh-result-col-employee">
                            <div className="aqh-results-table__person">
                              <strong>{subjectName}</strong>
                            </div>
                          </td>
                          <td className="aqh-result-col-department">
                            <div className="aqh-results-table__inline">{deptName}</div>
                          </td>
                          <td className="aqh-result-col-grader">
                            <div className="aqh-results-table__person">
                              <strong>{formTitle}</strong>
                              <small>v{versionNum}</small>
                            </div>
                          </td>
                          <td className="aqh-result-col-submitted">
                            <div className="aqh-results-table__inline">{formatDateTime(item.submittedAt)}</div>
                          </td>
                          <td className="aqh-result-col-score">
                            <strong className="aqh-response-score">{formatScore(item.convertedScore)}/10</strong>
                          </td>
                          <td className="aqh-result-col-result">
                            <span className={`admin-quality-history__badge admin-quality-history__badge--${getResultClass(item.result)}`}>
                              {getResultLabel(item.result)}
                            </span>
                          </td>
                          <td className="aqh-result-col-actions">
                            <div className="admin-table-actions">
                              <button
                                aria-label={`Xem chi tiết kết quả của ${subjectName}`}
                                className="admin-table-action admin-table-action--icon admin-table-action--primary"
                                onClick={() => {
                                  navigate(`${historyPath}/${item.id}?returnTo=${encodeURIComponent(returnTo)}`)
                                }}
                                title="Xem chi tiết"
                                type="button"
                              >
                                <EyeOutlined />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <footer className="aqh-pagination">
                <div className="aqh-pagination__summary">
                  Hiển thị <strong>{resultFrom}–{resultTo}</strong> trong <strong>{submissionData.totalElements}</strong> kết quả
                </div>
                <div className="aqh-pagination__controls">
                  <label className="aqh-pagination__size">
                    <span>Số dòng</span>
                    <select
                      aria-label="Số dòng mỗi trang"
                      onChange={(event) => updateQuery({ size: Number(event.target.value), page: 0 }, false)}
                      value={submissionData.size}
                    >
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>

                  <div className="aqh-pagination__pages" aria-label="Chọn trang kết quả">
                    <button
                      className="aqh-pagination__nav"
                      disabled={submissionData.page === 0}
                      onClick={() => updateQuery({ page: submissionData.page - 1 }, false)}
                      type="button"
                    >
                      Trước
                    </button>
                    {pageItems.map((item) => (
                      typeof item === 'number' ? (
                        <button
                          key={item}
                          aria-current={item === submissionData.page ? 'page' : undefined}
                          className={`aqh-pagination__page ${item === submissionData.page ? 'is-active' : ''}`}
                          onClick={() => updateQuery({ page: item }, false)}
                          type="button"
                        >
                          {item + 1}
                        </button>
                      ) : (
                        <span key={item} className="aqh-pagination__ellipsis">…</span>
                      )
                    ))}
                    <button
                      className="aqh-pagination__nav"
                      disabled={submissionData.page >= submissionData.totalPages - 1}
                      onClick={() => updateQuery({ page: submissionData.page + 1 }, false)}
                      type="button"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>
    </AppShell>
  )
}

export default ManagerEvaluationHistoryPage
