import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DeleteOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FilterOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  ImportOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import { adminApi } from '../api/adminApi'
import {
  getChecklistDisplayCode,
  resolveChecklistSearchKeyword,
} from '../utils/formCode.js'
import ConfirmModal from '../../../shared/components/ConfirmModal.jsx'
import FormVersionAssignmentModal from '../components/FormVersionAssignmentModal.jsx'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import DateTimePicker24h from '../../../shared/components/DateTimePicker24h.jsx'
import '../styles/FormListPage.css'

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 400

const STATUS_LABELS = {
  PUBLISHED: 'Hoạt động',
  DRAFT: 'Bản nháp',
  RETIRED: 'Đã ngừng',
}
const RETIRED_STATUS = 'RETIRED'
const RETIRED_FORMS_CACHE_KEY = 'carehub.admin.retiredForms'
const ASSIGNMENT_PAGE_SIZE = 100
const RECIPIENT_SEARCH_DEBOUNCE_MS = 300

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

async function fetchAllPages(fetcher, params = {}) {
  const firstResponse = await fetcher({ ...params, page: 0, size: ASSIGNMENT_PAGE_SIZE })
  const firstPage = getAssignmentPage(firstResponse)
  if (firstPage.totalPages === 1) return firstPage.content

  const remainingResponses = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) => (
      fetcher({ ...params, page: index + 1, size: ASSIGNMENT_PAGE_SIZE })
    )),
  )

  return [
    ...firstPage.content,
    ...remainingResponses.flatMap((response) => getAssignmentPage(response).content),
  ]
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

