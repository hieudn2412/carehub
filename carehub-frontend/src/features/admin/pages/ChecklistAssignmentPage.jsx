import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ApartmentOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  EyeOutlined,
  FileDoneOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import Modal from '../../../shared/components/Modal.jsx'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import DateTimePicker24h from '../../../shared/components/DateTimePicker24h.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { adminApi } from '../api/adminApi'
import { getChecklistDisplayCode } from '../utils/formCode.js'
import { formatRoleLabels } from '../../../shared/utils/roleLabels.js'
import '../styles/ChecklistAssignmentPage.css'

const PAGE_SIZE = 10
const MAX_FORMS = 25
const WIZARD_TOTAL_STEPS = 4

const TAB_FORMS = 'forms'
const TAB_ASSIGNEES = 'assignees'

const EXPIRING_OPTIONS = [
  { value: '', label: 'Tất cả quyền' },
  { value: 'true', label: 'Sắp hết hạn 7 ngày' },
]

const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả vai trò' },
  { value: 'USER', label: 'Nhân viên' },
  { value: 'MANAGER', label: 'Quản lý cấp Khoa' },
]

function getPageData(response) {
  const data = response?.data?.data
  if (Array.isArray(data)) return { content: data, totalElements: data.length, totalPages: 1 }
  return {
    content: Array.isArray(data?.content) ? data.content : [],
    totalElements: Number(data?.totalElements || 0),
    totalPages: Number(data?.totalPages || 0),
  }
}

function formatDate(value) {
  if (!value) return 'Không giới hạn'
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function toIsoOrNull(value) {
  if (!value) return null
  return new Date(value).toISOString()
}

function extractApiErrorMessage(error, fallback) {
  const data = error?.response?.data
  const details = data?.details
  if (Array.isArray(details)) {
    const detailMessage = details.find((detail) => detail?.message)?.message
    if (detailMessage) return detailMessage
  }
  if (details && typeof details === 'object' && details.message) return details.message
  if (data?.message && data.message !== 'Validation failed' && data.message !== 'Dữ liệu không hợp lệ') return data.message
  return fallback
}

function getValidityDateError(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Ngày hết hạn không hợp lệ. Vui lòng nhập đúng định dạng ngày và giờ.'
  if (date <= new Date()) return 'Ngày hết hạn phải sau thời điểm hiện tại.'
  return ''
}

function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [delay, value])

  return debounced
}

function getRoleText(value) {
  return formatRoleLabels(Array.isArray(value) ? value : [value]) || 'Chưa có vai trò'
}

function buildFormOption(form) {
  const title = form.title || 'Chưa có tên'
  const code = form.code ? getChecklistDisplayCode(form.code) : ''
  return {
    value: String(form.formId ?? form.id),
    label: title,
    searchText: [title, code].filter(Boolean).join(' '),
    description: [
      form.versionNumber ? `Phiên bản v${form.versionNumber}` : null,
      form.departmentName || form.ownerDepartmentName || 'Chưa có khoa sở hữu',
    ].filter(Boolean).join(' · '),
  }
}

function buildAssigneeOption(user) {
  return {
    value: String(user.assigneeId ?? user.id),
    label: `${user.fullName || user.name || 'Chưa có tên'}${user.employeeCode ? ` (${user.employeeCode})` : ''}`,
    description: [
      user.departmentName || 'Chưa có khoa/phòng',
      getRoleText(user.roleCodes),
    ].filter(Boolean).join(' · '),
  }
}

function buildDepartmentOption(department) {
  return {
    value: String(department.departmentId ?? department.id),
    label: department.departmentName || department.name || 'Chưa có tên khoa/phòng',
    searchText: [department.departmentName || department.name, department.code].filter(Boolean).join(' '),
  }
}

function departmentIdOf(department) {
  return String(department?.departmentId ?? department?.id ?? department?.value ?? '')
}

function departmentNameOf(department) {
  return department?.departmentName || department?.name || department?.label || `Khoa #${departmentIdOf(department)}`
}

function SelectionLimitNotice({ formsCount, assigneesCount }) {
  const largeAssigneeWarning = assigneesCount > 100
  return (
    <p className="cap-assignment-wizard__limit">
      Có thể chọn tối đa {MAX_FORMS} bảng kiểm trong một lần giao.
      Hiện đã chọn {formsCount} bảng kiểm, {assigneesCount} người nhận.
      {largeAssigneeWarning ? ' Số người nhận lớn có thể khiến thao tác xử lý lâu hơn.' : ''}
    </p>
  )
}

