import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ClockCircleOutlined,
  CloseOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FilterOutlined,
  LoadingOutlined,
  PlusOutlined,
  StopOutlined,
  UserSwitchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AdminHeader from '../components/AdminHeader'
import AdminSidebar from '../components/AdminSidebar'
import ConfirmModal from '../components/ConfirmModal.jsx'
import MultiSearchSelect from '../../../shared/components/MultiSearchSelect.jsx'
import { adminApi } from '../api/adminApi'
import { getChecklistDisplayCode } from '../utils/formCode.js'
import '../styles/AdminQualityHistoryPage.css'

const RESULT_OPTIONS = [
  { value: '', label: 'Tất cả kết quả' },
  { value: 'PASSED', label: 'Đạt' },
  { value: 'FAILED_SCORE', label: 'Không đạt điểm' },
  { value: 'FAILED_CRITICAL', label: 'Không đạt tiêu chí trọng yếu' },
]

const PAGE_SIZE_OPTIONS = [10, 20, 50]

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
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetcher({ ...baseParams, page: index + 1, size: pageSize }),
    ),
  )

  return [...firstContent, ...restResponses.flatMap(getPageContent)]
}

function getVersionStatusLabel(status) {
  if (status === 'PUBLISHED') return 'Đang hoạt động'
  if (status === 'RETIRED') return 'Đã retired'
  return 'Chưa công bố'
}

function getVersionStatusClass(status) {
  if (status === 'PUBLISHED') return 'active'
  if (status === 'RETIRED') return 'retired'
  return 'draft'
}

function getResultLabel(result) {
  switch (result) {
    case 'PASSED':
      return 'Đạt'
    case 'FAILED_SCORE':
      return 'Không đạt điểm'
    case 'FAILED_CRITICAL':
      return 'Không đạt tiêu chí trọng yếu'
    default:
      return 'Chưa tính điểm'
  }
}

function getResultClass(result) {
  return result === 'PASSED' ? 'success' : 'danger'
}

function formatDateTime(value) {
  if (!value) return 'Không giới hạn'

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
  const positiveValue = Math.max(numberValue, 0)
  const roundedValue = Math.abs(positiveValue) < 0.00005 ? 0 : positiveValue
  return roundedValue.toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

function getManagerName(manager) {
  return manager?.fullName || manager?.name || manager?.employeeCode || 'Manager chưa có tên'
}

function getAssignmentErrorMessage(error) {
  const statusCode = error?.response?.status
  if (!error?.response) return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.'
  if (statusCode === 403) return 'Bạn không có quyền quản lý phân quyền quy trình.'
  if (statusCode === 409) return 'Người này đang có phân quyền hiệu lực cho phiên bản hiện tại.'
  return error?.response?.data?.message || 'Không thể cập nhật phân quyền. Vui lòng thử lại.'
}

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index)

  const pages = [...new Set([0, totalPages - 1, currentPage - 1, currentPage, currentPage + 1])]
    .filter((page) => page >= 0 && page < totalPages)
    .sort((left, right) => left - right)

  return pages.flatMap((page, index) => {
    if (index === 0 || page === pages[index - 1] + 1) return [page]
    return [`ellipsis-${page}`, page]
  })
}

