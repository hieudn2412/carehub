import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DeleteOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  ImportOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import {
  getChecklistDisplayCode,
  resolveChecklistSearchKeyword,
} from '../utils/formCode.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import '../styles/FormListPage.css'

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 400

const SUBJECT_TYPE_LABELS = {
  USER: 'Nhân viên',
  PATIENT: 'Bệnh nhân',
  PROCESS: 'Quy trình',
  ROOM: 'Phòng bệnh',
  DEPARTMENT: 'Khoa phòng',
}

const STATUS_LABELS = {
  PUBLISHED: 'Hoạt động',
  DRAFT: 'Bản nháp',
  RETIRED: 'Đã ngừng',
}
const RETIRED_STATUS = 'RETIRED'
const RETIRED_FORMS_CACHE_KEY = 'carehub.admin.retiredForms'

function getEffectiveStatus(form) {
  return form?.deleted || form?.isDeleted ? RETIRED_STATUS : form?.status
}

function normalizeRetiredForm(form) {
  return {
    ...form,
    status: RETIRED_STATUS,
    deleted: true,
    isDeleted: true,
    retiredAt: new Date().toISOString(),
  }
}

function readRetiredFormsCache() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(RETIRED_FORMS_CACHE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRetiredFormsCache(forms) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(RETIRED_FORMS_CACHE_KEY, JSON.stringify(forms.slice(0, 50)))
  } catch {
    // Cache is only a frontend convenience while backend does not expose deleted forms.
  }
}

function rememberRetiredForm(form) {
  const retiredForm = normalizeRetiredForm(form)
  const existingForms = readRetiredFormsCache()
  const nextForms = [
    retiredForm,
    ...existingForms.filter((item) => item.id !== retiredForm.id),
  ]
  writeRetiredFormsCache(nextForms)
  return retiredForm
}

function matchesRetiredFilters(form, { keyword, subjectType }) {
  const matchesSubject = subjectType === 'all' || form.subjectType === subjectType
  if (!matchesSubject) {
    return false
  }

  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) {
    return true
  }

  return [form.code, form.title, form.description]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedKeyword))
}

function mergeCachedRetiredForms(forms, filters) {
  const cachedForms = readRetiredFormsCache()
    .filter((form) => matchesRetiredFilters(form, filters))

  const formIds = new Set(forms.map((form) => form.id))
  const missingCachedForms = cachedForms.filter((form) => !formIds.has(form.id))

  return [...forms, ...missingCachedForms]
}

function getChecklistErrorMessage(error) {
  const statusCode = error?.response?.status

  if (!error?.response) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend và thử lại.'
  }

  if (statusCode === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  }

  if (statusCode === 403) {
    return 'Bạn không có quyền xem danh sách checklist.'
  }

  return 'Không thể tải danh sách checklist. Vui lòng thử lại sau.'
}

function getVisiblePages(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const startPage = Math.min(Math.max(currentPage - 2, 1), totalPages - 4)
  return Array.from({ length: 5 }, (_, index) => startPage + index)
}

