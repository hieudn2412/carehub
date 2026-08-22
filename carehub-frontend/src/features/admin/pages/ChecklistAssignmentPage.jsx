import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  EyeOutlined,
  FileDoneOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import DateTimePicker24h from '../../../shared/components/DateTimePicker24h.jsx'
import { adminApi } from '../api/adminApi'
import { getChecklistDisplayCode } from '../utils/formCode.js'
import '../styles/ChecklistAssignmentPage.css'

const PAGE_SIZE = 10
const MAX_FORMS = 25
const MAX_ASSIGNEES = 100

const TAB_FORMS = 'forms'
const TAB_ASSIGNEES = 'assignees'

const EXPIRING_OPTIONS = [
  { value: '', label: 'Tất cả quyền' },
  { value: 'true', label: 'Sắp hết hạn 7 ngày' },
]

const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả vai trò' },
  { value: 'USER', label: 'Nhân viên' },
  { value: 'MANAGER', label: 'Quản lý' },
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
  const roleLabels = {
    USER: 'Nhân viên',
    ROLE_USER: 'Nhân viên',
    STAFF: 'Nhân viên',
    ROLE_STAFF: 'Nhân viên',
    MANAGER: 'Quản lý',
    ROLE_MANAGER: 'Quản lý',
    ADMIN: 'Quản trị viên',
    ROLE_ADMIN: 'Quản trị viên',
  }
  const formatRole = (role) => roleLabels[String(role || '').trim().toUpperCase()] || role
  if (Array.isArray(value)) {
    const labels = value.map(formatRole).filter(Boolean)
    return labels.length > 0 ? Array.from(new Set(labels)).join(', ') : 'Chưa có vai trò'
  }
  return formatRole(value) || 'Chưa có vai trò'
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