function WizardSelectedList({ title, count, options, emptyText, onRemove }) {
  return (
    <aside className="cap-assignment-selected-panel">
      <div className="cap-assignment-selected-panel__header">
        <strong>{title}</strong>
        <span>{count}</span>
      </div>
      <div className="cap-assignment-selected-panel__list">
        {options.length === 0 ? (
          <p>{emptyText}</p>
        ) : options.map((option) => (
          <div className="cap-assignment-selected-panel__item" key={`selected-panel-${option.value}`}>
            <span title={option.label}>{option.label}</span>
            <button
              type="button"
              aria-label={`Bỏ chọn ${option.label}`}
              onClick={() => onRemove(option.value)}
            >
              <CloseOutlined />
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}

function ChecklistAssignmentPage() {
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialFormId = searchParams.get('formId')
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === TAB_ASSIGNEES ? TAB_ASSIGNEES : TAB_FORMS)
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '')
  const debouncedKeyword = useDebouncedValue(keyword)
  const [overview, setOverview] = useState(null)
  const [departments, setDepartments] = useState([])
  const [forms, setForms] = useState({ content: [], totalElements: 0, totalPages: 0 })
  const [assignees, setAssignees] = useState({ content: [], totalElements: 0, totalPages: 0 })
  const [page, setPage] = useState(Number(searchParams.get('page') || 0))
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const [formFilters, setFormFilters] = useState({
    ownerDepartmentId: searchParams.get('ownerDepartmentId') || '',
    expiringSoon: searchParams.get('expiringSoon') || '',
  })
  const [assigneeFilters, setAssigneeFilters] = useState({
    departmentId: searchParams.get('departmentId') || '',
    roleCode: searchParams.get('roleCode') || '',
    expiringSoon: searchParams.get('expiringSoon') || '',
  })

  const [drawer, setDrawer] = useState(null)
  const [drawerItems, setDrawerItems] = useState([])
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState([])
  const [drawerValidUntil, setDrawerValidUntil] = useState('')
  const [drawerSubmitting, setDrawerSubmitting] = useState(false)
  const [deptModalItem, setDeptModalItem] = useState(null)
  const [deptScopeSearch, setDeptScopeSearch] = useState('')
  const [deptScopeSaving, setDeptScopeSaving] = useState(false)
  const initialFormIdHandledRef = useRef(false)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [selectedFormIds, setSelectedFormIds] = useState([])
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([])
  const [selectedFormOptions, setSelectedFormOptions] = useState([])
  const [selectedAssigneeOptions, setSelectedAssigneeOptions] = useState([])
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState([])
  const [selectedDepartmentOptions, setSelectedDepartmentOptions] = useState([])
  const [formCandidateOptions, setFormCandidateOptions] = useState([])
  const [assigneeCandidateOptions, setAssigneeCandidateOptions] = useState([])
  const [formCandidateLoading, setFormCandidateLoading] = useState(false)
  const [assigneeCandidateLoading, setAssigneeCandidateLoading] = useState(false)
  const [managerCandidateLoading, setManagerCandidateLoading] = useState(false)
  const [validUntil, setValidUntil] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [wizardSubmitting, setWizardSubmitting] = useState(false)
  const [wizardError, setWizardError] = useState('')

  const departmentOptions = useMemo(() => [
    { value: '', label: 'Tất cả khoa/phòng' },
    ...departments.map((department) => ({
      value: String(department.id),
      label: department.name,
    })),
  ], [departments])
  const wizardDepartmentOptions = useMemo(() => departments.map(buildDepartmentOption), [departments])

  const deptModalSelectedIds = useMemo(
    () => new Set((deptModalItem?.selectedDepartmentIds || []).map(String)),
    [deptModalItem?.selectedDepartmentIds],
  )
  const deptModalSelectedDepartments = useMemo(() => (
    (departments || [])
      .filter((department) => deptModalSelectedIds.has(String(department.id)))
      .map((department) => ({
        departmentId: department.id,
        departmentName: department.name,
        code: department.code,
      }))
  ), [departments, deptModalSelectedIds])
  const deptModalAvailableDepartments = useMemo(() => (
    (departments || [])
      .filter((department) => !deptModalSelectedIds.has(String(department.id)))
      .map((department) => ({
        departmentId: department.id,
        departmentName: department.name,
        code: department.code,
      }))
  ), [departments, deptModalSelectedIds])

  const normalizedDeptScopeSearch = deptScopeSearch.trim().toLowerCase()
  const filterModalDepartments = useCallback((items) => {
    if (!normalizedDeptScopeSearch) return items
    return items.filter((department) => [
      department.departmentName || department.name,
      department.code,
    ].filter(Boolean).some((text) => String(text).toLowerCase().includes(normalizedDeptScopeSearch)))
  }, [normalizedDeptScopeSearch])

  const visibleSelectedDepartments = useMemo(
    () => filterModalDepartments(deptModalSelectedDepartments),
    [deptModalSelectedDepartments, filterModalDepartments],
  )
  const visibleAvailableDepartments = useMemo(
    () => filterModalDepartments(deptModalAvailableDepartments),
    [deptModalAvailableDepartments, filterModalDepartments],
  )

  const activeFilters = activeTab === TAB_FORMS ? formFilters : assigneeFilters

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('tab', activeTab)
    if (keyword.trim()) params.set('keyword', keyword.trim())
    if (page) params.set('page', String(page))
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    if (drawer?.type === TAB_FORMS && drawer?.id) {
      params.set('formId', String(drawer.id))
    }
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true })
    }
  }, [activeFilters, activeTab, drawer?.id, drawer?.type, keyword, page, searchParams, setSearchParams])

  useEffect(() => {
    let cancelled = false

    async function loadBasics() {
      try {
        const [overviewResponse, departmentsResponse] = await Promise.all([
          adminApi.getFormAssignmentOverview(),
          adminApi.getDepartments(),
        ])
        if (cancelled) return
        setOverview(overviewResponse.data?.data || {})
        setDepartments(Array.isArray(departmentsResponse.data?.data) ? departmentsResponse.data.data : [])
      } catch (requestError) {
        if (!cancelled) setError(requestError?.response?.data?.message || 'Không thể tải tổng quan giao bảng kiểm.')
      }
    }

    loadBasics()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  useEffect(() => {
    let cancelled = false

    async function loadRows() {
      try {
        setLoading(true)
        setError('')
        if (activeTab === TAB_FORMS) {
          const response = await adminApi.getFormAssignmentForms({
            keyword: debouncedKeyword || undefined,
            ownerDepartmentId: formFilters.ownerDepartmentId || undefined,
            expiringSoon: formFilters.expiringSoon || undefined,
            page,
            size: PAGE_SIZE,
          })
          if (!cancelled) setForms(getPageData(response))
        } else {
          const response = await adminApi.getFormAssignmentAssignees({
            keyword: debouncedKeyword || undefined,
            departmentId: assigneeFilters.departmentId || undefined,
            roleCode: assigneeFilters.roleCode || undefined,
            expiringSoon: assigneeFilters.expiringSoon || undefined,
            page,
            size: PAGE_SIZE,
          })
          if (!cancelled) setAssignees(getPageData(response))
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError?.response?.data?.message || 'Không thể tải danh sách giao bảng kiểm.')
          if (activeTab === TAB_FORMS) setForms({ content: [], totalElements: 0, totalPages: 0 })
          else setAssignees({ content: [], totalElements: 0, totalPages: 0 })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRows()
    return () => {
      cancelled = true
    }
  }, [activeTab, assigneeFilters, debouncedKeyword, formFilters, page, refreshKey])

  const loadDrawerItems = useCallback(async (nextDrawer = drawer) => {
    if (!nextDrawer) return
    setDrawerLoading(true)
    setSelectedItemIds([])
    setDrawerValidUntil('')
    try {
      const response = await adminApi.getFormAssignmentItems({
        formId: nextDrawer.type === TAB_FORMS ? nextDrawer.id : undefined,
        assigneeId: nextDrawer.type === TAB_ASSIGNEES ? nextDrawer.id : undefined,
        page: 0,
        size: 100,
      })
      const items = getPageData(response).content
      setDrawerItems(items)
      if (items.length > 0) {
        if (nextDrawer.type === TAB_FORMS && items[0]?.formTitle) {
          setDrawer((cur) => (cur && cur.id === nextDrawer.id ? { ...cur, title: items[0].formTitle } : cur))
        } else if (nextDrawer.type === TAB_ASSIGNEES && (items[0]?.assigneeName || items[0]?.fullName)) {
          setDrawer((cur) => (cur && cur.id === nextDrawer.id ? { ...cur, title: items[0].assigneeName || items[0].fullName } : cur))
        }
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Không thể tải chi tiết quyền.')
      setDrawerItems([])
    } finally {
      setDrawerLoading(false)
    }
  }, [drawer])

  useEffect(() => {
    if (initialFormIdHandledRef.current) return
    if (!initialFormId) return
    initialFormIdHandledRef.current = true

    const nextDrawer = { type: TAB_FORMS, id: Number(initialFormId), title: 'Bảng kiểm' }
    setDrawer(nextDrawer)
    loadDrawerItems(nextDrawer)
  }, [initialFormId, loadDrawerItems])

  const closeDrawer = useCallback(() => {
    setDrawer(null)
    setDrawerItems([])
    setSelectedItemIds([])
    setDrawerValidUntil('')
    setDeptModalItem(null)
  }, [])

  useEffect(() => {
    if (!drawer) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeDrawer, drawer])

  const handleOpenDeptModal = async (item) => {
    const count = item.allowedDepartmentCount ?? (item.allowedDepartments?.length || 0)
    const isAll = count === 0
    setDeptScopeSearch('')
    setDeptModalItem({
      ...item,
      isAll,
      loading: !isAll,
      departments: isAll ? departments : (item.allowedDepartments || []),
      selectedDepartmentIds: isAll ? departments.map((d) => String(d.id)) : (item.allowedDepartments || []).map(departmentIdOf).filter(Boolean),
      error: '',
    })
    if (isAll) return
    try {
      const response = await adminApi.getFormAssignmentItemAllowedDepartments(item.assignmentItemId)
      const depts = response.data?.data || []
      setDeptModalItem((curr) => (curr && curr.assignmentItemId === item.assignmentItemId ? {
        ...curr,
        loading: false,
        departments: depts,
        selectedDepartmentIds: depts.map(departmentIdOf).filter(Boolean),
      } : curr))
    } catch (requestError) {
      const errorMsg = requestError?.response?.data?.message || 'Không thể tải danh sách khoa/phòng.'
      setDeptModalItem((curr) => (curr && curr.assignmentItemId === item.assignmentItemId ? {
        ...curr,
        loading: false,
        error: errorMsg,
      } : curr))
      showToast(errorMsg, 'error')
    }
  }

  const addDeptToModalScope = (departmentId) => {
    const id = String(departmentId)
    setDeptModalItem((current) => {
      if (!current || current.selectedDepartmentIds?.includes(id)) return current
      return { ...current, selectedDepartmentIds: [...(current.selectedDepartmentIds || []), id], isAll: false }
    })
  }

  const removeDeptFromModalScope = (departmentId) => {
    const id = String(departmentId)
    setDeptModalItem((current) => {
      if (!current) return current
      return {
        ...current,
        selectedDepartmentIds: (current.selectedDepartmentIds || []).filter((value) => String(value) !== id),
        isAll: false,
      }
    })
  }

  const saveDeptModalScope = async () => {
    if (!deptModalItem?.assignmentItemId) return
    const departmentIds = (deptModalItem.selectedDepartmentIds || []).map(Number).filter(Number.isFinite)
    if (departmentIds.length === 0) {
      const warnMsg = 'Vui lòng chọn ít nhất một khoa/phòng.'
      setDeptModalItem((current) => current ? { ...current, error: warnMsg } : current)
      showToast(warnMsg, 'warning')
      return
    }
    setDeptScopeSaving(true)
    setDeptModalItem((current) => current ? { ...current, error: '' } : current)
    try {
      const response = await adminApi.updateFormAssignmentItemAllowedDepartments(deptModalItem.assignmentItemId, { departmentIds })
      const updatedDepartments = response.data?.data || []
      const updatedCount = updatedDepartments.length
      setDrawerItems((current) => current.map((item) => (
        item.assignmentItemId === deptModalItem.assignmentItemId
          ? { ...item, allowedDepartmentCount: updatedCount, allowedDepartments: updatedDepartments }
          : item
      )))
      setDeptModalItem((current) => current ? {
        ...current,
        isAll: false,
        departments: updatedDepartments,
        selectedDepartmentIds: updatedDepartments.map(departmentIdOf).filter(Boolean),
        error: '',
      } : current)
      const successMsg = 'Lưu phạm vi khoa/phòng thành công!'
      setMessage(successMsg)
      showToast(successMsg, 'success')
      setRefreshKey((current) => current + 1)
    } catch (requestError) {
      const errorMsg = requestError?.response?.data?.message || 'Lưu phạm vi khoa/phòng thất bại.'
      setDeptModalItem((current) => current ? {
        ...current,
        error: errorMsg,
      } : current)
      showToast(errorMsg, 'error')
    } finally {
      setDeptScopeSaving(false)
    }
  }

  const openDrawer = (type, row) => {
    const id = type === TAB_FORMS ? row.formId : row.assigneeId
    const nextDrawer = {
      type,
      id,
      title: type === TAB_FORMS
        ? (row.formTitle || row.title || 'Bảng kiểm')
        : (row.fullName || row.assigneeName || 'Người nhận'),
      subtitle: type === TAB_FORMS
        ? ''
        : row.employeeCode,
    }
    setDrawer(nextDrawer)
    loadDrawerItems(nextDrawer)
  }

  const resetCurrentFilters = () => {
    setKeyword('')
    setPage(0)
    if (activeTab === TAB_FORMS) {
      setFormFilters({ ownerDepartmentId: '', expiringSoon: '' })
    } else {
      setAssigneeFilters({ departmentId: '', roleCode: '', expiringSoon: '' })
    }
  }

  const selectMetric = (metric) => {
    setPage(0)
    if (metric === 'forms') {
      setActiveTab(TAB_FORMS)
      setFormFilters((current) => ({ ...current, expiringSoon: '' }))
      return
    }
    if (metric === 'assignees') {
      setActiveTab(TAB_ASSIGNEES)
      setAssigneeFilters((current) => ({ ...current, expiringSoon: '' }))
      return
    }
    if (metric === 'expiring') {
      if (activeTab === TAB_FORMS) setFormFilters((current) => ({ ...current, expiringSoon: 'true' }))
      else setAssigneeFilters((current) => ({ ...current, expiringSoon: 'true' }))
      return
    }
    resetCurrentFilters()
  }

  const mutateDrawerItems = async (mode) => {
    if (selectedItemIds.length === 0) {
      const warnMsg = 'Vui lòng chọn ít nhất một quyền để thao tác.'
      setError(warnMsg)
      showToast(warnMsg, 'warning')
      return
    }
    setDrawerSubmitting(true)
    setError('')
    setMessage('')
    try {
      if (mode === 'validity') {
        await adminApi.updateFormAssignmentItemValidity({
          assignmentItemIds: selectedItemIds.map(Number),
          validUntil: toIsoOrNull(drawerValidUntil),
        })
        const successMsg = `Đã cập nhật hạn cho ${selectedItemIds.length} quyền thành công.`
        setMessage(successMsg)
        showToast(successMsg, 'success')
      } else {
        await adminApi.bulkRevokeFormAssignmentItems({
          assignmentItemIds: selectedItemIds.map(Number),
        })
        const successMsg = `Đã thu hồi ${selectedItemIds.length} quyền thành công.`
        setMessage(successMsg)
        showToast(successMsg, 'success')
      }
      setRefreshKey((current) => current + 1)
      await loadDrawerItems()
    } catch (requestError) {
      const errorMsg = requestError?.response?.data?.message || (mode === 'revoke' ? 'Thu hồi quyền thất bại.' : 'Không thể cập nhật hạn quyền đã chọn.')
      setError(errorMsg)
      showToast(errorMsg, 'error')
    } finally {
      setDrawerSubmitting(false)
    }
  }

  const searchFormCandidates = async (query = '') => {
    setFormCandidateLoading(true)
    try {
      const response = await adminApi.getFormAssignmentFormCandidates({ keyword: query, page: 0, size: 50 })
      const options = getPageData(response).content.map(buildFormOption)
      const selectedMap = new Map(selectedFormOptions.map((option) => [String(option.value), option]))
      options.forEach((option) => selectedMap.set(String(option.value), option))
      setFormCandidateOptions(Array.from(selectedMap.values()))
    } finally {
      setFormCandidateLoading(false)
    }
  }

  const searchAssigneeCandidates = async (query = '') => {
    setAssigneeCandidateLoading(true)
    try {
      const response = await adminApi.getFormAssignmentAssigneeCandidates({ keyword: query, page: 0, size: 50 })
      const options = getPageData(response).content.map(buildAssigneeOption)
      const selectedMap = new Map(selectedAssigneeOptions.map((option) => [String(option.value), option]))
      options.forEach((option) => selectedMap.set(String(option.value), option))
      setAssigneeCandidateOptions(Array.from(selectedMap.values()))
    } finally {
      setAssigneeCandidateLoading(false)
    }
  }

  useEffect(() => {
    if (!wizardOpen) return
    searchFormCandidates('')
    searchAssigneeCandidates('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardOpen])

  useEffect(() => {
    if (
      !wizardOpen
      || wizardStep !== 4
      || selectedFormIds.length === 0
      || selectedAssigneeIds.length === 0
      || selectedDepartmentIds.length === 0
    ) {
      setPreview(null)
      return
    }
    const validityDateError = getValidityDateError(validUntil)
    if (validityDateError) {
      setPreview(null)
      setPreviewLoading(false)
      setWizardError(validityDateError)
      return
    }
    let cancelled = false
    async function loadPreview() {
      setPreviewLoading(true)
      try {
        const response = await adminApi.previewBulkFormAssignment({
          formIds: selectedFormIds.map(Number),
          assigneeIds: selectedAssigneeIds.map(Number),
          departmentIds: selectedDepartmentIds.map(Number),
          validUntil: toIsoOrNull(validUntil),
        })
        if (!cancelled) {
          setPreview(response.data?.data || null)
          setWizardError('')
        }
      } catch (requestError) {
        if (!cancelled) setWizardError(extractApiErrorMessage(requestError, 'Không thể xem trước phân quyền.'))
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }
    loadPreview()
    return () => {
      cancelled = true
    }
  }, [selectedAssigneeIds, selectedDepartmentIds, selectedFormIds, validUntil, wizardOpen, wizardStep])

  const changeWizardForms = (nextValues) => {
    if (nextValues.length > MAX_FORMS) {
      setWizardError(`Chỉ được chọn tối đa ${MAX_FORMS} bảng kiểm.`)
      return
    }
    setWizardError('')
    setSelectedFormIds(nextValues)
    const optionMap = new Map([...selectedFormOptions, ...formCandidateOptions].map((option) => [String(option.value), option]))
    setSelectedFormOptions(nextValues.map((value) => optionMap.get(String(value)) || { value, label: value }))
  }

  const changeWizardAssignees = (nextValues) => {
    setWizardError('')
    setSelectedAssigneeIds(nextValues)
    const optionMap = new Map([...selectedAssigneeOptions, ...assigneeCandidateOptions].map((option) => [String(option.value), option]))
    setSelectedAssigneeOptions(nextValues.map((value) => optionMap.get(String(value)) || { value, label: value }))
  }

  const changeWizardDepartments = (nextValues) => {
    setWizardError('')
    setSelectedDepartmentIds(nextValues)
    const optionMap = new Map([...selectedDepartmentOptions, ...wizardDepartmentOptions].map((option) => [String(option.value), option]))
    setSelectedDepartmentOptions(nextValues.map((value) => optionMap.get(String(value)) || { value, label: value }))
  }

  const selectAllManagers = async () => {
    setManagerCandidateLoading(true)
    setWizardError('')
    try {
      const response = await adminApi.getFormAssignmentManagerCandidates()
      const managers = Array.isArray(response?.data?.data) ? response.data.data : []
      const options = managers.map(buildAssigneeOption)
      const selectedMap = new Map(selectedAssigneeOptions.map((option) => [String(option.value), option]))
      options.forEach((option) => selectedMap.set(String(option.value), option))
      const mergedOptions = Array.from(selectedMap.values())
      setSelectedAssigneeOptions(mergedOptions)
      setSelectedAssigneeIds(mergedOptions.map((option) => String(option.value)))
      const candidateMap = new Map([...assigneeCandidateOptions, ...options].map((option) => [String(option.value), option]))
      setAssigneeCandidateOptions(Array.from(candidateMap.values()))
    } catch (requestError) {
      const errorMsg = extractApiErrorMessage(requestError, 'Không thể chọn tất cả quản lý.')
      setWizardError(errorMsg)
      showToast(errorMsg, 'error')
    } finally {
      setManagerCandidateLoading(false)
    }
  }

  const selectAllDepartments = () => {
    const options = wizardDepartmentOptions
    setSelectedDepartmentOptions(options)
    setSelectedDepartmentIds(options.map((option) => String(option.value)))
    setWizardError('')
  }

  const changeWizardValidUntil = (nextValue) => {
    setValidUntil(nextValue)
    setWizardError(getValidityDateError(nextValue))
  }

  const closeWizard = () => {
    setWizardOpen(false)
    setWizardStep(1)
    setSelectedFormIds([])
    setSelectedAssigneeIds([])
    setSelectedDepartmentIds([])
    setSelectedFormOptions([])
    setSelectedAssigneeOptions([])
    setSelectedDepartmentOptions([])
    setValidUntil('')
    setPreview(null)
    setWizardError('')
  }

  const submitWizard = async () => {
    const validityDateError = getValidityDateError(validUntil)
    if (validityDateError) {
      setWizardError(validityDateError)
      return
    }
    if (selectedDepartmentIds.length === 0) {
      setWizardError('Vui lòng chọn ít nhất một khoa/phòng được phép chấm.')
      return
    }
    setWizardSubmitting(true)
    setWizardError('')
    setMessage('')
    try {
      const response = await adminApi.bulkAssignForms({
        formIds: selectedFormIds.map(Number),
        assigneeIds: selectedAssigneeIds.map(Number),
        departmentIds: selectedDepartmentIds.map(Number),
        validUntil: toIsoOrNull(validUntil),
      })
      const result = response.data?.data || {}
      const successMsg = `Đã giao bảng kiểm thành công! (Tạo mới ${result.createdCount || result.newCount || 0}, cập nhật ${result.updatedCount || 0}, khôi phục ${result.restoredCount || 0})`
      setMessage(successMsg)
      showToast('Giao bảng kiểm thành công!', 'success')
      closeWizard()
      setRefreshKey((current) => current + 1)
    } catch (requestError) {
      const errorMsg = extractApiErrorMessage(requestError, 'Không thể giao bảng kiểm. Vui lòng kiểm tra lại lựa chọn.')
      setWizardError(errorMsg)
      showToast(errorMsg, 'error')
    } finally {
      setWizardSubmitting(false)
    }
  }

  const rows = activeTab === TAB_FORMS ? forms : assignees

  return (
    <AppShell breadcrumbs={[
      { label: 'Giám sát tuân thủ' },
      { label: 'Giao bảng kiểm' },
    ]}>
      <div className="cap-assignment-page">
        <section className="cap-assignment-toolbar">
          <label className="cap-assignment-search">
            <SearchOutlined aria-hidden="true" />
            <input
              type="search"
              value={keyword}
              placeholder={activeTab === TAB_FORMS ? 'Tìm theo tên hoặc mã bảng kiểm...' : 'Tìm theo tên hoặc mã nhân viên...'}
              onChange={(event) => {
                setKeyword(event.target.value)
                setPage(0)
              }}
            />
          </label>
          <button
            type="button"
            className="cap-assignment-primary"
            onClick={() => {
              setWizardError('')
              setWizardOpen(true)
            }}
          >
            <PlusOutlined /> Giao bảng kiểm
          </button>
        </section>

        {(message || error) && (
          <div className={`cap-assignment-feedback ${error ? 'cap-assignment-feedback--error' : ''}`} role={error ? 'alert' : 'status'}>
            <span>{error || message}</span>
            <button type="button" onClick={() => { setError(''); setMessage('') }} aria-label="Đóng thông báo">×</button>
          </div>
        )}

        <section className="cap-assignment-metrics" aria-label="Chỉ số giao bảng kiểm">
          <button type="button" onClick={() => selectMetric('forms')}>
            <FileDoneOutlined />
            <span>Số bảng kiểm đang được giao</span>
            <strong>{overview?.assignedFormCount ?? 0}</strong>
          </button>
          <button type="button" onClick={() => selectMetric('assignees')}>
            <TeamOutlined />
            <span>Số người đang nhận bảng kiểm</span>
            <strong>{overview?.recipientCount ?? 0}</strong>
          </button>
          <button type="button" onClick={() => selectMetric('pairs')}>
            <UserSwitchOutlined />
            <span>Tổng số cặp quyền hiệu lực</span>
            <strong>{overview?.activePairCount ?? 0}</strong>
          </button>
          <button type="button" onClick={() => selectMetric('expiring')}>
            <CalendarOutlined />
            <span>Quyền hết hạn trong 7 ngày</span>
            <strong>{overview?.expiringSoonCount ?? 0}</strong>
          </button>
        </section>

        <section className="cap-assignment-panel">
          <div className="cap-assignment-tabs" role="tablist" aria-label="Kiểu xem giao bảng kiểm">
            <button type="button" role="tab" aria-selected={activeTab === TAB_FORMS} onClick={() => { setActiveTab(TAB_FORMS); setPage(0) }}>
              Theo bảng kiểm
            </button>
            <button type="button" role="tab" aria-selected={activeTab === TAB_ASSIGNEES} onClick={() => { setActiveTab(TAB_ASSIGNEES); setPage(0) }}>
              Theo người nhận
            </button>
          </div>

          <div className="cap-assignment-filters">
            {activeTab === TAB_FORMS ? (
              <>
                <FilterSelectField
                  label="Khoa sở hữu"
                  value={formFilters.ownerDepartmentId}
                  onChange={(value) => { setFormFilters((current) => ({ ...current, ownerDepartmentId: value })); setPage(0) }}
                  options={departmentOptions}
                  placeholder="Tất cả khoa/phòng"
                  searchable
                />
                <FilterSelectField
                  label="Tình trạng hạn"
                  value={formFilters.expiringSoon}
                  onChange={(value) => { setFormFilters((current) => ({ ...current, expiringSoon: value })); setPage(0) }}
                  options={EXPIRING_OPTIONS}
                  placeholder="Tất cả quyền"
                />
              </>
            ) : (
              <>
                <FilterSelectField
                  label="Khoa/phòng"
                  value={assigneeFilters.departmentId}
                  onChange={(value) => { setAssigneeFilters((current) => ({ ...current, departmentId: value })); setPage(0) }}
                  options={departmentOptions}
                  placeholder="Tất cả khoa/phòng"
                  searchable
                />
                <FilterSelectField
                  label="Vai trò"
                  value={assigneeFilters.roleCode}
                  onChange={(value) => { setAssigneeFilters((current) => ({ ...current, roleCode: value })); setPage(0) }}
                  options={ROLE_FILTER_OPTIONS}
                  placeholder="Tất cả vai trò"
                />
                <FilterSelectField
                  label="Tình trạng hạn"
                  value={assigneeFilters.expiringSoon}
                  onChange={(value) => { setAssigneeFilters((current) => ({ ...current, expiringSoon: value })); setPage(0) }}
                  options={EXPIRING_OPTIONS}
                  placeholder="Tất cả quyền"
                />
              </>
            )}
            <div className="cap-assignment-filter-actions">
              <button type="button" onClick={resetCurrentFilters}>Xóa bộ lọc</button>
              <button type="button" onClick={() => setRefreshKey((current) => current + 1)}>
                <ReloadOutlined /> Tải lại
              </button>
            </div>
          </div>

          <div className="cap-assignment-table-wrap">
            {loading ? (
              <div className="cap-assignment-state"><LoadingOutlined spin /> Đang tải dữ liệu...</div>
            ) : rows.content.length === 0 ? (
              <div className="cap-assignment-state">Chưa có quyền hiệu lực phù hợp với bộ lọc.</div>
            ) : activeTab === TAB_FORMS ? (
              <table className="cap-assignment-table">
                <thead>
                  <tr>
                    <th>Bảng kiểm</th>
                    <th>Phiên bản</th>
                    <th>Khoa sở hữu</th>
                    <th>Người nhận</th>
                    <th>Hạn gần nhất</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.content.map((row) => (
                    <tr key={row.formId}>
                      <td data-label="Bảng kiểm">
                        <strong>{row.formTitle || row.title}</strong>
                      </td>
                      <td data-label="Phiên bản">v{row.versionNumber || '-'}</td>
                      <td data-label="Khoa sở hữu">{row.ownerDepartmentName || 'Chưa có'}</td>
                      <td data-label="Người nhận"><strong>{row.recipientCount || 0}</strong></td>
                      <td data-label="Hạn gần nhất">{formatDate(row.nearestExpiry)}</td>
                      <td>
                        <button type="button" className="cap-assignment-row-action" onClick={() => openDrawer(TAB_FORMS, row)}>
                          <EyeOutlined /> Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="cap-assignment-table">
                <thead>
                  <tr>
                    <th>Người nhận</th>
                    <th>Khoa/phòng</th>
                    <th>Vai trò</th>
                    <th>Bảng kiểm</th>
                    <th>Hạn gần nhất</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.content.map((row) => (
                    <tr key={row.assigneeId}>
                      <td data-label="Người nhận">
                        <strong>{row.fullName || row.assigneeName}</strong>
                        <span>{row.employeeCode || 'Chưa có mã'}</span>
                      </td>
                      <td data-label="Khoa/phòng">{row.departmentName || 'Chưa có'}</td>
                      <td data-label="Vai trò">{getRoleText(row.roleCodes)}</td>
                      <td data-label="Bảng kiểm"><strong>{row.formCount || 0}</strong></td>
                      <td data-label="Hạn gần nhất">{formatDate(row.nearestExpiry)}</td>
                      <td>
                        <button type="button" className="cap-assignment-row-action" onClick={() => openDrawer(TAB_ASSIGNEES, row)}>
                          <EyeOutlined /> Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="cap-assignment-pagination">
            <span>Hiển thị {rows.totalElements === 0 ? 0 : page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, rows.totalElements)} / {rows.totalElements}</span>
            <button type="button" disabled={page <= 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Trước</button>
            <strong>{page + 1}/{Math.max(rows.totalPages || 1, 1)}</strong>
            <button type="button" disabled={page + 1 >= Math.max(rows.totalPages || 1, 1)} onClick={() => setPage((current) => current + 1)}>Sau</button>
          </div>
        </section>
      </div>

      {drawer && (
        <div className="cap-assignment-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDrawer()
        }}>
          <aside className="cap-assignment-drawer" role="dialog" aria-modal="true" aria-label="Chi tiết quyền giao bảng kiểm" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>{drawer.type === TAB_FORMS ? 'Chi tiết theo bảng kiểm' : 'Chi tiết theo người nhận'}</span>
                <h2>{drawer.title}</h2>
                {drawer.type === TAB_ASSIGNEES && drawer.subtitle && <p>{drawer.subtitle}</p>}
              </div>
              <button type="button" onClick={closeDrawer} aria-label="Đóng chi tiết"><CloseOutlined /></button>
            </header>
            <div className="cap-assignment-drawer__body">
              {drawerLoading ? (
                <div className="cap-assignment-state"><LoadingOutlined spin /> Đang tải chi tiết...</div>
              ) : drawerItems.length === 0 ? (
                <div className="cap-assignment-state">Không còn quyền hiệu lực.</div>
              ) : (
                <div className="cap-assignment-item-list">
                  <label className="cap-assignment-check-all">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.length === drawerItems.length}
                      onChange={(event) => setSelectedItemIds(event.target.checked ? drawerItems.map((item) => String(item.assignmentItemId)) : [])}
                    />
                    Chọn tất cả quyền đang hiển thị
                  </label>
                  {drawerItems.map((item) => (
                    <label className="cap-assignment-item" key={item.assignmentItemId}>
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(String(item.assignmentItemId))}
                        onChange={(event) => {
                          const itemId = String(item.assignmentItemId)
                          setSelectedItemIds((current) => (
                            event.target.checked ? [...current, itemId] : current.filter((value) => value !== itemId)
                          ))
                        }}
                      />
                      <span>
                        <strong>{drawer.type === TAB_FORMS ? (item.assigneeName || item.fullName) : item.formTitle}</strong>
                        <small>
                          {drawer.type === TAB_FORMS
                            ? `${item.employeeCode || 'Chưa có mã'} · ${item.departmentName || 'Chưa có khoa/phòng'}`
                            : `Phiên bản v${item.versionNumber || '-'}`}
                        </small>
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <small style={{ color: '#64748b' }}>Phạm vi:</small>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              handleOpenDeptModal(item)
                            }}
                            className="cap-scope-pill-btn"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: 6,
                              border: '1px solid #087f6a',
                              background: '#f0fdf9',
                              color: '#087f6a',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: 'pointer',
                              lineHeight: 1.4,
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#ccfbf1'; e.currentTarget.style.borderColor = '#0f766e' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#f0fdf9'; e.currentTarget.style.borderColor = '#087f6a' }}
                            title="Nhấn để xem danh sách khoa/phòng"
                          >
                            {(item.allowedDepartmentCount === 0 || (!item.allowedDepartmentCount && (!item.allowedDepartments || item.allowedDepartments.length === 0)))
                              ? 'Tất cả khoa/phòng'
                              : `${item.allowedDepartmentCount || item.allowedDepartments.length} khoa/phòng`}
                          </button>
                        </div>
                      </span>
                      <em>Hạn: {formatDate(item.validUntil)}</em>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <footer>
              <DateTimePicker24h value={drawerValidUntil} onChange={setDrawerValidUntil} disabled={drawerSubmitting} />
              <button type="button" disabled={drawerSubmitting || selectedItemIds.length === 0} onClick={() => mutateDrawerItems('validity')}>
                {drawerSubmitting ? <LoadingOutlined spin /> : <CheckCircleOutlined />} Cập nhật hạn
              </button>
              <button type="button" className="cap-assignment-danger" disabled={drawerSubmitting || selectedItemIds.length === 0} onClick={() => mutateDrawerItems('revoke')}>
                <StopOutlined /> Thu hồi
              </button>
            </footer>
          </aside>
        </div>
      )}

      {wizardOpen && (
        <div className="cap-assignment-overlay" role="presentation">
          <section className="cap-assignment-wizard" role="dialog" aria-modal="true" aria-labelledby="cap-assignment-wizard-title">
            <header>
              <div>
                <span>Bước {wizardStep}/{WIZARD_TOTAL_STEPS}</span>
                <h2 id="cap-assignment-wizard-title">Giao bảng kiểm</h2>
              </div>
              <button type="button" onClick={closeWizard} aria-label="Đóng giao bảng kiểm"><CloseOutlined /></button>
            </header>
            <div className="cap-assignment-wizard__steps" aria-hidden="true">
              {Array.from({ length: WIZARD_TOTAL_STEPS }, (_, index) => index + 1)
                .map((step) => <span key={step} className={step <= wizardStep ? 'is-active' : ''} />)}
            </div>
            <div className="cap-assignment-wizard__body">
              {wizardError && (
                <div className="cap-assignment-wizard-alert" role="alert">
                  <span>{wizardError}</span>
                  <button type="button" onClick={() => setWizardError('')} aria-label="Đóng thông báo lỗi">×</button>
                </div>
              )}
              {wizardStep === 1 && (
                <>
                  <h3>Chọn bảng kiểm đang công bố</h3>
                  <div className="cap-assignment-picker-grid">
                    <div className="cap-assignment-picker-main">
                      <SearchableSelect
                        multiple
                        value={selectedFormIds}
                        selectedOptions={selectedFormOptions}
                        options={formCandidateOptions}
                        loading={formCandidateLoading}
                        onSearch={searchFormCandidates}
                        onChange={changeWizardForms}
                        placeholder="Tìm và chọn tối đa 25 bảng kiểm..."
                        searchPlaceholder="Nhập tên hoặc mã bảng kiểm..."
                        showDescriptions={false}
                        showSelectedChips={false}
                        keepSearchOnSelect
                      />
                      <SelectionLimitNotice formsCount={selectedFormIds.length} assigneesCount={selectedAssigneeIds.length} />
                    </div>
                    <WizardSelectedList
                      title="Bảng kiểm đã chọn"
                      count={`${selectedFormIds.length}/${MAX_FORMS}`}
                      options={selectedFormOptions}
                      emptyText="Chưa chọn bảng kiểm nào."
                      onRemove={(value) => changeWizardForms(selectedFormIds.filter((selectedValue) => selectedValue !== String(value)))}
                    />
                  </div>
                </>
              )}
              {wizardStep === 2 && (
                <>
                  <div className="cap-assignment-wizard__heading-row">
                    <h3>Chọn người chấm</h3>
                    <button type="button" onClick={selectAllManagers} disabled={managerCandidateLoading}>
                      {managerCandidateLoading ? <LoadingOutlined spin /> : <UserSwitchOutlined />} Chọn tất cả quản lý
                    </button>
                  </div>
                  <div className="cap-assignment-picker-grid">
                    <div className="cap-assignment-picker-main">
                      <SearchableSelect
                        multiple
                        value={selectedAssigneeIds}
                        selectedOptions={selectedAssigneeOptions}
                        options={assigneeCandidateOptions}
                        loading={assigneeCandidateLoading}
                        onSearch={searchAssigneeCandidates}
                        onChange={changeWizardAssignees}
                        placeholder="Tìm và chọn người nhận..."
                        searchPlaceholder="Nhập tên hoặc mã nhân viên..."
                        showSelectedChips={false}
                        keepSearchOnSelect
                      />
                      <SelectionLimitNotice formsCount={selectedFormIds.length} assigneesCount={selectedAssigneeIds.length} />
                    </div>
                    <WizardSelectedList
                      title="Người nhận đã chọn"
                      count={String(selectedAssigneeIds.length)}
                      options={selectedAssigneeOptions}
                      emptyText="Chưa chọn người nhận nào."
                      onRemove={(value) => changeWizardAssignees(selectedAssigneeIds.filter((selectedValue) => selectedValue !== String(value)))}
                    />
                  </div>
                </>
              )}
              {wizardStep === 3 && (
                <>
                  <div className="cap-assignment-wizard__heading-row">
                    <h3>Chọn khoa/phòng được chấm</h3>
                    <button type="button" onClick={selectAllDepartments} disabled={wizardDepartmentOptions.length === 0}>
                      <ApartmentOutlined /> Chọn tất cả khoa/phòng
                    </button>
                  </div>
                  <div className="cap-assignment-picker-grid">
                    <div className="cap-assignment-picker-main">
                      <SearchableSelect
                        multiple
                        value={selectedDepartmentIds}
                        selectedOptions={selectedDepartmentOptions}
                        options={wizardDepartmentOptions}
                        onChange={changeWizardDepartments}
                        placeholder="Tìm và chọn khoa/phòng..."
                        searchPlaceholder="Nhập tên khoa/phòng..."
                        showDescriptions={false}
                        showSelectedChips={false}
                        keepSearchOnSelect
                      />
                      <p className="cap-assignment-wizard__limit">
                        Người được giao chỉ được chấm nhân viên thuộc các khoa/phòng đã chọn.
                      </p>
                    </div>
                    <WizardSelectedList
                      title="Khoa/phòng đã chọn"
                      count={String(selectedDepartmentIds.length)}
                      options={selectedDepartmentOptions}
                      emptyText="Chưa chọn khoa/phòng nào."
                      onRemove={(value) => changeWizardDepartments(selectedDepartmentIds.filter((selectedValue) => selectedValue !== String(value)))}
                    />
                  </div>
                </>
              )}
              {wizardStep === 4 && (
                <>
                  <h3>Thiết lập hạn và xác nhận</h3>
                  <label className="cap-assignment-date-field">
                    <span>Ngày hết hạn</span>
                    <DateTimePicker24h value={validUntil} onChange={changeWizardValidUntil} disabled={previewLoading || wizardSubmitting} />
                    <small>Bỏ trống nếu quyền không giới hạn thời gian.</small>
                  </label>
                  <div className="cap-assignment-preview">
                    {previewLoading ? (
                      <span><LoadingOutlined spin /> Đang tính toán...</span>
                    ) : (
                      <>
                        <strong>{preview?.totalPairs || 0} cặp quyền</strong>
                        <span>Tạo mới: {preview?.newCount || 0}</span>
                        <span>Cập nhật hạn: {preview?.updatedCount || 0}</span>
                        <span>Khôi phục: {preview?.restoredCount || 0}</span>
                        <span>Không đổi: {preview?.unchangedCount || 0}</span>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            <footer>
              <button
                type="button"
                onClick={wizardStep === 1 ? closeWizard : () => {
                  setWizardError('')
                  setWizardStep((current) => current - 1)
                }}
              >
                {wizardStep === 1 ? 'Hủy' : 'Quay lại'}
              </button>
              {wizardStep < WIZARD_TOTAL_STEPS ? (
                <button
                  type="button"
                  className="cap-assignment-primary"
                  disabled={(wizardStep === 1 && selectedFormIds.length === 0)
                    || (wizardStep === 2 && selectedAssigneeIds.length === 0)
                    || (wizardStep === 3 && selectedDepartmentIds.length === 0)}
                  onClick={() => {
                    setWizardError('')
                    setWizardStep((current) => current + 1)
                  }}
                >
                  Tiếp tục
                </button>
              ) : (
                <button
                  type="button"
                  className="cap-assignment-primary"
                  disabled={wizardSubmitting || previewLoading || selectedFormIds.length === 0 || selectedAssigneeIds.length === 0 || selectedDepartmentIds.length === 0}
                  onClick={submitWizard}
                >
                  {wizardSubmitting ? <LoadingOutlined spin /> : <CheckCircleOutlined />} Xác nhận giao
                </button>
              )}
            </footer>
          </section>
        </div>
      )}

      {deptModalItem && (
        <Modal
          title={`Khoa/phòng áp dụng: ${drawer?.type === TAB_FORMS ? (deptModalItem.assigneeName || deptModalItem.fullName) : deptModalItem.formTitle}`}
          onClose={() => { if (!deptScopeSaving) setDeptModalItem(null) }}
          size="md"
          footer={
            <div className="cap-scope-modal__footer">
              <button
                type="button"
                className="cap-scope-modal__secondary"
                disabled={deptScopeSaving}
                onClick={() => setDeptModalItem(null)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="cap-scope-modal__primary"
                disabled={deptScopeSaving || deptModalItem.loading || (deptModalItem.selectedDepartmentIds || []).length === 0}
                onClick={saveDeptModalScope}
              >
                {deptScopeSaving ? <LoadingOutlined spin /> : <SaveOutlined />} Lưu phạm vi
              </button>
            </div>
          }
        >
          {deptModalItem.loading ? (
            <div className="cap-scope-modal__loading">
              <LoadingOutlined spin />
              <div>Đang tải danh sách khoa/phòng...</div>
            </div>
          ) : (
            <div className="cap-scope-modal">
              {deptModalItem.error && (
                <div className="cap-scope-modal__error" role="alert">{deptModalItem.error}</div>
              )}
              <label className="cap-scope-modal__search">
                <SearchOutlined />
                <input
                  type="search"
                  value={deptScopeSearch}
                  onChange={(event) => setDeptScopeSearch(event.target.value)}
                  placeholder="Tìm khoa/phòng theo tên hoặc mã..."
                />
              </label>
              <div className="cap-scope-modal__summary">
                <span>Đang áp dụng <strong>{deptModalSelectedDepartments.length}</strong> khoa/phòng</span>
                {deptModalItem.isAll && <em>Ban đầu là toàn viện, lưu lại để cố định phạm vi mới.</em>}
              </div>
              <section className="cap-scope-modal__section">
                <h4>Khoa/phòng đang áp dụng</h4>
                <div className="cap-scope-modal__grid">
                  {visibleSelectedDepartments.length === 0 ? (
                    <p className="cap-scope-modal__empty">
                      {deptModalSelectedDepartments.length === 0 ? 'Chưa chọn khoa/phòng nào.' : 'Không có khoa/phòng phù hợp từ khóa.'}
                    </p>
                  ) : visibleSelectedDepartments.map((dept) => (
                    <div className="cap-scope-modal__dept is-selected" key={`selected-${dept.departmentId}`}>
                      <ApartmentOutlined />
                      <span>{departmentNameOf(dept)}</span>
                      <button
                        type="button"
                        aria-label={`Xóa ${departmentNameOf(dept)} khỏi phạm vi`}
                        onClick={() => removeDeptFromModalScope(dept.departmentId)}
                      >
                        <CloseOutlined />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              <section className="cap-scope-modal__section">
                <h4>Thêm khoa/phòng</h4>
                <div className="cap-scope-modal__grid">
                  {visibleAvailableDepartments.length === 0 ? (
                    <p className="cap-scope-modal__empty">
                      {deptModalAvailableDepartments.length === 0 ? 'Tất cả khoa/phòng đã được thêm.' : 'Không có khoa/phòng phù hợp từ khóa.'}
                    </p>
                  ) : visibleAvailableDepartments.map((dept) => (
                    <div className="cap-scope-modal__dept" key={`available-${dept.departmentId}`}>
                      <ApartmentOutlined />
                      <span>{departmentNameOf(dept)}</span>
                      <button
                        type="button"
                        aria-label={`Thêm ${departmentNameOf(dept)} vào phạm vi`}
                        onClick={() => addDeptToModalScope(dept.departmentId)}
                      >
                        <PlusOutlined />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </Modal>
      )}
    </AppShell>
  )
}

export default ChecklistAssignmentPage