function formatAssignmentDateTime(value) {
  if (!value) return 'Không giới hạn'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Không giới hạn'
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
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

function getAssignmentErrorMessage(error) {
  const statusCode = error?.response?.status

  if (!error?.response) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend và thử lại.'
  }

  if (statusCode === 400) {
    return 'Dữ liệu phân quyền không hợp lệ. Chỉ có thể giao các checklist đã công bố.'
  }

  if (statusCode === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  }

  if (statusCode === 403) {
    return 'Bạn không có quyền phân quyền checklist.'
  }

  if (statusCode === 409) {
    return 'Người nhận này đang có phân quyền hiệu lực cho một trong các checklist đã chọn.'
  }

  return error?.response?.data?.message || 'Không thể phân quyền checklist. Vui lòng thử lại.'
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
  const [departmentId, setDepartmentId] = useState('all')
  const [departments, setDepartments] = useState([])
  const [formStats, setFormStats] = useState({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [assignmentSubmitting, setAssignmentSubmitting] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [assignmentMessage, setAssignmentMessage] = useState(null)
  const [assignableForms, setAssignableForms] = useState([])
  const [recipientOptions, setRecipientOptions] = useState([])
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipientLoading, setRecipientLoading] = useState(false)
  const [recipientSearchError, setRecipientSearchError] = useState(false)
  const [selectedRecipientId, setSelectedRecipientId] = useState('')
  const [selectedRecipient, setSelectedRecipient] = useState(null)
  const [recipientAssignments, setRecipientAssignments] = useState([])
  const [recipientAssignmentsLoading, setRecipientAssignmentsLoading] = useState(false)
  const [selectedFormVersionIds, setSelectedFormVersionIds] = useState([])
  const [assignmentValidFrom, setAssignmentValidFrom] = useState('')
  const [assignmentValidUntil, setAssignmentValidUntil] = useState('')
  const [confirmAssignmentRevoke, setConfirmAssignmentRevoke] = useState(null)
  const [permissionForm, setPermissionForm] = useState(null)
  const recipientSearchRequestRef = useRef(0)
  const recipientAssignmentsRequestRef = useRef(0)

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
      ownerDepartmentId: departmentId !== 'all' ? Number(departmentId) : undefined,
      includeDeleted: status === RETIRED_STATUS ? true : undefined,
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
            departmentId,
            keyword: debouncedKeyword,
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
        setTotalElements(status === RETIRED_STATUS
          ? Math.max(serverTotalElements, nextForms.length)
          : serverTotalElements)
        setTotalPages(status === RETIRED_STATUS && nextForms.length > 0
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
  }, [debouncedKeyword, departmentId, page, refreshKey, status])

  const visiblePages = useMemo(
    () => getVisiblePages(page, totalPages),
    [page, totalPages],
  )
  const hasFilters = Boolean(keyword || status !== 'all' || departmentId !== 'all')
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

  const clearFilters = () => {
    setErrorMessage('')
    setSuccessMessage('')
    setShowRetiredShortcut(false)
    setLoading(true)
    setKeyword('')
    setDebouncedKeyword('')
    setStatus('all')
    setDepartmentId('all')
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

  const loadAssignmentOptions = async () => {
    setAssignmentLoading(true)
    setAssignmentError('')
    setAssignmentMessage(null)

    try {
      const formContent = await fetchAllPages(
        (params) => adminApi.getForms(params),
        {
          status: 'PUBLISHED',
          sort: 'updatedAt,desc',
        },
      )
      const publishedForms = formContent.filter((form) =>
        getEffectiveStatus(form) === 'PUBLISHED' && form.currentPublishedVersion?.id,
      )

      setAssignableForms(publishedForms)
      setSelectedRecipientId('')
      setSelectedRecipient(null)
      setRecipientAssignments([])
      setSelectedFormVersionIds([])
      setAssignmentValidFrom('')
      setAssignmentValidUntil('')
    } catch (error) {
      setAssignmentError(getAssignmentErrorMessage(error))
      setAssignableForms([])
      setSelectedRecipientId('')
      setSelectedRecipient(null)
      setSelectedFormVersionIds([])
    } finally {
      setAssignmentLoading(false)
    }
  }

  const openAssignmentModal = () => {
    setRecipientSearch('')
    setRecipientOptions([])
    setRecipientSearchError(false)
    setAssignmentModalOpen(true)
    loadAssignmentOptions()
  }

  const closeAssignmentModal = () => {
    if (assignmentSubmitting || confirmAssignmentRevoke) {
      return
    }

    setAssignmentModalOpen(false)
    setAssignmentError('')
    setAssignmentMessage(null)
  }

  useEffect(() => {
    if (!assignmentModalOpen) return undefined

    const requestId = recipientSearchRequestRef.current + 1
    recipientSearchRequestRef.current = requestId
    const timer = window.setTimeout(async () => {
      setRecipientLoading(true)
      setRecipientSearchError(false)
      try {
        const response = await adminApi.getUsers({
          page: 0,
          size: 20,
          status: 'ACTIVE',
          keyword: recipientSearch.trim() || undefined,
        })
        if (recipientSearchRequestRef.current !== requestId) return
        setRecipientOptions(response.data?.data?.content || [])
      } catch {
        if (recipientSearchRequestRef.current === requestId) {
          setRecipientOptions([])
          setRecipientSearchError(true)
        }
      } finally {
        if (recipientSearchRequestRef.current === requestId) setRecipientLoading(false)
      }
    }, RECIPIENT_SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [assignmentModalOpen, recipientSearch])

  const loadRecipientAssignments = async (recipientId) => {
    if (!recipientId) {
      setRecipientAssignments([])
      return []
    }

    const requestId = recipientAssignmentsRequestRef.current + 1
    recipientAssignmentsRequestRef.current = requestId
    setRecipientAssignmentsLoading(true)
    try {
      const assignments = await fetchAllPages(
        (params) => adminApi.getFormAssignments(params),
        { managerId: Number(recipientId) },
      )
      if (recipientAssignmentsRequestRef.current !== requestId) return []
      setRecipientAssignments(assignments)
      return assignments
    } catch {
      if (recipientAssignmentsRequestRef.current === requestId) {
        setRecipientAssignments([])
        setAssignmentMessage({
          type: 'error',
          text: 'Không thể tải trạng thái phân quyền của người nhận. Vui lòng thử lại.',
        })
      }
      return []
    } finally {
      if (recipientAssignmentsRequestRef.current === requestId) {
        setRecipientAssignmentsLoading(false)
      }
    }
  }

  const assignedByVersionId = useMemo(() => {
    const result = new Map()
    recipientAssignments.forEach((assignment) => {
      if (assignment.status !== 'ACTIVE') return
      ;(assignment.items || []).forEach((item) => {
        if (item.status !== 'ACTIVE' || result.has(String(item.formVersionId))) return
        result.set(String(item.formVersionId), {
          ...item,
          assignmentId: assignment.id,
          validFrom: assignment.validFrom,
          validUntil: assignment.validUntil,
          assignedAt: assignment.assignedAt,
        })
      })
    })
    return result
  }, [recipientAssignments])

  const displayedAssignableForms = useMemo(() => (
    [...assignableForms].sort((left, right) => {
      const leftAssigned = assignedByVersionId.has(String(left.currentPublishedVersion?.id))
      const rightAssigned = assignedByVersionId.has(String(right.currentPublishedVersion?.id))
      if (leftAssigned !== rightAssigned) return leftAssigned ? -1 : 1
      return String(left.title || '').localeCompare(String(right.title || ''), 'vi')
    })
  ), [assignableForms, assignedByVersionId])

  const unassignedVersionIds = useMemo(() => (
    assignableForms
      .map((form) => String(form.currentPublishedVersion?.id || ''))
      .filter((versionId) => versionId && !assignedByVersionId.has(versionId))
  ), [assignableForms, assignedByVersionId])
  const assignedCurrentVersionCount = assignableForms.length - unassignedVersionIds.length

  const toggleAssignableForm = (versionId) => {
    setSelectedFormVersionIds((current) =>
      current.includes(versionId)
        ? current.filter((id) => id !== versionId)
        : [...current, versionId],
    )
  }

  const toggleAllAssignableForms = () => {
    setSelectedFormVersionIds((current) =>
      unassignedVersionIds.length > 0 && current.length === unassignedVersionIds.length
        ? []
        : unassignedVersionIds,
    )
  }

  const submitAssignment = async (event) => {
    event.preventDefault()
    setAssignmentError('')
    setAssignmentMessage(null)

    if (!selectedRecipientId) {
      setAssignmentMessage({ type: 'error', text: 'Vui lòng chọn người nhận phân quyền.' })
      return
    }

    if (selectedFormVersionIds.length === 0) {
      setAssignmentMessage({ type: 'error', text: 'Vui lòng chọn ít nhất một checklist.' })
      return
    }

    if (
      assignmentValidFrom
      && assignmentValidUntil
      && new Date(assignmentValidFrom) >= new Date(assignmentValidUntil)
    ) {
      setAssignmentMessage({ type: 'error', text: 'Thời gian kết thúc phải sau thời gian bắt đầu.' })
      return
    }

    try {
      setAssignmentSubmitting(true)
      await adminApi.createFormAssignment({
        assigneeIds: [Number(selectedRecipientId)],
        validFrom: assignmentValidFrom
          ? new Date(assignmentValidFrom).toISOString()
          : undefined,
        validUntil: assignmentValidUntil
          ? new Date(assignmentValidUntil).toISOString()
          : undefined,
        formVersionIds: selectedFormVersionIds.map(Number),
      })

      const assignedCount = selectedFormVersionIds.length
      setSelectedFormVersionIds([])
      await loadRecipientAssignments(selectedRecipientId)
      setAssignmentMessage({
        type: 'success',
        text: `Đã giao ${assignedCount} biểu mẫu cho ${selectedRecipient?.fullName || selectedRecipient?.employeeCode || 'người nhận'}.`,
      })
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setAssignmentMessage({ type: 'error', text: getAssignmentErrorMessage(error) })
    } finally {
      setAssignmentSubmitting(false)
    }
  }

  const revokeRecipientAssignment = async () => {
    if (!confirmAssignmentRevoke?.assignmentItemId) return
    try {
      setAssignmentSubmitting(true)
      setAssignmentMessage(null)
      await adminApi.revokeFormAssignmentItem(confirmAssignmentRevoke.assignmentItemId)
      await loadRecipientAssignments(selectedRecipientId)
      setAssignmentMessage({
        type: 'success',
        text: `Đã thu hồi biểu mẫu "${confirmAssignmentRevoke.title}".`,
      })
      setConfirmAssignmentRevoke(null)
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setAssignmentMessage({ type: 'error', text: getAssignmentErrorMessage(error) })
    } finally {
      setAssignmentSubmitting(false)
    }
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
                  <button
                    className="flp-btn-assign"
                    onClick={openAssignmentModal}
                    type="button"
                  >
                    <UserSwitchOutlined /> Giao checklist
                  </button>
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
                <div className="flp-toolbar-main">
                  <div className="flp-search-filter-group">
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
                    <button
                      type="button"
                      className={`flp-filter-trigger${isFilterOpen ? ' is-open' : ''}`}
                      aria-expanded={isFilterOpen}
                      aria-controls="checklist-filter-panel"
                      onClick={() => setIsFilterOpen((current) => !current)}
                    >
                      <FilterOutlined /> Bộ lọc
                      {[status !== 'all', departmentId !== 'all'].filter(Boolean).length > 0 && (
                        <span className="flp-filter-count">
                          {[status !== 'all', departmentId !== 'all'].filter(Boolean).length}
                        </span>
                      )}
                    </button>
                  </div>
                  <div className="flp-toolbar-actions">
                    <button className="flp-btn-assign" onClick={openAssignmentModal} type="button">
                      <UserSwitchOutlined /> Giao checklist
                    </button>
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
                  </div>
                </div>

                {isFilterOpen && (
                  <div className="flp-filter-panel" id="checklist-filter-panel">
                    <label className="flp-filter-group">
                      <span>Trạng thái</span>
                      <select className="flp-select" onChange={updateStatus} value={status}>
                        <option value="all">Tất cả trạng thái</option>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flp-filter-group">
                      <span>Khoa/phòng</span>
                      <div className="flp-department-filter">
                        <SearchableSelect
                          onChange={(value) => {
                            setErrorMessage('')
                            setLoading(true)
                            setDepartmentId(value)
                            setPage(1)
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
                          searchPlaceholder="Tìm tên khoa/phòng..."
                          ariaLabel="Tìm và chọn khoa/phòng"
                        />
                      </div>
                    </label>
                    {hasFilters && (
                      <button className="flp-clear-filters" onClick={clearFilters} type="button">Xóa bộ lọc</button>
                    )}
                  </div>
                )}
              </section>

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
                                onClick={() => setPermissionForm(form)}
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
      {permissionForm && (
        <FormVersionAssignmentModal
          form={permissionForm}
          onAssignmentCountChange={(formId, count) => {
            setFormStats((current) => ({
              ...current,
              [formId]: {
                ...current[formId],
                activeAssignmentCount: count,
              },
            }))
          }}
          onClose={() => setPermissionForm(null)}
        />
      )}
      {assignmentModalOpen && (
        <div className="flp-assignment-backdrop" role="presentation" onMouseDown={closeAssignmentModal}>
          <form
            aria-modal="true"
            className="flp-assignment-modal"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submitAssignment}
            role="dialog"
          >
            <div className="flp-assignment-modal__header">
              <div>
                <p className="flp-assignment-modal__eyebrow">Phân quyền checklist</p>
                <h2>Giao checklist cho người nhận</h2>
                <span>Chọn một người để giao hoặc thu hồi các phiên bản đang hoạt động.</span>
              </div>
              <button
                aria-label="Đóng"
                className="flp-assignment-modal__close"
                disabled={assignmentSubmitting}
                onClick={closeAssignmentModal}
                type="button"
              >
                ×
              </button>
            </div>

            {assignmentLoading ? (
              <div className="flp-assignment-loading">
                <LoadingOutlined spin /> Đang tải danh sách checklist...
              </div>
            ) : (
              <>
                <div className="flp-assignment-modal__body">
                  {assignmentError && (
                    <div className="flp-assignment-error" role="alert">
                      <ExclamationCircleOutlined /> {assignmentError}
                    </div>
                  )}

                  {assignmentMessage && (
                    <div
                      className={`flp-assignment-message flp-assignment-message--${assignmentMessage.type}`}
                      role={assignmentMessage.type === 'error' ? 'alert' : 'status'}
                    >
                      {assignmentMessage.type === 'error' && <ExclamationCircleOutlined />}
                      {assignmentMessage.text}
                    </div>
                  )}

                  <div className="flp-assignment-field">
                    <span>Người nhận phân quyền</span>
                    <SearchableSelect
                      ariaLabel="Tìm người nhận phân quyền"
                      disabled={assignmentSubmitting}
                      emptyMessage={recipientSearchError
                        ? 'Không thể tải người nhận. Hãy nhập lại để thử lại.'
                        : 'Không tìm thấy tài khoản đang hoạt động'}
                      loading={recipientLoading}
                      loadingMessage="Đang tìm người nhận..."
                      onChange={(value) => {
                        const recipient = recipientOptions.find((item) => String(item.id) === String(value))
                        setSelectedRecipientId(value)
                        setSelectedRecipient(recipient || null)
                        setRecipientSearch('')
                        setSelectedFormVersionIds([])
                        setAssignmentMessage(null)
                        loadRecipientAssignments(value)
                      }}
                      onSearch={setRecipientSearch}
                      options={recipientOptions.map((recipient) => ({
                        value: recipient.id,
                        label: recipient.fullName || recipient.name || recipient.employeeCode,
                        description: recipient.employeeCode,
                        searchText: `${recipient.fullName || recipient.name || ''} ${recipient.employeeCode || ''}`,
                      }))}
                      placeholder="Chọn người nhận"
                      searchPlaceholder="Tìm theo tên hoặc mã nhân viên..."
                      selectedOption={selectedRecipient ? {
                        value: selectedRecipient.id,
                        label: selectedRecipient.fullName || selectedRecipient.name || selectedRecipient.employeeCode,
                        description: selectedRecipient.employeeCode,
                      } : undefined}
                      value={selectedRecipientId}
                    />
                  </div>

                  <div className="flp-assignment-validity">
                    <label className="flp-assignment-field">
                      <span>Hiệu lực từ</span>
                      <DateTimePicker24h
                        disabled={assignmentSubmitting}
                        onChange={setAssignmentValidFrom}
                        value={assignmentValidFrom}
                      />
                      <small>Bỏ trống để có hiệu lực ngay.</small>
                    </label>

                    <label className="flp-assignment-field">
                      <span>Hiệu lực đến</span>
                      <DateTimePicker24h
                        disabled={assignmentSubmitting}
                        onChange={setAssignmentValidUntil}
                        value={assignmentValidUntil}
                      />
                      <small>Bỏ trống nếu không có ngày hết hạn.</small>
                    </label>
                  </div>

                  {!selectedRecipientId ? (
                    <div className="flp-assignment-recipient-prompt">
                      Chọn người nhận để xem các checklist đã giao và chưa giao.
                    </div>
                  ) : (
                    <>
                      <div className="flp-assignment-list-head">
                        <div>
                          <strong>Danh sách checklist</strong>
                          <span>
                            {assignedCurrentVersionCount} đã giao · {selectedFormVersionIds.length}/{unassignedVersionIds.length} đang chọn
                          </span>
                        </div>
                        <button
                          disabled={assignmentSubmitting || recipientAssignmentsLoading || unassignedVersionIds.length === 0}
                          onClick={toggleAllAssignableForms}
                          type="button"
                        >
                          {unassignedVersionIds.length > 0 && selectedFormVersionIds.length === unassignedVersionIds.length
                            ? 'Bỏ chọn tất cả'
                            : 'Chọn tất cả'}
                        </button>
                      </div>

                      <div className="flp-assignment-list">
                        {recipientAssignmentsLoading ? (
                          <div className="flp-assignment-empty">
                            <LoadingOutlined spin /> Đang tải trạng thái phân quyền...
                          </div>
                        ) : displayedAssignableForms.length === 0 ? (
                          <div className="flp-assignment-empty">
                            Chưa có checklist với phiên bản đang hoạt động.
                          </div>
                        ) : (
                          displayedAssignableForms.map((form) => {
                            const versionId = String(form.currentPublishedVersion.id)
                            const currentAssignment = assignedByVersionId.get(versionId)
                            const checked = selectedFormVersionIds.includes(versionId)

                            if (currentAssignment) {
                              return (
                                <article className="flp-assignment-option flp-assignment-option--assigned" key={form.id}>
                                  <span className="flp-assignment-option__assigned-mark" aria-hidden="true">✓</span>
                                  <span className="flp-assignment-option__body">
                                    <strong>{form.title}</strong>
                                    <small>
                                      {getChecklistDisplayCode(form.code)} · v{form.currentPublishedVersion.versionNumber}
                                    </small>
                                  </span>
                                  <span className="flp-assignment-option__assigned-actions">
                                    <span className="flp-assignment-option__status">Đã giao</span>
                                    <span className="flp-assignment-option__validity">
                                      <ClockCircleOutlined /> {currentAssignment.validUntil
                                        ? `Đến ${formatAssignmentDateTime(currentAssignment.validUntil)}`
                                        : 'Không giới hạn'}
                                    </span>
                                    <button
                                      disabled={assignmentSubmitting}
                                      onClick={() => setConfirmAssignmentRevoke({
                                        ...currentAssignment,
                                        title: form.title,
                                      })}
                                      type="button"
                                    >
                                      <StopOutlined /> Thu hồi
                                    </button>
                                  </span>
                                </article>
                              )
                            }

                            return (
                              <label className="flp-assignment-option" key={form.id}>
                                <input
                                  checked={checked}
                                  disabled={assignmentSubmitting}
                                  onChange={() => toggleAssignableForm(versionId)}
                                  type="checkbox"
                                />
                                <span className="flp-assignment-option__body">
                                  <strong>{form.title}</strong>
                                  <small>
                                    {getChecklistDisplayCode(form.code)} · v{form.currentPublishedVersion.versionNumber}
                                  </small>
                                </span>
                                <span className="flp-assignment-option__status flp-assignment-option__status--available">
                                  Chưa giao
                                </span>
                              </label>
                            )
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="flp-assignment-actions">
                  <button
                    className="flp-assignment-cancel"
                    disabled={assignmentSubmitting}
                    onClick={closeAssignmentModal}
                    type="button"
                  >
                    Hủy
                  </button>
                  <button
                    className="flp-assignment-submit"
                    disabled={
                      assignmentSubmitting ||
                      !selectedRecipientId ||
                      recipientAssignmentsLoading ||
                      selectedFormVersionIds.length === 0
                    }
                    type="submit"
                  >
                    {assignmentSubmitting ? <LoadingOutlined spin /> : <UserSwitchOutlined />}
                    Giao biểu mẫu
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
      <ConfirmModal
        danger
        isOpen={Boolean(confirmAssignmentRevoke)}
        message={confirmAssignmentRevoke
          ? `Thu hồi biểu mẫu "${confirmAssignmentRevoke.title}" khỏi ${selectedRecipient?.fullName || selectedRecipient?.employeeCode || 'người nhận'}?`
          : ''}
        onCancel={() => {
          if (!assignmentSubmitting) setConfirmAssignmentRevoke(null)
        }}
        onConfirm={revokeRecipientAssignment}
        title="Thu hồi phân quyền"
      />
    </AppShell>
  )
}

export default FormListPage
