import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ClockCircleOutlined,
  CloseOutlined,
  EyeOutlined,
  FileExcelOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  UserSwitchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import AppliedFilterToolbar from '../../../shared/components/AppliedFilterToolbar.jsx'
import KeyboardDatePicker from '../../../shared/components/KeyboardDatePicker.jsx'
import DateTimePicker24h from '../../../shared/components/DateTimePicker24h.jsx'
import ConfirmModal from '../../../shared/components/ConfirmModal.jsx'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import { adminApi } from '../api/adminApi'
import { getChecklistDisplayCode } from '../utils/formCode.js'
import { validateHistoricalDateRange } from '../../../shared/utils/dateRange.js'
import '../styles/AdminQualityHistoryPage.css'

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

function normalizeVersionHistoryItem(version) {
  if (!version) return null
  return {
    ...version,
    versionId: version.versionId ?? version.id,
    versionNumber: version.versionNumber,
  }
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

function AdminQualityHistoryVersionPage({ role = 'admin' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { formId, versionId } = useParams()
  const isManager = role === 'manager'
  const technicalDashboardPath = isManager ? '/manager/reports/checklist-dashboard' : '/admin/reports/checklist-dashboard'
  const defaultDateRange = useMemo(() => getDefaultDateRange(), [])
  const [searchParams, setSearchParams] = useSearchParams()
  const versionBasePath = `${technicalDashboardPath}/results`
  const detailBasePath = `${technicalDashboardPath}/results`
  const page = parsePage(searchParams.get('page'))
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.get('size')))
    ? Number(searchParams.get('size'))
    : 10
  const keyword = searchParams.get('keyword') || ''
  const dashboardKeyword = searchParams.get('dashboardKeyword') || ''
  const submittedByUserId = isManager ? '' : numericParam(searchParams.get('submittedByUserId'))
  const departmentId = numericParam(searchParams.get('departmentId'))
  const result = searchParams.get('result') || ''
  const dateFrom = searchParams.get('dateFrom') || defaultDateRange.dateFrom
  const dateTo = searchParams.get('dateTo') || defaultDateRange.dateTo

  const [keywordInput, setKeywordInput] = useState(keyword)
  const [draftVersionId, setDraftVersionId] = useState(versionId)
  const [draftSubmittedByUserId, setDraftSubmittedByUserId] = useState(submittedByUserId)
  const [draftDepartmentId, setDraftDepartmentId] = useState(departmentId)
  const [draftResult, setDraftResult] = useState(result)
  const [draftDateFrom, setDraftDateFrom] = useState(dateFrom)
  const [draftDateTo, setDraftDateTo] = useState(dateTo)
  const [form, setForm] = useState(null)
  const [version, setVersion] = useState(null)
  const [versions, setVersions] = useState([])
  const [summary, setSummary] = useState({ total: 0, passed: 0, failed: 0, averageConvertedScore: null })
  const [submissionData, setSubmissionData] = useState({ content: [], page: 0, size: pageSize, totalElements: 0, totalPages: 0 })
  const [metadataLoading, setMetadataLoading] = useState(true)
  const [metadataError, setMetadataError] = useState('')
  const [resultsLoading, setResultsLoading] = useState(true)
  const [resultsError, setResultsError] = useState('')
  const [filterError, setFilterError] = useState('')
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
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
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
    setKeywordInput(keyword)
    setDraftVersionId(versionId)
    setDraftSubmittedByUserId(submittedByUserId)
    setDraftDepartmentId(departmentId)
    setDraftResult(result)
    setDraftDateFrom(dateFrom)
    setDraftDateTo(dateTo)
  }, [dateFrom, dateTo, departmentId, keyword, result, submittedByUserId, versionId])

  const loadAssignments = useCallback(async () => {
    setAssignmentsLoading(true)
    try {
      const nextAssignments = await fetchAllPages(
        (params) => adminApi.getFormAssignmentsByForm(formId, params),
        { status: 'ACTIVE' },
      )
      setAssignments(nextAssignments.filter((item) => (
        String(item.formVersionId) === String(versionId)
        && item.effectiveStatus === 'ACTIVE'
        && item.itemStatus === 'ACTIVE'
      )))
    } finally {
      setAssignmentsLoading(false)
    }
  }, [formId, versionId])

  useEffect(() => {
    let alive = true
    const loadMetadata = async () => {
      if (isManager) {
        const [formResponse, versionResponse] = await Promise.all([
          adminApi.getFormHistoryById(formId),
          adminApi.getFormHistoryVersionById(formId, versionId),
        ])
        return {
          form: formResponse?.data?.data || null,
          version: versionResponse?.data?.data || null,
          versions: [],
        }
      }
      const [formResponse, versionResponse] = await Promise.all([
        adminApi.getFormById(formId),
        adminApi.getFormVersionById(formId, versionId),
      ])
      const selectedVersion = versionResponse.data?.data || null
      return {
        form: formResponse.data?.data || null,
        version: selectedVersion,
        versions: selectedVersion ? [normalizeVersionHistoryItem(selectedVersion)] : [],
      }
    }
    loadMetadata()
      .then((metadata) => {
        if (!alive) return
        setForm(metadata.form)
        setVersion(metadata.version)
        setVersions(metadata.versions || [])
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
  }, [formId, isManager, refreshKey, versionId])

  useEffect(() => {
    if (!version) return undefined
    let alive = true
    adminApi.getFormHistoryVersions(formId, { dateFrom, dateTo })
      .then((response) => {
        if (!alive) return
        const versionHistory = Array.isArray(response?.data?.data) ? response.data.data : []
        const normalizedVersions = versionHistory.map(normalizeVersionHistoryItem).filter(Boolean)
        if (version && !normalizedVersions.some((item) => String(item.versionId) === String(versionId))) {
          normalizedVersions.push(normalizeVersionHistoryItem(version))
        }
        setVersions(normalizedVersions)
      })
      .catch(() => {
        if (alive && version) setVersions([normalizeVersionHistoryItem(version)].filter(Boolean))
      })
    return () => {
      alive = false
    }
  }, [dateFrom, dateTo, formId, version, versionId])

  useEffect(() => {
    if (isManager || !isFilterOpen) return undefined
    let alive = true
    setAssignments([])
    loadAssignments().catch(() => {
      if (alive) setAssignments([])
    })
    return () => {
      alive = false
    }
  }, [isFilterOpen, isManager, loadAssignments, refreshKey])

  useEffect(() => {
    if ((!isFilterOpen && !(isManager && departmentId)) || departments.length > 0) return undefined
    let alive = true
    adminApi.getDepartments()
      .then((response) => {
        if (alive) setDepartments(normalizeDepartments(response))
      })
      .catch(() => {
        if (alive) setDepartments([])
      })
    return () => {
      alive = false
    }
  }, [departmentId, departments.length, isFilterOpen, isManager])

  const requestParams = useMemo(() => ({
    status: 'SUBMITTED',
    keyword: keyword || undefined,
    submittedByUserId: isManager ? undefined : submittedByUserId || undefined,
    departmentId: departmentId || undefined,
    result: result || undefined,
    // Always send typed date values. PostgreSQL cannot infer a timestamp type
    // from a null optional parameter in the shared history predicates.
    dateFrom,
    dateTo,
  }), [dateFrom, dateTo, departmentId, isManager, keyword, result, submittedByUserId])

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
    if (isManager) return undefined
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
  }, [evaluatorQuery, isFilterOpen, isManager])

  useEffect(() => {
    if (isManager) return
    if (!submittedByUserId) return
    const existing = evaluatorOptions.find((user) => String(user.id) === String(submittedByUserId))
    if (existing) return
    adminApi.getUserById(submittedByUserId)
      .then((response) => setSelectedEvaluatorFallback(response?.data?.data || null))
      .catch(() => setSelectedEvaluatorFallback(null))
  }, [evaluatorOptions, isManager, submittedByUserId])

  useEffect(() => {
    if (isManager) return undefined
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
  }, [confirmRevoke, isManager, managerModalOpen])

  useEffect(() => {
    if (!isManager || !departmentId || departments.length === 0) return
    const allowedDepartmentIds = new Set(departments.map((department) => String(department.departmentId ?? department.id)))
    if (!allowedDepartmentIds.has(String(departmentId))) {
      updateQuery({ departmentId: '' }, false)
    }
  }, [departmentId, departments, isManager, updateQuery])

  const managers = assignments
  const assignedManagerIds = useMemo(() => new Set(managers.map((item) => String(item.manager?.id))), [managers])
  const availableManagers = useMemo(() => (
    managerUsers.filter((manager) => !assignedManagerIds.has(String(manager.id)))
  ), [assignedManagerIds, managerUsers])
  const effectiveSelectedManagerIds = useMemo(() => selectedManagerIds.filter((id) => (
    availableManagers.some((manager) => String(manager.id) === String(id))
  )), [availableManagers, selectedManagerIds])
  const selectedManagerOptions = useMemo(() => effectiveSelectedManagerIds
    .map((id) => managerUsers.find((manager) => String(manager.id) === String(id)))
    .filter(Boolean)
    .map((manager) => ({
      value: manager.id,
      label: getManagerName(manager),
      description: manager.employeeCode || 'Chưa có mã nhân viên',
    })), [effectiveSelectedManagerIds, managerUsers])

  const removeSelectedManager = (managerId) => {
    setSelectedManagerIds((current) => current.filter((id) => String(id) !== String(managerId)))
  }

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
    { value: '', label: isManager ? 'Tất cả khoa/phòng được giao' : 'Tất cả khoa/phòng' },
    ...departments.map((department) => ({
      value: department.departmentId ?? department.id,
      label: department.departmentName || department.name,
      description: department.code || '',
    })),
  ]
  const selectedEvaluator = evaluatorOptions.find((user) => String(user.id) === String(draftSubmittedByUserId))
    || (String(selectedEvaluatorFallback?.id) === String(draftSubmittedByUserId) ? selectedEvaluatorFallback : null)
  const selectedEvaluatorOption = selectedEvaluator ? {
    value: selectedEvaluator.id,
    label: getManagerName(selectedEvaluator),
    description: selectedEvaluator.employeeCode || 'Chưa có mã nhân viên',
  } : undefined
  const sortedVersions = useMemo(() => (
    versions
      .map(normalizeVersionHistoryItem)
      .filter((item) => item?.versionId)
      .sort((left, right) => Number(right.versionNumber || 0) - Number(left.versionNumber || 0))
  ), [versions])
  const latestVersionId = sortedVersions[0]?.versionId ? String(sortedVersions[0].versionId) : ''
  const versionFilterOptions = sortedVersions.map((item) => ({
    value: String(item.versionId),
    label: `Phiên bản v${item.versionNumber || '—'}`,
    status: item.status,
  }))
  const versionFilterActive = Boolean(latestVersionId && String(versionId) !== latestVersionId)
  const historyFilterCount = [
    versionFilterActive,
    isManager ? '' : submittedByUserId,
    departmentId,
    result,
    dateFrom !== defaultDateRange.dateFrom ? dateFrom : '',
    dateTo !== defaultDateRange.dateTo ? dateTo : '',
  ].filter(Boolean).length
  const applyHistoryFilters = () => {
    const validationError = validateHistoricalDateRange(draftDateFrom, draftDateTo, { maxDate: defaultDateRange.dateTo })
    if (validationError) {
      setFilterError(validationError)
      return
    }
    setFilterError('')
    const nextParams = new URLSearchParams()
    nextParams.set('size', String(pageSize))
    nextParams.set('dateFrom', draftDateFrom || defaultDateRange.dateFrom)
    nextParams.set('dateTo', draftDateTo || defaultDateRange.dateTo)
    if (keywordInput.trim()) nextParams.set('keyword', keywordInput.trim())
    if (!isManager && draftSubmittedByUserId) nextParams.set('submittedByUserId', draftSubmittedByUserId)
    if (draftDepartmentId) nextParams.set('departmentId', draftDepartmentId)
    if (draftResult) nextParams.set('result', draftResult)
    if (searchParams.get('source')) nextParams.set('source', searchParams.get('source'))
    if (dashboardKeyword) nextParams.set('dashboardKeyword', dashboardKeyword)
    setResultsLoading(true)
    setIsFilterOpen(false)
    navigate(`${versionBasePath}/forms/${formId}/versions/${draftVersionId || versionId}?${nextParams.toString()}`, { replace: true })
  }
  const resetHistoryFilters = () => {
    setKeywordInput('')
    setResultsLoading(true)
    setIsFilterOpen(false)
    setFilterError('')
    const nextParams = new URLSearchParams({
      size: String(pageSize),
      dateFrom: defaultDateRange.dateFrom,
      dateTo: defaultDateRange.dateTo,
    })
    if (searchParams.get('source')) nextParams.set('source', searchParams.get('source'))
    if (dashboardKeyword) nextParams.set('dashboardKeyword', dashboardKeyword)
    if (versionFilterActive && latestVersionId) {
      navigate(`${versionBasePath}/forms/${formId}/versions/${latestVersionId}?${nextParams.toString()}`, { replace: true })
      return
    }
    setSearchParams(nextParams, { replace: true })
  }
  const resultFrom = submissionData.totalElements === 0 ? 0 : submissionData.page * submissionData.size + 1
  const resultTo = Math.min((submissionData.page + 1) * submissionData.size, submissionData.totalElements)
  const pageItems = getPaginationItems(submissionData.page, submissionData.totalPages)
  const returnTo = `${location.pathname}${location.search}`
  const dashboardBackParams = new URLSearchParams()
  dashboardBackParams.set('dateFrom', dateFrom)
  dashboardBackParams.set('dateTo', dateTo)
  dashboardBackParams.set('selectedFormId', formId)
  if (dashboardKeyword) dashboardBackParams.set('keyword', dashboardKeyword)
  if (departmentId) dashboardBackParams.set('departmentId', departmentId)
  if (result) dashboardBackParams.set('result', result)
  if (searchParams.get('subjectUserId')) dashboardBackParams.set('subjectUserId', numericParam(searchParams.get('subjectUserId')))
  if (submittedByUserId) dashboardBackParams.set('submittedByUserId', submittedByUserId)
  const shellBack = { to: `${technicalDashboardPath}?${dashboardBackParams.toString()}`, label: 'Quay lại' }
  const shellBreadcrumbs = [
    { label: 'Giám sát tuân thủ' },
    { label: 'Tuân thủ theo kỹ thuật', link: technicalDashboardPath },
    { label: `Kết quả phiên bản v${version?.versionNumber || ''}` },
  ]

  return (
    <AppShell
      className="admin-quality-history-page"
      back={shellBack}
      breadcrumbs={shellBreadcrumbs}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span className="aqh-form-code" style={{ fontSize: 18, fontWeight: 800, padding: '7px 16px', borderRadius: 999 }}>
                        {version?.title || form?.title || 'Quy trình'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '5px 12px', borderRadius: 999 }}>
                        v{version?.versionNumber}
                      </span>
                    </div>
                    <p style={{ marginTop: 10 }}>{version?.description || form?.description || 'Chưa có mô tả'}</p>
                  </div>
                  <span className={`aqh-version-status aqh-version-status--${getVersionStatusClass(version?.status)}`}>
                    {getVersionStatusLabel(version?.status)}
                  </span>
                </header>

                <div className="aqh-summary-grid aqh-summary-grid--history">
                  <article><span>Tổng lượt</span><strong>{resultsLoading ? '…' : summary.total}</strong><small>Theo bộ lọc hiện tại</small></article>
                  <article><span>Đạt</span><strong>{resultsLoading ? '…' : summary.passed}</strong><small>Chưa đạt: {summary.failed}</small></article>
                  <article><span>Điểm trung bình</span><strong>{resultsLoading ? '…' : formatScore(summary.averageConvertedScore)}</strong><small>Thang điểm 10</small></article>
                  {!isManager && (
                    <button className="aqh-summary-manager" onClick={openManagerModal} type="button">
                      <span><UserSwitchOutlined /> Người được giao</span><strong>{assignmentsLoading ? '…' : managers.length}</strong><small>Nhấn để quản lý</small>
                    </button>
                  )}
                </div>
              </section>

              <section className="aqh-response-panel aqh-response-panel--full">
                <div className="aqh-panel-heading aqh-panel-heading--results">
                  <div><h3>Kết quả đánh giá</h3><p>{resultsLoading ? 'Đang cập nhật...' : `${submissionData.totalElements} kết quả phù hợp`}</p></div>
                  {!isManager && (
                    <button
                      className="aqh-export-button"
                      disabled={exporting || resultsLoading || submissionData.totalElements === 0}
                      onClick={exportResponses}
                      type="button"
                    >
                      {exporting ? <LoadingOutlined spin /> : <FileExcelOutlined />}
                      {exporting ? 'Đang xuất...' : 'Xuất Excel'}
                    </button>
                  )}
                </div>

                <AppliedFilterToolbar
                  activeCount={historyFilterCount}
                  ariaLabel="Bộ lọc kết quả đánh giá"
                  className="aqh-results-filter"
                  errorMessage={filterError}
                  isOpen={isFilterOpen}
                  onApply={applyHistoryFilters}
                  onReset={resetHistoryFilters}
                  onSearchChange={setKeywordInput}
                  onToggle={() => {
                    setFilterError('')
                    setIsFilterOpen((current) => !current)
                  }}
                  panelClassName="aqh-results-filter-panel"
                  panelId="quality-history-filter-panel"
                  searchAriaLabel="Tìm nhân viên được đánh giá"
                  searchClassName="aqh-results-search"
                  searchPlaceholder="Tìm theo tên hoặc mã nhân viên..."
                  searchValue={keywordInput}
                >
                    {versionFilterOptions.length > 0 && <label className="admin-control-toolbar__field">
                      <span>Phiên bản</span>
                      <select value={String(draftVersionId)} onChange={(event) => setDraftVersionId(event.target.value)}>
                        {versionFilterOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>}
                    {!isManager && <label className="admin-control-toolbar__field">
                      <span>Người thực hiện chấm</span>
                      <SearchableSelect
                        ariaLabel="Lọc theo người thực hiện chấm"
                        loading={evaluatorsLoading}
                        onChange={setDraftSubmittedByUserId}
                        onSearch={setEvaluatorQuery}
                        options={evaluatorSelectOptions}
                        placeholder="Tất cả người chấm"
                        searchPlaceholder="Tìm tên hoặc mã người chấm..."
                        selectedOption={selectedEvaluatorOption}
                        showDescriptions={false}
                        value={draftSubmittedByUserId}
                      />
                    </label>}
                    <label className="admin-control-toolbar__field">
                      <span>Khoa/phòng</span>
                      <SearchableSelect
                        ariaLabel="Lọc theo khoa phòng"
                        disabled={isManager}
                        onChange={isManager ? undefined : setDraftDepartmentId}
                        options={departmentOptions}
                        placeholder="Tất cả khoa/phòng"
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
                    <label className="admin-control-toolbar__field aqh-results-filter__date"><span>Từ ngày</span><KeyboardDatePicker allowInvalidValue value={draftDateFrom} max={draftDateTo || defaultDateRange.dateTo} onChange={(value) => { setFilterError(''); setDraftDateFrom(value) }} /></label>
                    <label className="admin-control-toolbar__field aqh-results-filter__date"><span>Đến ngày</span><KeyboardDatePicker allowInvalidValue value={draftDateTo} min={draftDateFrom || undefined} max={defaultDateRange.dateTo} onChange={(value) => { setFilterError(''); setDraftDateTo(value) }} /></label>
                </AppliedFilterToolbar>

                {exportError && <div className="aqh-export-error" role="alert">{exportError}</div>}
                {resultsError ? (
                  <div className="aqh-inline-error" role="alert"><WarningOutlined /><span>{resultsError}</span><button onClick={() => { setResultsLoading(true); setResultsError(''); setRefreshKey((value) => value + 1) }} type="button">Thử lại</button></div>
                ) : resultsLoading ? (
                  <div className="aqh-results-loading"><LoadingOutlined spin /><span>Đang tải kết quả...</span></div>
                ) : submissionData.content.length === 0 ? (
                  <div className="aqh-results-empty"><strong>Chưa có kết quả phù hợp</strong><span>Hãy thay đổi bộ lọc hoặc khoảng thời gian.</span></div>
                ) : (
                  <>
                    <div className="aqh-results-table-wrap">
                      <table className="aqh-results-table admin-table-uppercase">
                        <thead>
                          <tr>
                            <th className="aqh-result-col-employee">Nhân viên</th>
                            <th className="aqh-result-col-department">Khoa/phòng</th>
                            <th className="aqh-result-col-grader">Người chấm</th>
                            <th className="aqh-result-col-submitted">Ngày nộp</th>
                            <th className="aqh-result-col-score">Điểm</th>
                            <th className="aqh-result-col-result">Kết quả</th>
                            <th className="aqh-result-col-actions">Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {submissionData.content.map((item) => (
                            <tr key={item.id}>
                              <td className="aqh-result-col-employee">
                                <div className="aqh-results-table__person">
                                  <strong>{item.subject?.fullName || 'Chưa có tên'}</strong>
                                </div>
                              </td>
                              <td className="aqh-result-col-department">
                                <span>{item.subject?.department || 'Chưa xác định'}</span>
                              </td>
                              <td className="aqh-result-col-grader">
                                <div className="aqh-results-table__person">
                                  <span>{item.submittedBy?.fullName || 'Chưa xác định'}</span>
                                </div>
                              </td>
                              <td className="aqh-result-col-submitted">
                                <div className="aqh-results-table__inline">
                                  <ClockCircleOutlined />
                                  <span>{formatDateTime(item.submittedAt || item.updatedAt)}</span>
                                </div>
                              </td>
                              <td className="aqh-result-col-score"><strong className="aqh-response-score">{formatScore(item.convertedScore)}/10</strong></td>
                              <td className="aqh-result-col-result"><span className={`admin-quality-history__badge admin-quality-history__badge--${getResultClass(item.result)}`}>{getResultLabel(item.result)}</span></td>
                              <td className="aqh-result-col-actions">
                                <div className="admin-table-actions">
                                  <button
                                    aria-label={`Xem chi tiết kết quả của ${item.subject?.fullName || 'nhân viên'}`}
                                    className="admin-table-action admin-table-action--icon admin-table-action--primary"
                                    onClick={() => {
                                      const detailParams = new URLSearchParams({ returnTo })
                                      navigate(`${detailBasePath}/${item.id}?${detailParams.toString()}`)
                                    }}
                                    title="Xem chi tiết"
                                    type="button"
                                  >
                                    <EyeOutlined />
                                  </button>
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

      {!isManager && managerModalOpen && (
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
                      selectedOptions={selectedManagerOptions}
                      showSelectedChips={false}
                      value={selectedManagerIds}
                    />
                  </div>
                  <div className="aqh-manager-assign__field"><label htmlFor="aqh-manager-valid-until">Hiệu lực đến</label><DateTimePicker24h disabled={managerBusy} id="aqh-manager-valid-until" onChange={setValidUntil} value={validUntil} /></div>
                  <div className="aqh-manager-selected-box" aria-label="Danh sách người nhận đã chọn">
                    <div className="aqh-manager-selected-box__header"><span>Đã chọn</span><strong>{selectedManagerOptions.length}</strong></div>
                    {selectedManagerOptions.length > 0 ? <div className="aqh-manager-selected-box__list">
                      {selectedManagerOptions.map((manager) => <article key={manager.value}>
                        <span className="aqh-manager-selected-box__identity"><strong>{manager.label}</strong></span>
                        <button type="button" aria-label={`Bỏ chọn ${manager.label}`} onClick={() => removeSelectedManager(manager.value)}>×</button>
                      </article>)}
                    </div> : <p>Chưa chọn người nhận nào.</p>}
                  </div>
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

      {!isManager && <ConfirmModal
        danger
        isOpen={Boolean(confirmRevoke)}
        message={confirmRevoke ? `Thu hồi quyền thực hiện quy trình của ${getManagerName(confirmRevoke.manager)}?` : ''}
        onCancel={() => setConfirmRevoke(null)}
        onConfirm={revokeAssignment}
        title="Thu hồi phân quyền"
      />}
    </AppShell>
  )
}

export default AdminQualityHistoryVersionPage