function SelectionLimitNotice({ formsCount, assigneesCount }) {
  return (
    <p className="cap-assignment-wizard__limit">
      Có thể chọn tối đa {MAX_FORMS} bảng kiểm và {MAX_ASSIGNEES} người nhận trong một lần giao.
      Hiện đã chọn {formsCount} bảng kiểm, {assigneesCount} người nhận.
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

  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [selectedFormIds, setSelectedFormIds] = useState([])
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([])
  const [selectedFormOptions, setSelectedFormOptions] = useState([])
  const [selectedAssigneeOptions, setSelectedAssigneeOptions] = useState([])
  const [formCandidateOptions, setFormCandidateOptions] = useState([])
  const [assigneeCandidateOptions, setAssigneeCandidateOptions] = useState([])
  const [formCandidateLoading, setFormCandidateLoading] = useState(false)
  const [assigneeCandidateLoading, setAssigneeCandidateLoading] = useState(false)
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

  const activeFilters = activeTab === TAB_FORMS ? formFilters : assigneeFilters

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('tab', activeTab)
    if (keyword.trim()) params.set('keyword', keyword.trim())
    if (page) params.set('page', String(page))
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value) params.set(key, value)
    })
    if (initialFormId) params.set('formId', initialFormId)
    setSearchParams(params, { replace: true })
  }, [activeFilters, activeTab, initialFormId, keyword, page, setSearchParams])

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
      setDrawerItems(getPageData(response).content)
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Không thể tải chi tiết quyền.')
      setDrawerItems([])
    } finally {
      setDrawerLoading(false)
    }
  }, [drawer])

  useEffect(() => {
    if (!initialFormId || drawer) return
    const nextDrawer = { type: TAB_FORMS, id: initialFormId, title: `Bảng kiểm #${initialFormId}` }
    setDrawer(nextDrawer)
    loadDrawerItems(nextDrawer)
  }, [drawer, initialFormId, loadDrawerItems])

  const closeDrawer = useCallback(() => {
    setDrawer(null)
    setDrawerItems([])
    setSelectedItemIds([])
    setDrawerValidUntil('')
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('formId')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!drawer) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeDrawer, drawer])

  const openDrawer = (type, row) => {
    const nextDrawer = {
      type,
      id: type === TAB_FORMS ? row.formId : row.assigneeId,
      title: type === TAB_FORMS
        ? (row.formTitle || row.title || 'Bảng kiểm')
        : (row.fullName || row.assigneeName || 'Người nhận'),
      subtitle: type === TAB_FORMS
        ? getChecklistDisplayCode(row.formCode || row.code)
        : row.employeeCode,
    }
    setDrawer(nextDrawer)
    if (type === TAB_FORMS) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('tab', TAB_FORMS)
      nextParams.set('formId', String(nextDrawer.id))
      setSearchParams(nextParams, { replace: true })
    }
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
      setError('Vui lòng chọn ít nhất một quyền để thao tác.')
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
        setMessage(`Đã cập nhật hạn cho ${selectedItemIds.length} quyền.`)
      } else {
        await adminApi.bulkRevokeFormAssignmentItems({
          assignmentItemIds: selectedItemIds.map(Number),
        })
        setMessage(`Đã thu hồi ${selectedItemIds.length} quyền.`)
      }
      setRefreshKey((current) => current + 1)
      await loadDrawerItems()
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Không thể cập nhật quyền đã chọn.')
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
    if (!wizardOpen || wizardStep !== 3 || selectedFormIds.length === 0 || selectedAssigneeIds.length === 0) {
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
  }, [selectedAssigneeIds, selectedFormIds, validUntil, wizardOpen, wizardStep])

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
    if (nextValues.length > MAX_ASSIGNEES) {
      setWizardError(`Chỉ được chọn tối đa ${MAX_ASSIGNEES} người nhận.`)
      return
    }
    setWizardError('')
    setSelectedAssigneeIds(nextValues)
    const optionMap = new Map([...selectedAssigneeOptions, ...assigneeCandidateOptions].map((option) => [String(option.value), option]))
    setSelectedAssigneeOptions(nextValues.map((value) => optionMap.get(String(value)) || { value, label: value }))
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
    setSelectedFormOptions([])
    setSelectedAssigneeOptions([])
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
    setWizardSubmitting(true)
    setWizardError('')
    setMessage('')
    try {
      const response = await adminApi.bulkAssignForms({
        formIds: selectedFormIds.map(Number),
        assigneeIds: selectedAssigneeIds.map(Number),
        validUntil: toIsoOrNull(validUntil),
      })
      const result = response.data?.data || {}
      setMessage(`Đã xử lý ${result.totalPairs || 0} cặp quyền. Tạo mới ${result.newCount || 0}, cập nhật ${result.updatedCount || 0}, khôi phục ${result.restoredCount || 0}.`)
      closeWizard()
      setRefreshKey((current) => current + 1)
    } catch (requestError) {
      setWizardError(extractApiErrorMessage(requestError, 'Không thể giao bảng kiểm. Vui lòng kiểm tra lại lựa chọn.'))
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
                {drawer.subtitle && <p>{drawer.subtitle}</p>}
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
                            : `${getChecklistDisplayCode(item.formCode)} · v${item.versionNumber || '-'}`}
                        </small>
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
                <span>Bước {wizardStep}/3</span>
                <h2 id="cap-assignment-wizard-title">Giao bảng kiểm</h2>
              </div>
              <button type="button" onClick={closeWizard} aria-label="Đóng giao bảng kiểm"><CloseOutlined /></button>
            </header>
            <div className="cap-assignment-wizard__steps" aria-hidden="true">
              {[1, 2, 3].map((step) => <span key={step} className={step <= wizardStep ? 'is-active' : ''} />)}
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
                  <h3>Chọn người nhận active</h3>
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
                        placeholder="Tìm và chọn tối đa 100 người nhận..."
                        searchPlaceholder="Nhập tên hoặc mã nhân viên..."
                        showSelectedChips={false}
                        keepSearchOnSelect
                      />
                      <SelectionLimitNotice formsCount={selectedFormIds.length} assigneesCount={selectedAssigneeIds.length} />
                    </div>
                    <WizardSelectedList
                      title="Người nhận đã chọn"
                      count={`${selectedAssigneeIds.length}/${MAX_ASSIGNEES}`}
                      options={selectedAssigneeOptions}
                      emptyText="Chưa chọn người nhận nào."
                      onRemove={(value) => changeWizardAssignees(selectedAssigneeIds.filter((selectedValue) => selectedValue !== String(value)))}
                    />
                  </div>
                </>
              )}
              {wizardStep === 3 && (
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
              {wizardStep < 3 ? (
                <button
                  type="button"
                  className="cap-assignment-primary"
                  disabled={(wizardStep === 1 && selectedFormIds.length === 0) || (wizardStep === 2 && selectedAssigneeIds.length === 0)}
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
                  disabled={wizardSubmitting || previewLoading || selectedFormIds.length === 0 || selectedAssigneeIds.length === 0}
                  onClick={submitWizard}
                >
                  {wizardSubmitting ? <LoadingOutlined spin /> : <CheckCircleOutlined />} Xác nhận giao
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
    </AppShell>
  )
}

export default ChecklistAssignmentPage
