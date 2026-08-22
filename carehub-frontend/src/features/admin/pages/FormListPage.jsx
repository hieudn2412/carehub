import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DeleteOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  CheckSquareOutlined,
  ImportOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import AppliedFilterToolbar from '../../../shared/components/AppliedFilterToolbar.jsx'
import { adminApi } from '../api/adminApi'
import { resolveChecklistSearchKeyword } from '../utils/formCode.js'
import ConfirmModal from '../../../shared/components/ConfirmModal.jsx'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import '../styles/FormListPage.css'

const PAGE_SIZE = 10

const STATUS_LABELS = {
  PUBLISHED: 'Hoạt động',
  DRAFT: 'Bản nháp',
  RETIRED: 'Đã ngừng',
}
const RETIRED_STATUS = 'RETIRED'
const RETIRED_FORMS_CACHE_KEY = 'carehub.admin.retiredForms'
const ASSIGNMENT_PAGE_SIZE = 100

function normalizeReferenceList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  return []
}

function getAssignmentPage(response) {
  const data = response?.data?.data || {}
  return {
    content: Array.isArray(data.content) ? data.content : [],
    totalPages: Math.max(1, Number(data.totalPages) || 1),
  }
}

async function fetchAllActiveFormAssignments(formId) {
  const firstResponse = await adminApi.getFormAssignmentsByForm(formId, {
    page: 0,
    size: ASSIGNMENT_PAGE_SIZE,
    status: 'ACTIVE',
  })
  const firstPage = getAssignmentPage(firstResponse)
  if (firstPage.totalPages === 1) return firstPage.content

  const remainingResponses = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) => (
      adminApi.getFormAssignmentsByForm(formId, {
        page: index + 1,
        size: ASSIGNMENT_PAGE_SIZE,
        status: 'ACTIVE',
      })
    )),
  )

  return [
    ...firstPage.content,
    ...remainingResponses.flatMap((response) => getAssignmentPage(response).content),
  ]
}

function countLatestVersionAssignees(assignments, form) {
  const versionId = form.currentPublishedVersion?.id
  if (!versionId) return 0

  const assigneeIds = assignments
    .filter((assignment) => (
      String(assignment.formVersionId) === String(versionId)
      && assignment.effectiveStatus === 'ACTIVE'
      && assignment.itemStatus === 'ACTIVE'
    ))
    .map((assignment) => assignment.assignee?.id || assignment.manager?.id)
    .filter(Boolean)
    .map(String)

  return new Set(assigneeIds).size
}