function FormListPage() {
  const navigate = useNavigate()
  
  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    form: null
  })
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [showRetiredShortcut, setShowRetiredShortcut] = useState(false)
  const [deletingFormId, setDeletingFormId] = useState(null)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [status, setStatus] = useState('all')
  const [subjectType, setSubjectType] = useState('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [importMenuOpen, setImportMenuOpen] = useState(false)

  useEffect(() => {
    const normalizedKeyword = keyword.trim()
    const resolvedKeyword = resolveChecklistSearchKeyword(normalizedKeyword)

    if (resolvedKeyword === debouncedKeyword) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setLoading(true)
      setDebouncedKeyword(resolvedKeyword)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [debouncedKeyword, keyword])

  useEffect(() => {
    let ignoreResponse = false
    let keepLoading = false
    const params = {
      page: page - 1,
      size: PAGE_SIZE,
      sort: 'updatedAt,desc',
      keyword: debouncedKeyword || undefined,
      status: status !== 'all' ? status : undefined,
      includeDeleted: status === RETIRED_STATUS ? true : undefined,
      subjectType: subjectType !== 'all' ? subjectType : undefined,
    }

    const loadForms = async () => {
      try {
        const response = await adminApi.getForms(params)
        if (ignoreResponse) {
          return
        }

        const pageData = response.data?.data
        if (!Array.isArray(pageData?.content)) {
          throw new Error('Invalid checklist list response')
        }

        const content = pageData.content
        const nextForms = status === RETIRED_STATUS
          ? mergeCachedRetiredForms(content, {
            keyword: debouncedKeyword,
            subjectType,
          })
          : content
        const serverTotalElements = Number(pageData.totalElements) || 0
        const nextTotalPages = Number(pageData.totalPages) || 0
        if (nextTotalPages > 0 && page > nextTotalPages) {
          keepLoading = true
          setPage(nextTotalPages)
          return
        }

        setForms(nextForms)
        setTotalElements(status === RETIRED_STATUS
          ? Math.max(serverTotalElements, nextForms.length)
          : serverTotalElements)
        setTotalPages(status === RETIRED_STATUS && nextForms.length > 0
          ? Math.max(nextTotalPages, 1)
          : nextTotalPages)
      } catch (error) {
        if (ignoreResponse) {
          return
        }

        setForms([])
        setTotalElements(0)
        setTotalPages(0)
        setErrorMessage(getChecklistErrorMessage(error))
      } finally {
        if (!ignoreResponse && !keepLoading) {
          setLoading(false)
        }
      }
    }

    loadForms()

    return () => {
      ignoreResponse = true
    }
  }, [debouncedKeyword, page, refreshKey, status, subjectType])

  const visiblePages = useMemo(
    () => getVisiblePages(page, totalPages),
    [page, totalPages],
  )
  const hasFilters = Boolean(keyword || status !== 'all' || subjectType !== 'all')
  const emptyTitle = status === RETIRED_STATUS
    ? 'Chưa có checklist đã ngừng'
    : hasFilters
      ? 'Không tìm thấy checklist phù hợp'
      : 'Chưa có checklist nào'
  const emptyDescription = status === RETIRED_STATUS
    ? 'Checklist vừa ngừng trên máy này sẽ được giữ tạm ở đây. Nếu tải lại mà mất, backend cần hỗ trợ trả các form đã xóa mềm.'
    : hasFilters
      ? 'Hãy thử thay đổi từ khóa hoặc bộ lọc.'
      : 'Tạo biểu mẫu đầu tiên để bắt đầu quản lý checklist.'

  const updatePage = (nextPage) => {
    if (nextPage === page || nextPage < 1 || nextPage > totalPages) {
      return
    }

    setErrorMessage('')
    setLoading(true)
    setPage(nextPage)
  }

  const updateStatus = (event) => {
    setErrorMessage('')
    setSuccessMessage('')
    setShowRetiredShortcut(false)
    setLoading(true)
    setStatus(event.target.value)
    setPage(1)
  }

  const updateSubjectType = (event) => {
    setErrorMessage('')
    setSuccessMessage('')
    setShowRetiredShortcut(false)
    setLoading(true)
    setSubjectType(event.target.value)
    setPage(1)
  }

  const clearFilters = () => {
    setErrorMessage('')
    setSuccessMessage('')
    setShowRetiredShortcut(false)
    setLoading(true)
    setKeyword('')
    setDebouncedKeyword('')
    setStatus('all')
    setSubjectType('all')
    setPage(1)
  }

  const retryLoad = () => {
    setErrorMessage('')
    setLoading(true)
    setRefreshKey((current) => current + 1)
  }

  const handleRetire = async (form) => {
    setConfirmModal({
      isOpen: true,
      form
    })
  }

  const executeRetire = async (form) => {

    try {
      setDeletingFormId(form.id)
      setErrorMessage('')
      setSuccessMessage('')
      setShowRetiredShortcut(false)
      await adminApi.deleteForm(form.id)
      rememberRetiredForm(form)
      setSuccessMessage(`Đã ngừng hoạt động checklist "${form.title}" và chuyển sang danh sách đã ngừng.`)
      setLoading(true)
      setStatus(RETIRED_STATUS)
      setPage(1)
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setErrorMessage(getChecklistErrorMessage(error))
    } finally {
      setDeletingFormId(null)
    }
  }

  const getStatusBadgeClass = (formStatus) => {
    const statusClass = formStatus?.toLowerCase()
    return STATUS_LABELS[formStatus] ? `form-badge--${statusClass}` : 'form-badge--gray'
  }

  const viewRetiredForms = () => {
    setErrorMessage('')
    setStatus(RETIRED_STATUS)
    setPage(1)
    setLoading(true)
    setShowRetiredShortcut(false)
  }

  const navigateToLegacyImport = () => {
    setImportMenuOpen(false)
    navigate('/admin/form-imports/new?preset=legacy-18')
  }

  const navigateToCustomImport = () => {
    setImportMenuOpen(false)
    navigate('/admin/form-imports/new')
  }

  const breadcrumbs = [{ label: 'Quản lý chất lượng' }, { label: 'Danh sách checklist' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="form-list-page">
              <section className="flp-header-card">
                <div className="flp-header-info">
                  <h1 className="flp-title">Danh sách biểu mẫu checklist</h1>
                  <p className="flp-subtitle">
                    Thiết kế và quản trị các bảng kiểm đánh giá chất lượng lâm sàng và an
                    toàn người bệnh
                  </p>
                </div>
                <div className="flp-header-actions">
                  <div
                    className={`flp-import-menu${importMenuOpen ? ' is-open' : ''}`}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setImportMenuOpen(false)
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        setImportMenuOpen(false)
                      }
                    }}
                  >
                    <button
                      aria-expanded={importMenuOpen}
                      aria-haspopup="menu"
                      className="flp-btn-import"
                      onClick={() => setImportMenuOpen((current) => !current)}
                      type="button"
                    >
                      <ImportOutlined /> Import Google Form
                      <DownOutlined className="flp-btn-import__chevron" />
                    </button>

                    {importMenuOpen && (
                      <div className="flp-import-menu__panel" role="menu">
                        <button
                          className="flp-import-menu__option"
                          onClick={navigateToLegacyImport}
                          role="menuitem"
                          type="button"
                        >
                          <span className="flp-import-menu__icon">
                            <ImportOutlined />
                          </span>
                          <span>
                            <strong>Import 18 form cũ</strong>
                            <small>Nạp sẵn danh sách Google Form điều dưỡng 2026.</small>
                          </span>
                        </button>
                        <button
                          className="flp-import-menu__option"
                          onClick={navigateToCustomImport}
                          role="menuitem"
                          type="button"
                        >
                          <span className="flp-import-menu__icon">
                            <PlusCircleOutlined />
                          </span>
                          <span>
                            <strong>Import form mới</strong>
                            <small>Nhập mã và link Google Form thủ công như hiện tại.</small>
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    className="flp-btn-create"
                    onClick={() => navigate('/admin/quality/checklists/new')}
                    type="button"
                  >
                    <PlusCircleOutlined /> Tạo biểu mẫu mới
                  </button>
                </div>
              </section>

              {errorMessage && (
                <div className="flp-feedback flp-feedback--error" role="alert">
                  <ExclamationCircleOutlined />
                  <span>{errorMessage}</span>
                  <button onClick={retryLoad} type="button">
                    <ReloadOutlined /> Thử lại
                  </button>
                </div>
              )}

              {successMessage && (
                <div className="flp-feedback flp-feedback--success" role="status">
                  <span>{successMessage}</span>
                  {showRetiredShortcut && (
                    <button onClick={viewRetiredForms} type="button">
                      Xem danh sách đã ngừng
                    </button>
                  )}
                  <button
                    aria-label="Đóng thông báo"
                    onClick={() => {
                      setSuccessMessage('')
                      setShowRetiredShortcut(false)
                    }}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              )}

              <section className="flp-toolbar" aria-label="Bộ lọc checklist">
                <div className="flp-search-box">
                  <SearchOutlined className="flp-search-icon" />
                  <input
                    aria-label="Tìm kiếm checklist"
                    className="flp-search-input"
                    onChange={(event) => {
                      setErrorMessage('')
                      setKeyword(event.target.value)
                      setPage(1)
                    }}
                    placeholder="Tìm theo mã hoặc tiêu đề..."
                    type="search"
                    value={keyword}
                  />
                </div>

                <div className="flp-filters">
                  <label className="flp-filter-group">
                    <span>Đối tượng</span>
                    <select
                      className="flp-select"
                      onChange={updateSubjectType}
                      value={subjectType}
                    >
                      <option value="all">Tất cả đối tượng</option>
                      {Object.entries(SUBJECT_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flp-filter-group">
                    <span>Trạng thái</span>
                    <select className="flp-select" onChange={updateStatus} value={status}>
                      <option value="all">Tất cả trạng thái</option>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {hasFilters && (
                    <button className="flp-clear-filters" onClick={clearFilters} type="button">
                      Xóa bộ lọc
                    </button>
                  )}
                </div>
              </section>

              <section className="flp-table-card" aria-busy={loading}>
                <div className="flp-table-scroll">
                  <table className="flp-table">
                    <thead>
                      <tr>
                        <th>Mã biểu mẫu</th>
                        <th>Tiêu đề biểu mẫu</th>
                        <th>Đối tượng</th>
                        <th>Đơn vị sở hữu</th>
                        <th>Phiên bản hiện tại</th>
                        <th>Trạng thái</th>
                        <th className="flp-table__actions-heading">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td className="flp-table-empty" colSpan="7">
                            <LoadingOutlined spin /> Đang tải danh sách checklist...
                          </td>
                        </tr>
                      ) : forms.length === 0 ? (
                        <tr>
                          <td className="flp-table-empty" colSpan="7">
                            <strong>{emptyTitle}</strong>
                            <span>{emptyDescription}</span>
                            {hasFilters && (
                              <button onClick={clearFilters} type="button">
                                Xóa bộ lọc
                              </button>
                            )}
                          </td>
                        </tr>
                      ) : (
                        forms.map((form) => (
                          <tr key={form.id}>
                            <td>
                              <span
                                className="flp-form-code"
                                title={`Mã hệ thống: ${form.code}`}
                              >
                                {getChecklistDisplayCode(form.code)}
                              </span>
                            </td>
                            <td>
                              <div className="flp-form-title-wrapper">
                                <span className="flp-form-title">{form.title}</span>
                                {form.description && (
                                  <span className="flp-form-desc">{form.description}</span>
                                )}
                              </div>
                            </td>
                            <td>{SUBJECT_TYPE_LABELS[form.subjectType] || form.subjectType}</td>
                            <td>
                              {form.ownerDepartment ? (
                                <span
                                  className="flp-dept-tag"
                                  title={form.ownerDepartment.name}
                                >
                                  {form.ownerDepartment.code}
                                </span>
                              ) : (
                                <span className="flp-text-muted">Chưa gán</span>
                              )}
                            </td>
                            <td>
                              {form.currentPublishedVersion ? (
                                <span className="flp-version-badge">
                                  v{form.currentPublishedVersion.versionNumber}
                                </span>
                              ) : (
                                <span className="flp-text-muted">Chưa có</span>
                              )}
                            </td>
                            <td>
                              <span
                                className={`form-badge ${getStatusBadgeClass(getEffectiveStatus(form))}`}
                              >
                                {STATUS_LABELS[getEffectiveStatus(form)] || getEffectiveStatus(form)}
                              </span>
                            </td>
                            <td>
                              <div className="flp-actions-cell">
                                <button
                                  className="flp-btn-action flp-btn-detail"
                                  onClick={() =>
                                    navigate(`/admin/quality/checklists/${form.id}/detail`)
                                  }
                                  title="Xem nội dung checklist"
                                  type="button"
                                >
                                  <EyeOutlined /> Chi tiết
                                </button>
                                {getEffectiveStatus(form) !== 'RETIRED' && (
                                  <button
                                    aria-label={`Ngừng hoạt động ${form.title}`}
                                    className="flp-btn-action flp-btn-delete"
                                    disabled={deletingFormId === form.id}
                                    onClick={() => handleRetire(form)}
                                    title="Ngừng hoạt động"
                                    type="button"
                                  >
                                    {deletingFormId === form.id ? (
                                      <LoadingOutlined spin />
                                    ) : (
                                      <>
                                        <DeleteOutlined /> Ngừng
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {!loading && !errorMessage && totalElements > 0 && (
                  <div className="flp-pagination">
                    <span className="flp-pagination-summary">
                      Hiển thị <strong>{forms.length}</strong> trên tổng số{' '}
                      <strong>{totalElements}</strong> kết quả
                    </span>
                    {totalPages > 1 && (
                      <nav className="flp-pagination-buttons" aria-label="Phân trang checklist">
                        <button
                          className="flp-pg-btn"
                          disabled={page === 1}
                          onClick={() => updatePage(page - 1)}
                          type="button"
                        >
                          Trước
                        </button>
                        {visiblePages.map((pageNumber) => (
                          <button
                            aria-current={page === pageNumber ? 'page' : undefined}
                            className={`flp-pg-btn ${page === pageNumber ? 'active' : ''}`}
                            key={pageNumber}
                            onClick={() => updatePage(pageNumber)}
                            type="button"
                          >
                            {pageNumber}
                          </button>
                        ))}
                        <button
                          className="flp-pg-btn"
                          disabled={page === totalPages}
                          onClick={() => updatePage(page + 1)}
                          type="button"
                        >
                          Sau
                        </button>
                      </nav>
                    )}
                  </div>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Ngừng hoạt động checklist"
        message={confirmModal.form ? `Ngừng hoạt động checklist "${confirmModal.form.title}"? Checklist sẽ không còn xuất hiện trong danh sách hoạt động.` : ''}
        danger={true}
        onConfirm={() => {
          executeRetire(confirmModal.form)
          setConfirmModal({ isOpen: false, form: null })
        }}
        onCancel={() => setConfirmModal({ isOpen: false, form: null })}
      />
    </div>
  )
}

export default FormListPage