function AdminQualityHistoryVersionPage() {
  const navigate = useNavigate()
  const { formId, versionId } = useParams()
  const [form, setForm] = useState(null)
  const [version, setVersion] = useState(null)
  const [summary, setSummary] = useState({ total: 0, passed: 0, failed: 0, averageConvertedScore: null })
  const [submissionData, setSubmissionData] = useState({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 })
  const [submissionPage, setSubmissionPage] = useState(0)
  const [submissionPageSize, setSubmissionPageSize] = useState(10)
  const [submissionsLoading, setSubmissionsLoading] = useState(true)
  const [submissionsError, setSubmissionsError] = useState('')
  const [assignments, setAssignments] = useState([])
  const [managerUsers, setManagerUsers] = useState([])
  const [managerUsersLoaded, setManagerUsersLoaded] = useState(false)
  const [managerModalOpen, setManagerModalOpen] = useState(false)
  const [selectedManagerIds, setSelectedManagerIds] = useState([])
  const [validUntil, setValidUntil] = useState('')
  const [managerBusy, setManagerBusy] = useState(false)
  const [managerMessage, setManagerMessage] = useState(null)
  const [confirmRevoke, setConfirmRevoke] = useState(null)
  const [resultFilter, setResultFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [exportError, setExportError] = useState('')

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

  useEffect(() => {
    let alive = true

    const loadVersionHistory = async () => {
      try {
        setLoading(true)
        setErrorMessage('')

        const [formResponse, versionResponse, summaryResponse, nextAssignments] = await Promise.all([
          adminApi.getFormById(formId),
          adminApi.getFormVersionById(formId, versionId),
          adminApi.getFormVersionSubmissionSummary(formId, versionId),
          fetchAllPages(
            (params) => adminApi.getFormAssignmentsByForm(formId, params),
            { status: 'ACTIVE' },
          ),
        ])

        if (!alive) return

        setForm(formResponse.data?.data || null)
        setVersion(versionResponse.data?.data || null)
        setSummary(summaryResponse.data?.data || { total: 0, passed: 0, failed: 0, averageConvertedScore: null })
        setAssignments(nextAssignments.filter((item) => (
          String(item.formVersionId) === String(versionId)
          && item.effectiveStatus === 'ACTIVE'
          && item.itemStatus === 'ACTIVE'
        )))
      } catch (error) {
        if (!alive) return
        setErrorMessage(error?.response?.data?.message || 'Không thể tải thông tin phiên bản quy trình.')
      } finally {
        if (alive) setLoading(false)
      }
    }

    loadVersionHistory()

    return () => {
      alive = false
    }
  }, [formId, versionId])

  useEffect(() => {
    let alive = true

    const loadSubmissions = async () => {
      try {
        setSubmissionsLoading(true)
        setSubmissionsError('')
        const response = await adminApi.getFormVersionSubmissions(formId, versionId, {
          status: 'SUBMITTED',
          result: resultFilter || undefined,
          page: submissionPage,
          size: submissionPageSize,
        })
        if (!alive) return

        const nextPage = getPageData(response, submissionPageSize)
        if (nextPage.totalPages > 0 && submissionPage >= nextPage.totalPages) {
          setSubmissionPage(nextPage.totalPages - 1)
          return
        }
        setSubmissionData(nextPage)
      } catch (error) {
        if (!alive) return
        setSubmissionData({ content: [], page: submissionPage, size: submissionPageSize, totalElements: 0, totalPages: 0 })
        setSubmissionsError(error?.response?.data?.message || 'Không thể tải danh sách kết quả.')
      } finally {
        if (alive) setSubmissionsLoading(false)
      }
    }

    loadSubmissions()
    return () => {
      alive = false
    }
  }, [formId, resultFilter, submissionPage, submissionPageSize, versionId])

  const managers = assignments
  const assignedManagerIds = useMemo(() => (
    new Set(managers.map((item) => String(item.manager?.id)))
  ), [managers])
  const availableManagers = useMemo(() => (
    managerUsers.filter((manager) => !assignedManagerIds.has(String(manager.id)))
  ), [assignedManagerIds, managerUsers])
  const effectiveSelectedManagerIds = selectedManagerIds.filter((id) => (
    availableManagers.some((manager) => String(manager.id) === String(id))
  ))

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
      setManagerMessage({
        type: 'success',
        text: `Đã thêm ${effectiveSelectedManagerIds.length} người vào danh sách phân quyền.`,
      })
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
      setManagerMessage({
        type: 'success',
        text: `Đã thu hồi phân quyền của ${getManagerName(confirmRevoke.manager)}.`,
      })
      setConfirmRevoke(null)
    } catch (error) {
      setManagerMessage({ type: 'error', text: getAssignmentErrorMessage(error) })
    } finally {
      setManagerBusy(false)
    }
  }

  const pageItems = getPaginationItems(submissionData.page, submissionData.totalPages)
  const resultFrom = submissionData.totalElements === 0 ? 0 : submissionData.page * submissionData.size + 1
  const resultTo = Math.min((submissionData.page + 1) * submissionData.size, submissionData.totalElements)

  const exportResponses = async () => {
    setExporting(true)
    setExportError('')
    try {
      const response = await adminApi.exportFormVersionResponses(formId, versionId, resultFilter)
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const safeCode = getChecklistDisplayCode(form?.code || 'bang-kiem')
        .replace(/[^A-Za-z0-9._-]/g, '-')
      const suffix = resultFilter ? resultFilter.toLowerCase() : 'tat-ca'
      link.href = url
      link.download = `ket-qua-${safeCode}-v${version?.versionNumber || versionId}-${suffix}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setExportError(
        error?.response?.data?.message
        || 'Không thể xuất Excel cho phiên bản này. Vui lòng thử lại.',
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="dashboard-layout admin-quality-history-page">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader
          back={{ to: `/admin/quality/history?formId=${encodeURIComponent(formId)}`, label: 'Quay lại' }}
          breadcrumbs={[
            { label: 'Chất lượng' },
            { label: 'Lịch sử đánh giá', link: '/admin/quality/history' },
            { label: 'Chi tiết phiên bản' },
          ]}
        />

        <main className="admin-quality-history admin-quality-history--version">
          {loading ? (
            <section className="aqh-empty-state">
              <LoadingOutlined />
              <span>Đang tải thông tin phiên bản...</span>
            </section>
          ) : errorMessage ? (
            <div className="admin-quality-history__alert" role="alert">
              <WarningOutlined />
              {errorMessage}
            </div>
          ) : (
            <>
              <section className="aqh-version-detail">
                <header className="aqh-version-detail__header">
                  <div>
                    <span className="aqh-form-code">{getChecklistDisplayCode(form?.code)}</span>
                    <h2>
                      {version?.title || form?.title || 'Quy trình chưa có tiêu đề'}
                      <small>v{version?.versionNumber}</small>
                    </h2>
                    <p>{version?.description || form?.description || 'Chưa có mô tả'}</p>
                  </div>
                  <span className={`aqh-version-status aqh-version-status--${getVersionStatusClass(version?.status)}`}>
                    {getVersionStatusLabel(version?.status)}
                  </span>
                </header>

                <div className="aqh-summary-grid">
                  <article>
                    <span>Kết quả</span>
                    <strong>{summary.total}</strong>
                    <small>Kết quả đã nộp</small>
                  </article>
                  <button
                    className="aqh-summary-manager"
                    onClick={openManagerModal}
                    type="button"
                  >
                    <span><UserSwitchOutlined /> Manager được giao</span>
                    <strong>{managers.length}</strong>
                    <small>Nhấn để quản lý</small>
                  </button>
                  <article>
                    <span>Đạt</span>
                    <strong>{summary.passed}</strong>
                    <small>Không đạt: {summary.failed}</small>
                  </article>
                  <article>
                    <span>Điểm trung bình</span>
                    <strong>{formatScore(summary.averageConvertedScore)}</strong>
                    <small>Điểm quy đổi</small>
                  </article>
                </div>
              </section>

              <section className="aqh-response-panel aqh-response-panel--full">
                  <div className="aqh-panel-heading">
                    <div>
                      <h3>Kết quả của phiên bản</h3>
                      <p>{submissionsLoading ? 'Đang cập nhật danh sách...' : `${submissionData.totalElements} kết quả phù hợp`}</p>
                    </div>
                    <div className="aqh-panel-actions">
                      <label>
                        <FilterOutlined />
                        <select
                          value={resultFilter}
                          onChange={(event) => {
                            setResultFilter(event.target.value)
                            setSubmissionPage(0)
                          }}
                        >
                          {RESULT_OPTIONS.map((option) => (
                            <option key={option.value || 'all'} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="aqh-export-button"
                        disabled={exporting || submissionsLoading || submissionData.totalElements === 0}
                        onClick={exportResponses}
                        type="button"
                      >
                        {exporting ? <LoadingOutlined spin /> : <FileExcelOutlined />}
                        {exporting ? 'Đang xuất...' : 'Xuất Excel'}
                      </button>
                    </div>
                  </div>

                  {exportError && <div className="aqh-export-error" role="alert">{exportError}</div>}

                  {submissionsError ? (
                    <div className="aqh-inline-error" role="alert">
                      <WarningOutlined />
                      <span>{submissionsError}</span>
                    </div>
                  ) : submissionsLoading ? (
                    <div className="aqh-results-loading">
                      <LoadingOutlined spin />
                      <span>Đang tải kết quả...</span>
                    </div>
                  ) : submissionData.content.length === 0 ? (
                    <p>Chưa có kết quả phù hợp với bộ lọc hiện tại.</p>
                  ) : (
                    <>
                      <div className="aqh-response-list">
                        {submissionData.content.map((item) => (
                          <article key={item.id}>
                            <div className="aqh-response-subject">
                              <strong>{item.subject?.fullName || 'Chưa có tên nhân viên'}</strong>
                              <span>{item.subject?.employeeCode || 'Chưa có mã'} · {formatDateTime(item.submittedAt || item.updatedAt)}</span>
                            </div>
                            <span className={`admin-quality-history__badge admin-quality-history__badge--${getResultClass(item.result)}`}>
                              {getResultLabel(item.result)}
                            </span>
                            <strong className="aqh-response-score">{formatScore(item.convertedScore)}</strong>
                            <button
                              className="admin-quality-history__detail-button"
                              onClick={() => navigate(`/admin/quality/history/${item.id}`)}
                              type="button"
                            >
                              <EyeOutlined />
                              Chi tiết
                            </button>
                          </article>
                        ))}
                      </div>

                      <footer className="aqh-pagination">
                        <div className="aqh-pagination__summary">
                          Hiển thị <strong>{resultFrom}–{resultTo}</strong> trong <strong>{submissionData.totalElements}</strong> kết quả
                        </div>
                        <div className="aqh-pagination__controls">
                          <label>
                            Số dòng
                            <select
                              value={submissionPageSize}
                              onChange={(event) => {
                                setSubmissionPageSize(Number(event.target.value))
                                setSubmissionPage(0)
                              }}
                            >
                              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                            </select>
                          </label>
                          <button
                            disabled={submissionData.page <= 0}
                            onClick={() => setSubmissionPage((page) => Math.max(0, page - 1))}
                            type="button"
                          >
                            Trước
                          </button>
                          <div className="aqh-pagination__pages" aria-label="Chọn trang kết quả">
                            {pageItems.map((item) => (
                              typeof item === 'number' ? (
                                <button
                                  aria-current={item === submissionData.page ? 'page' : undefined}
                                  className={item === submissionData.page ? 'is-active' : ''}
                                  key={item}
                                  onClick={() => setSubmissionPage(item)}
                                  type="button"
                                >
                                  {item + 1}
                                </button>
                              ) : <span key={item}>…</span>
                            ))}
                          </div>
                          <button
                            disabled={submissionData.page >= submissionData.totalPages - 1}
                            onClick={() => setSubmissionPage((page) => Math.min(submissionData.totalPages - 1, page + 1))}
                            type="button"
                          >
                            Sau
                          </button>
                        </div>
                      </footer>
                    </>
                  )}
              </section>
            </>
          )}
        </main>
      </div>

      {managerModalOpen && (
        <div
          className="aqh-manager-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !confirmRevoke) setManagerModalOpen(false)
          }}
          role="presentation"
        >
          <section
            aria-labelledby="aqh-manager-modal-title"
            aria-modal="true"
            className="aqh-manager-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="aqh-manager-modal__header">
              <div>
                <span>PHÂN QUYỀN PHIÊN BẢN v{version?.versionNumber}</span>
                <h2 id="aqh-manager-modal-title">Manager được giao</h2>
                <p>Thêm hoặc thu hồi người được phép thực hiện quy trình này.</p>
              </div>
              <button
                aria-label="Đóng cửa sổ quản lý phân quyền"
                className="aqh-manager-modal__close"
                onClick={() => setManagerModalOpen(false)}
                type="button"
              >
                <CloseOutlined />
              </button>
            </header>

            <div className="aqh-manager-modal__body">
              {version?.status === 'PUBLISHED' ? (
                <form className="aqh-manager-assign" onSubmit={submitAssignment}>
                  <div className="aqh-manager-assign__field aqh-manager-assign__field--people">
                    <label htmlFor="aqh-manager-search">Người nhận mới</label>
                    <MultiSearchSelect
                      ariaLabel="Tìm và chọn người nhận mới"
                      disabled={managerBusy || !managerUsersLoaded}
                      emptyMessage="Không còn người nhận phù hợp"
                      id="aqh-manager-search"
                      onChange={setSelectedManagerIds}
                      options={availableManagers.map((manager) => ({
                        value: manager.id,
                        label: getManagerName(manager),
                        description: manager.employeeCode || 'Chưa có mã nhân viên',
                        searchText: `${manager.employeeCode || ''} ${manager.departmentName || manager.department?.name || ''}`,
                      }))}
                      placeholder={managerBusy && !managerUsersLoaded ? 'Đang tải danh sách...' : 'Tìm theo tên hoặc mã nhân viên...'}
                      value={selectedManagerIds}
                    />
                  </div>
                  <div className="aqh-manager-assign__field">
                    <label htmlFor="aqh-manager-valid-until">Hiệu lực đến</label>
                    <input
                      disabled={managerBusy}
                      id="aqh-manager-valid-until"
                      onChange={(event) => setValidUntil(event.target.value)}
                      type="datetime-local"
                      value={validUntil}
                    />
                  </div>
                  <button
                    className="aqh-manager-assign__submit"
                    disabled={managerBusy || effectiveSelectedManagerIds.length === 0}
                    type="submit"
                  >
                    {managerBusy ? <LoadingOutlined spin /> : <PlusOutlined />}
                    Thêm người nhận
                  </button>
                </form>
              ) : (
                <div className="aqh-manager-modal__notice">
                  Phiên bản không còn hoạt động nên không thể thêm phân quyền mới.
                </div>
              )}

              {managerMessage && (
                <div className={`aqh-manager-message aqh-manager-message--${managerMessage.type}`} role="status">
                  {managerMessage.text}
                </div>
              )}

              <div className="aqh-manager-modal__list-heading">
                <div>
                  <h3>Danh sách đang hiệu lực</h3>
                  <p>{managers.length} người đang được giao</p>
                </div>
              </div>

              {managerBusy && !managerUsersLoaded ? (
                <div className="aqh-results-loading"><LoadingOutlined spin /><span>Đang tải danh sách...</span></div>
              ) : managers.length === 0 ? (
                <div className="aqh-manager-empty">
                  <UserSwitchOutlined />
                  <strong>Chưa có người được giao</strong>
                  <span>Chọn người nhận ở phía trên để bắt đầu phân quyền.</span>
                </div>
              ) : (
                <div className="aqh-manager-modal__list">
                  {managers.map((item) => {
                    const managerName = getManagerName(item.manager)
                    return (
                      <article key={item.assignmentItemId}>
                        <span className="aqh-manager-avatar" aria-hidden="true">
                          {managerName.charAt(0).toUpperCase()}
                        </span>
                        <div className="aqh-manager-identity">
                          <strong>{managerName}</strong>
                          <span>{item.manager?.employeeCode || 'Chưa có mã nhân viên'}</span>
                        </div>
                        <div className="aqh-manager-validity">
                          <ClockCircleOutlined />
                          <span>{item.validUntil ? `Đến ${formatDateTime(item.validUntil)}` : 'Không giới hạn'}</span>
                        </div>
                        <button
                          className="aqh-manager-revoke"
                          disabled={managerBusy}
                          onClick={() => setConfirmRevoke(item)}
                          type="button"
                        >
                          <StopOutlined /> Thu hồi
                        </button>
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
    </div>
  )
}

export default AdminQualityHistoryVersionPage