function formatChecklistDate(value) {
  if (!value) return 'Chưa có'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

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

function matchesRetiredFilters(form, { departmentId, keyword }) {
  if (
    departmentId !== 'all'
    && String(form.ownerDepartment?.id || '') !== String(departmentId)
  ) {
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
  const [status, setStatus] = useState('all')
  const [departmentId, setDepartmentId] = useState('all')
  const [appliedFilters, setAppliedFilters] = useState({ keyword: '', status: 'all', departmentId: 'all' })
  const [departments, setDepartments] = useState([])
  const [formStats, setFormStats] = useState({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  useEffect(() => {
    let active = true

    adminApi.getDepartments()
      .then((response) => {
        if (active) setDepartments(normalizeReferenceList(response.data?.data))
      })
      .catch(() => {
        if (active) setDepartments([])
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const nextKeyword = resolveChecklistSearchKeyword(keyword.trim())
    if (nextKeyword === appliedFilters.keyword) return undefined
    const timer = window.setTimeout(() => {
      setErrorMessage('')
      setLoading(true)
      setPage(1)
      setAppliedFilters((current) => (
        current.keyword === nextKeyword ? current : { ...current, keyword: nextKeyword }
      ))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [appliedFilters.keyword, keyword])

  useEffect(() => {
    let ignoreResponse = false
    let keepLoading = false
    const params = {
      page: page - 1,
      size: PAGE_SIZE,
      sort: 'updatedAt,desc',
      keyword: appliedFilters.keyword || undefined,
      status: appliedFilters.status !== 'all' ? appliedFilters.status : undefined,
      ownerDepartmentId: appliedFilters.departmentId !== 'all' ? Number(appliedFilters.departmentId) : undefined,
      includeDeleted: appliedFilters.status === RETIRED_STATUS ? true : undefined,
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
        const nextForms = appliedFilters.status === RETIRED_STATUS
          ? mergeCachedRetiredForms(content, {
            departmentId: appliedFilters.departmentId,
            keyword: appliedFilters.keyword,
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
        setFormStats({})
        setTotalElements(appliedFilters.status === RETIRED_STATUS
          ? Math.max(serverTotalElements, nextForms.length)
          : serverTotalElements)
        setTotalPages(appliedFilters.status === RETIRED_STATUS && nextForms.length > 0
          ? Math.max(nextTotalPages, 1)
          : nextTotalPages)
        setLoading(false)

        const activeForms = nextForms.filter((form) => getEffectiveStatus(form) !== RETIRED_STATUS)
        const [performanceResult, ...assignmentResults] = await Promise.allSettled([
          adminApi.getDashboardFormPerformance({ page: 0, size: 100 }),
          ...activeForms.map((form) => fetchAllActiveFormAssignments(form.id)),
        ])

        if (ignoreResponse) return

        const nextStats = Object.fromEntries(nextForms.map((form) => [form.id, {
          responseCount: 0,
        }]))
        if (performanceResult.status === 'fulfilled') {
          const performanceItems = performanceResult.value.data?.data?.content || []
          performanceItems.forEach((item) => {
            nextStats[item.formId] = {
              ...nextStats[item.formId],
              responseCount: Number(item.submittedCount || item.responseCount || 0),
            }
          })
        }

        assignmentResults.forEach((result, index) => {
          if (result.status !== 'fulfilled') return
          const form = activeForms[index]
          nextStats[form.id] = {
            ...nextStats[form.id],
            activeAssignmentCount: countLatestVersionAssignees(result.value, form),
          }
        })
        setFormStats(nextStats)
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
  }, [appliedFilters, page, refreshKey])

  const visiblePages = useMemo(
    () => getVisiblePages(page, totalPages),
    [page, totalPages],
  )
  const hasFilters = Boolean(appliedFilters.keyword || appliedFilters.status !== 'all' || appliedFilters.departmentId !== 'all')
  const emptyTitle = appliedFilters.status === RETIRED_STATUS
    ? 'Chưa có checklist đã ngừng'
    : hasFilters
      ? 'Không tìm thấy checklist phù hợp'
      : 'Chưa có checklist nào'
  const emptyDescription = appliedFilters.status === RETIRED_STATUS
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

  const updateStatus = (value) => {
    setErrorMessage('')
    setSuccessMessage('')
    setShowRetiredShortcut(false)
    setStatus(value)
  }

  const clearFilters = () => {
    setErrorMessage('')
    setSuccessMessage('')
    setShowRetiredShortcut(false)
    setKeyword('')
    setStatus('all')
    setDepartmentId('all')
    setPage(1)
    setAppliedFilters({ keyword: '', status: 'all', departmentId: 'all' })
  }

  const applyFilters = () => {
    setErrorMessage('')
    setLoading(true)
    setPage(1)
    setAppliedFilters({
      keyword: resolveChecklistSearchKeyword(keyword.trim()),
      status,
      departmentId,
    })
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
      setAppliedFilters((current) => ({ ...current, status: RETIRED_STATUS }))
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
    setAppliedFilters((current) => ({ ...current, status: RETIRED_STATUS }))
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
    <AppShell breadcrumbs={breadcrumbs}>
            <div className="form-list-page">
              <section className="flp-header-card">
                <div className="flp-header-info">
                  <h1 className="flp-title">Danh sách biểu mẫu checklist</h1>
                  <p className="flp-subtitle">
                    Thiết kế và quản trị các quy trình đánh giá chất lượng lâm sàng và an
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

              <AppliedFilterToolbar
                activeCount={[status !== 'all', departmentId !== 'all'].filter(Boolean).length}
                actions={<div className="flp-toolbar-actions">
                    <div
                      className={`flp-import-menu${importMenuOpen ? ' is-open' : ''}`}
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setImportMenuOpen(false)
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
                          <button className="flp-import-menu__option" onClick={navigateToLegacyImport} role="menuitem" type="button">
                            <span className="flp-import-menu__icon"><ImportOutlined /></span>
                            <span><strong>Import 18 form cũ</strong><small>Nạp sẵn danh sách Google Form điều dưỡng 2026.</small></span>
                          </button>
                          <button className="flp-import-menu__option" onClick={navigateToCustomImport} role="menuitem" type="button">
                            <span className="flp-import-menu__icon"><PlusCircleOutlined /></span>
                            <span><strong>Import form mới</strong><small>Nhập mã và link Google Form thủ công như hiện tại.</small></span>
                          </button>
                        </div>
                      )}
                    </div>
                    <button className="flp-btn-create" onClick={() => navigate('/admin/quality/checklists/new')} type="button">
                      <PlusCircleOutlined /> Tạo biểu mẫu mới
                    </button>
                  </div>}
                ariaLabel="Bộ lọc checklist"
                className="flp-toolbar"
                isOpen={isFilterOpen}
                onApply={applyFilters}
                onReset={clearFilters}
                onSearchChange={(value) => { setErrorMessage(''); setKeyword(value) }}
                onToggle={() => setIsFilterOpen((current) => !current)}
                panelClassName="flp-filter-panel"
                panelId="checklist-filter-panel"
                searchAriaLabel="Tìm kiếm checklist"
                searchClassName="flp-search-box"
                searchPlaceholder="Tìm theo mã hoặc tiêu đề..."
                searchValue={keyword}
              >
                    <FilterSelectField
                      className="flp-filter-group"
                      label="Trạng thái"
                      onChange={updateStatus}
                      value={status}
                      options={[{ value: 'all', label: 'Tất cả trạng thái' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]}
                      placeholder="Tất cả trạng thái"
                    />
                    <FilterSelectField
                          className="flp-filter-group flp-department-filter"
                          label="Khoa/phòng"
                          onChange={(value) => {
                            setErrorMessage('')
                            setDepartmentId(value)
                          }}
                          value={departmentId}
                          options={[
                            { value: 'all', label: 'Tất cả khoa/phòng' },
                            ...departments.map((department) => ({
                              value: department.id,
                              label: department.name || department.code,
                            })),
                          ]}
                          placeholder="Tất cả khoa/phòng"
                          searchable
                          searchPlaceholder="Tìm tên khoa/phòng..."
                        />
              </AppliedFilterToolbar>

              <section className="flp-table-card" aria-busy={loading}>
                <div className="flp-table-scroll">
                  <table className="flp-table">
                    <thead>
                      <tr>
                        <th className="flp-col-name">Tên quy trình</th>
                        <th className="flp-col-version">Phiên bản</th>
                        <th className="flp-col-created">Ngày tạo</th>
                        <th className="flp-col-assignees">Người được giao</th>
                        <th className="flp-col-responses">Lượt đánh giá</th>
                        <th className="flp-col-score">Điểm sàn</th>
                        <th className="flp-col-status">Trạng thái</th>
                        <th className="flp-col-actions flp-table__actions-heading">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td className="flp-table-empty" colSpan="8">
                            <LoadingOutlined spin /> Đang tải danh sách checklist...
                          </td>
                        </tr>
                      ) : forms.length === 0 ? (
                        <tr>
                          <td className="flp-table-empty" colSpan="8">
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
                            <td className="flp-col-name">
                              <div className="flp-form-title-wrapper">
                                <span className="flp-form-title">{form.title}</span>
                                {form.description && (
                                  <span className="flp-form-desc">{form.description}</span>
                                )}
                              </div>
                            </td>
                            <td className="flp-col-version">
                              {form.currentPublishedVersion ? (
                                <span className="flp-version-badge">
                                  v{form.currentPublishedVersion.versionNumber}
                                </span>
                              ) : (
                                <span className="flp-text-muted">Chưa có</span>
                              )}
                            </td>
                            <td className="flp-col-created">
                              <span className="flp-date-stack">{formatChecklistDate(form.createdAt)}</span>
                            </td>
                            <td className="flp-col-assignees">
                              <button
                                className="flp-stat-link"
                                onClick={() => navigate(`/admin/quality/checklist-assignments?formId=${form.id}`)}
                                title={`Quản lý người được giao ${form.title}`}
                                type="button"
                              >
                                <strong>{formStats[form.id]?.activeAssignmentCount ?? '—'}</strong>
                                <span>Quản lý</span>
                              </button>
                            </td>
                            <td className="flp-col-responses">{formStats[form.id]?.responseCount ?? '—'}</td>
                            <td className="flp-col-score">
                              {form.currentPublishedVersion?.passingScore !== undefined && form.currentPublishedVersion?.passingScore !== null ? (
                                <strong style={{ color: '#0f6e56', fontWeight: 600 }}>
                                  {Number(form.currentPublishedVersion.passingScore).toFixed(1)}/10
                                </strong>
                              ) : (
                                <span className="flp-text-muted">—</span>
                              )}
                            </td>
                            <td className="flp-col-status">
                              <span
                                className={`form-badge ${getStatusBadgeClass(getEffectiveStatus(form))}`}
                              >
                                {STATUS_LABELS[getEffectiveStatus(form)] || getEffectiveStatus(form)}
                              </span>
                            </td>
                            <td className="flp-col-actions">
                              <div className="flp-actions-cell admin-table-actions">
                                {form.currentPublishedVersion?.id && (
                                  <button
                                    aria-label={`Thực hiện đánh giá ${form.title}`}
                                    className="flp-btn-action flp-btn-evaluate admin-table-action admin-table-action--icon admin-table-action--success"
                                    onClick={() => navigate(`/admin/quality/checklists/${form.id}/evaluate/${form.currentPublishedVersion.id}`)}
                                    title="Thực hiện đánh giá trực tiếp"
                                    type="button"
                                  >
                                    <CheckSquareOutlined />
                                  </button>
                                )}
                                <button
                                  aria-label={`Xem chi tiết ${form.title}`}
                                  className="flp-btn-action flp-btn-detail admin-table-action admin-table-action--icon admin-table-action--primary"
                                  onClick={() =>
                                    navigate(`/admin/quality/checklists/${form.id}/detail`)
                                  }
                                  title="Xem nội dung bảng kiểm"
                                  type="button"
                                >
                                  <EyeOutlined />
                                </button>
                                {getEffectiveStatus(form) !== 'RETIRED' && (
                                  <button
                                    aria-label={`Ngừng hoạt động ${form.title}`}
                                    className="flp-btn-action flp-btn-delete admin-table-action admin-table-action--icon admin-table-action--danger"
                                    disabled={deletingFormId === form.id}
                                    onClick={() => handleRetire(form)}
                                    title="Ngừng hoạt động"
                                    type="button"
                                  >
                                    {deletingFormId === form.id ? (
                                      <LoadingOutlined spin />
                                    ) : (
                                      <DeleteOutlined />
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
    </AppShell>
  )
}

export default FormListPage
