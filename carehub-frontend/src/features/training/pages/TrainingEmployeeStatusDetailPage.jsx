import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import AppShell from '../../../shared/components/AppShell.jsx'
import KeyboardDatePicker from '../../../shared/components/KeyboardDatePicker.jsx'
import LoadingState from '../../../shared/components/LoadingState.jsx'
import FilterActionButtons from '../../../shared/components/FilterActionButtons.jsx'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import { validateHistoricalDateRange } from '../../../shared/utils/dateRange.js'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FilterOutlined,
  FileTextOutlined,
  EyeOutlined,
  HourglassOutlined,
  LeftOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import '../styles/TrainingEmployeeStatusDetailPage.css'

const TODAY = getLocalDateInputValue()

const DEFAULT_RECORD_FILTERS = {
  keyword: '',
  workflowStatus: '',
  dateFrom: `${new Date().getFullYear()}-01-01`,
  dateTo: TODAY,
  professionalFieldId: '',
  activityTypeId: '',
  hasEvidence: '',
  moderationStatus: '',
  sourceType: '',
}

function countActiveRecordFilters(filters) {
  return [
    filters.workflowStatus,
    filters.dateFrom !== DEFAULT_RECORD_FILTERS.dateFrom || filters.dateTo !== DEFAULT_RECORD_FILTERS.dateTo,
    filters.professionalFieldId,
    filters.activityTypeId,
    filters.hasEvidence,
    filters.moderationStatus,
    filters.sourceType,
  ].filter(Boolean).length
}

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function TrainingEmployeeStatusDetailPage() {
  const { employeeId } = useParams()

  const [loading, setLoading] = useState(true)
  const [statusRefreshing, setStatusRefreshing] = useState(false)
  const [error, setError] = useState(null)

  const [employeeInfo, setEmployeeInfo] = useState({
    employeeName: '',
    employeeCode: '',
    departmentName: '',
    jobPositionName: '',
    lastTrainingDate: '',
    submittedHours: 0,
    requiredHours: 0,
    remainingHours: 0,
    progressPercentage: 0,
    complianceStatus: 'NON_COMPLIANT',
    requirementName: '',
    cycleYears: null,
    windowStart: '',
    windowEnd: '',
    warningMessage: '',
    yearlyHours: [],
    activityTypeHours: [],
  })
  const [statusFilters, setStatusFilters] = useState({ professionalFieldId: '', asOf: TODAY })

  const [recordsList, setRecordsList] = useState([])
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState('')
  const [page, setPage] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filterDraft, setFilterDraft] = useState(DEFAULT_RECORD_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_RECORD_FILTERS)
  const [filterOptions, setFilterOptions] = useState({ activityTypes: [], professionalFields: [] })
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(true)
  const [filterOptionsError, setFilterOptionsError] = useState('')
  const [filterDateError, setFilterDateError] = useState('')
  const pageSize = 10

  useEffect(() => {
    setLoading(true)
  }, [employeeId])

  useEffect(() => {
    let active = true

    async function loadStatus() {
      setStatusRefreshing(true)
      setError(null)
      try {
        const statusResponse = await trainingApi.getEmployeeTrainingStatus(employeeId, {
          professionalFieldId: statusFilters.professionalFieldId
            ? Number(statusFilters.professionalFieldId)
            : undefined,
          asOf: statusFilters.asOf || undefined,
        })
        const statusData = statusResponse.data?.data
        if (active && statusData) {
          setEmployeeInfo(current => ({
            employeeName: statusData.employeeName || '---',
            employeeCode: statusData.employeeCode || '---',
            departmentName: current.employeeCode === statusData.employeeCode ? current.departmentName : '',
            jobPositionName: current.employeeCode === statusData.employeeCode ? current.jobPositionName : '',
            lastTrainingDate: current.employeeCode === statusData.employeeCode ? current.lastTrainingDate : '',
            submittedHours: statusData.submittedHours || 0,
            requiredHours: statusData.requiredHours ?? 0,
            remainingHours: statusData.remainingHours ?? 0,
            progressPercentage: statusData.progressPercentage ?? 0,
            complianceStatus: statusData.status === 'COMPLIANT' ? 'COMPLIANT' : 'NON_COMPLIANT',
            requirementName: statusData.requirementName || '',
            cycleYears: statusData.cycleYears ?? null,
            windowStart: statusData.windowStart || '',
            windowEnd: statusData.windowEnd || '',
            warningMessage: statusData.warningMessage || '',
            yearlyHours: Array.isArray(statusData.yearlyHours) ? statusData.yearlyHours : [],
            activityTypeHours: Array.isArray(statusData.activityTypeHours) ? statusData.activityTypeHours : [],
          }))
        }
      } catch (err) {
        console.error('API fetch error in employee training status details:', err)
        if (active) setError("Không thể tải chi tiết đào tạo nhân viên.")
      } finally {
        if (active) {
          setLoading(false)
          setStatusRefreshing(false)
        }
      }
    }

    loadStatus()
    return () => { active = false }
  }, [employeeId, statusFilters])

  useEffect(() => {
    const employeeCode = employeeInfo.employeeCode
    if (!employeeCode || employeeCode === '---') return undefined

    let active = true
    trainingApi.getEmployeeTrainingStatuses({
      keyword: employeeCode,
      page: 0,
      size: 20,
    })
      .then(response => {
        if (!active) return
        const rows = response.data?.data?.content || []
        const profile = rows.find(item => String(item.employeeId) === String(employeeId))
        if (!profile) return
        setEmployeeInfo(current => ({
          ...current,
          departmentName: profile.departmentName || '',
          jobPositionName: profile.jobPositionName || '',
          lastTrainingDate: profile.lastTrainingDate || '',
        }))
      })
      .catch(() => {})

    return () => { active = false }
  }, [employeeId, employeeInfo.employeeCode])

  useEffect(() => {
    let active = true
    setFilterOptionsLoading(true)
    setFilterOptionsError('')
    trainingApi.getRecordOptions()
      .then(response => {
        if (!active) return
        const data = response.data?.data || {}
        setFilterOptions({
          activityTypes: Array.isArray(data.activityTypes) ? data.activityTypes : [],
          professionalFields: Array.isArray(data.professionalFields) ? data.professionalFields : [],
        })
      })
      .catch(() => {
        if (active) setFilterOptionsError('Không thể tải danh sách bộ lọc.')
      })
      .finally(() => {
        if (active) setFilterOptionsLoading(false)
      })

    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    setRecordsLoading(true)
    setRecordsError('')
    trainingApi.listRecords({
      employeeId: Number(employeeId),
      page,
      size: pageSize,
      titleKeyword: appliedFilters.keyword.trim() || undefined,
      workflowStatus: appliedFilters.workflowStatus || undefined,
      dateFrom: appliedFilters.dateFrom || undefined,
      dateTo: appliedFilters.dateTo || undefined,
      professionalFieldId: appliedFilters.professionalFieldId
        ? Number(appliedFilters.professionalFieldId)
        : undefined,
      activityTypeId: appliedFilters.activityTypeId
        ? Number(appliedFilters.activityTypeId)
        : undefined,
      hasEvidence: appliedFilters.hasEvidence === ''
        ? undefined
        : appliedFilters.hasEvidence === 'true',
      moderationStatus: appliedFilters.moderationStatus || undefined,
      sourceType: appliedFilters.sourceType || undefined,
      sort: 'startDate,desc',
    })
      .then(response => {
        if (!active) return
        const recordsPage = response.data?.data || {}
        const recordsData = Array.isArray(recordsPage.content) ? recordsPage.content : []
        setRecordsList(recordsData.map(item => ({
          id: item.id,
          title: item.title,
          provider: item.provider,
          activityTypeName: item.activityTypeName,
          professionalFieldName: item.professionalFieldName,
          hours: item.declaredHours || 0,
          startDate: item.startDate,
          endDate: item.endDate,
          validUntil: item.validUntil,
          expired: Boolean(item.expired),
          workflowStatus: item.workflowStatus,
          sourceType: item.sourceType,
          evidenceCount: Number(item.evidenceCount) || 0,
          passedEvidenceCount: Number(item.passedEvidenceCount) || 0,
          failedEvidenceCount: Number(item.failedEvidenceCount) || 0,
          evidenceUrl: item.evidenceCount > 0 ? `/training/records/${item.id}#evidence` : null,
        })))
        setTotalElements(recordsPage.totalElements || 0)
        setTotalPages(recordsPage.totalPages || 0)
      })
      .catch(() => {
        if (active) {
          setRecordsList([])
          setTotalElements(0)
          setTotalPages(0)
          setRecordsError('Không thể tải lịch sử khai báo giờ đào tạo.')
        }
      })
      .finally(() => {
        if (active) setRecordsLoading(false)
      })

    return () => { active = false }
  }, [appliedFilters, employeeId, page])

  const updateFilter = (key, value) => {
    setFilterDraft(current => ({ ...current, [key]: value }))
    if (key === 'dateFrom' || key === 'dateTo') setFilterDateError('')
  }

  const handleApplyFilters = () => {
    const validationError = validateHistoricalDateRange(filterDraft.dateFrom, filterDraft.dateTo, { maxDate: TODAY })
    if (validationError) {
      setFilterDateError(validationError)
      return
    }
    setPage(0)
    setAppliedFilters({ ...filterDraft })
    setFilterDateError('')
    setIsFilterOpen(false)
  }

  const handleClearFilters = () => {
    setPage(0)
    setFilterDraft({ ...DEFAULT_RECORD_FILTERS })
    setAppliedFilters({ ...DEFAULT_RECORD_FILTERS })
    setFilterDateError('')
  }

  const updateStatusFilter = (key, value) => {
    setStatusFilters(current => ({ ...current, [key]: value }))
  }

  const activeFilterCount = countActiveRecordFilters(appliedFilters)
  const hasEnoughHours = employeeInfo.requiredHours > 0
    && employeeInfo.submittedHours >= employeeInfo.requiredHours
  const isCompliant = employeeInfo.complianceStatus === 'COMPLIANT' || hasEnoughHours
  const progressPercentage = Math.max(Number(employeeInfo.progressPercentage) || 0, 0)
  const progressWidth = Math.min(progressPercentage, 100)

  const breadcrumbs = [
    { label: 'Quản lý chất lượng' },
    { label: 'Giờ đào tạo nhân viên', link: '/training/employees' },
    { label: 'Chi tiết đào tạo nhân viên' }
  ]

  return (
    <AppShell back={{ to: '/training/employees', label: 'Quay lại' }} breadcrumbs={breadcrumbs}>
            <div className="ted-page">

              {/* Title Card */}
              <div className="ted-title-card">
                <h1 className="ted-title">Chi tiết đào tạo nhân viên</h1>
                <p className="ted-subtitle">
                  Lịch sử khai báo và tiến độ giờ đào tạo
                </p>
              </div>

              {/* Detail Card Container */}
              <div className="ted-detail-card">
                {loading ? (
                  <LoadingState label="Đang tải dữ liệu..." />
                ) : error ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
                    {error}
                  </div>
                ) : (
                  <>
                    {/* Profile Banner */}
                    <div className="ted-profile-banner">
                      <div className="ted-profile-left">
                        <div className="ted-profile-avatar" style={{ background: '#3b82f6', color: '#fff', fontSize: 20, fontWeight: 700, display: 'grid', placeItems: 'center' }}>
                          {(employeeInfo.employeeName || 'NV')[0].toUpperCase()}
                        </div>
                        <div>
                          <h2 className="ted-profile-name">{employeeInfo.employeeName} ({employeeInfo.employeeCode})</h2>
                          <p className="ted-profile-requirement">
                            {employeeInfo.requirementName || 'Chưa cấu hình yêu cầu đào tạo'}
                          </p>
                          <p className="ted-profile-workplace">
                            <span>{employeeInfo.departmentName || 'Chưa cập nhật khoa/phòng'}</span>
                            <span aria-hidden="true">•</span>
                            <span>{employeeInfo.jobPositionName || 'Chưa cập nhật chức danh'}</span>
                          </p>
                        </div>
                      </div>
                      <div className={`ted-profile-badge ${
                        isCompliant
                          ? 'ted-profile-badge--compliant'
                          : ''
                      }`}>
                        {`${employeeInfo.submittedHours}/${employeeInfo.requiredHours}h - ${isCompliant ? 'Đạt' : 'Chưa đạt'}`}
                      </div>
                    </div>

                    <section className="ted-status-scope" aria-label="Bộ lọc tổng hợp giờ đào tạo">
                      <div className="ted-status-scope__heading">
                        <div>
                          <h3>Phạm vi thống kê</h3>
                          <p>{statusRefreshing ? 'Đang cập nhật số liệu...' : 'Lọc tiến độ và số giờ tổng hợp của nhân viên.'}</p>
                        </div>
                        {(statusFilters.professionalFieldId || statusFilters.asOf !== TODAY) && (
                          <button
                            type="button"
                            onClick={() => setStatusFilters({ professionalFieldId: '', asOf: TODAY })}
                          >
                            Đặt lại
                          </button>
                        )}
                      </div>
                      <div className="ted-status-scope__fields">
                        <FilterSelectField
                          ariaLabel="Lọc tổng hợp theo lĩnh vực chuyên môn"
                          label="Lĩnh vực chuyên môn"
                          disabled={filterOptionsLoading}
                          onChange={value => updateStatusFilter('professionalFieldId', value)}
                          value={statusFilters.professionalFieldId}
                          searchable
                          options={[
                            { value: '', label: 'Tất cả lĩnh vực' },
                            ...filterOptions.professionalFields.map(option => ({
                              value: option.id,
                              label: option.name || option.label,
                            })),
                          ]}
                        />
                        <label>
                          <span>Tính đến ngày</span>
                          <KeyboardDatePicker
                            aria-label="Tính tổng hợp đến ngày"
                            onChange={val => updateStatusFilter('asOf', val)}
                            value={statusFilters.asOf}
                          />
                        </label>
                      </div>
                      {filterOptionsError && <p className="ted-status-scope__error" role="alert">{filterOptionsError}</p>}
                    </section>

                    {/* Training Summary */}
                    <div>
                      <h3 className="ted-section-title">TỔNG HỢP GIỜ ĐÀO TẠO</h3>
                      <div className="ted-summary-grid">

                        {/* Card: Submitted Hours */}
                        <div className={`ted-summary-card ${isCompliant ? 'ted-summary-card--compliant' : 'ted-summary-card--non-compliant'}`}>
                          <div className={`ted-card-icon ${isCompliant ? 'ted-card-icon--compliant' : 'ted-card-icon--non-compliant'}`}>
                            <ClockCircleOutlined />
                          </div>
                          <div className="ted-card-info">
                            <span className="ted-card-label">Số giờ đã nộp</span>
                            <span className={`ted-card-value ${isCompliant ? 'ted-card-value--compliant' : 'ted-card-value--non-compliant'}`}>
                              {employeeInfo.submittedHours}h
                            </span>
                          </div>
                        </div>

                        <div className="ted-summary-card ted-summary-card--neutral">
                          <div className="ted-card-icon ted-card-icon--neutral">
                            <CheckCircleOutlined />
                          </div>
                          <div className="ted-card-info">
                            <span className="ted-card-label">Số giờ yêu cầu</span>
                            <span className="ted-card-value ted-card-value--neutral">
                              {employeeInfo.requiredHours}h
                            </span>
                          </div>
                        </div>

                        <div className={`ted-summary-card ${Number(employeeInfo.remainingHours) <= 0 ? 'ted-summary-card--compliant' : 'ted-summary-card--pending'}`}>
                          <div className={`ted-card-icon ${Number(employeeInfo.remainingHours) <= 0 ? 'ted-card-icon--compliant' : 'ted-card-icon--pending'}`}>
                            <HourglassOutlined />
                          </div>
                          <div className="ted-card-info">
                            <span className="ted-card-label">Số giờ còn thiếu</span>
                            <span className={`ted-card-value ${Number(employeeInfo.remainingHours) <= 0 ? 'ted-card-value--compliant' : 'ted-card-value--pending'}`}>
                              {employeeInfo.remainingHours}h
                            </span>
                          </div>
                        </div>

                        <div className="ted-summary-card ted-summary-card--progress">
                          <div className="ted-card-icon ted-card-icon--progress">
                            <CalendarOutlined />
                          </div>
                          <div className="ted-card-info ted-card-info--progress">
                            <span className="ted-card-label">Tiến độ hoàn thành</span>
                            <span className="ted-card-value ted-card-value--progress">{progressPercentage}%</span>
                            <div className="ted-progress" aria-label={`Tiến độ ${progressPercentage}%`}>
                              <span style={{ width: `${progressWidth}%` }} />
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                    <section className="ted-requirement-section">
                      <div className="ted-requirement-card">
                        <h3 className="ted-section-title">THÔNG TIN YÊU CẦU</h3>
                        <dl className="ted-requirement-list">
                          <div>
                            <dt>Yêu cầu áp dụng</dt>
                            <dd>{employeeInfo.requirementName || 'Chưa cấu hình'}</dd>
                          </div>
                          <div>
                            <dt>Chu kỳ</dt>
                            <dd>{employeeInfo.cycleYears ? `${employeeInfo.cycleYears} năm` : '---'}</dd>
                          </div>
                          <div>
                            <dt>Khoảng đánh giá</dt>
                            <dd>{formatDateRange(employeeInfo.windowStart, employeeInfo.windowEnd)}</dd>
                          </div>
                          <div>
                            <dt>Cảnh báo</dt>
                            <dd className={employeeInfo.warningMessage ? 'is-warning' : ''}>
                              {employeeInfo.warningMessage || 'Không có cảnh báo'}
                            </dd>
                          </div>
                          <div>
                            <dt>Đào tạo gần nhất</dt>
                            <dd>{formatDate(employeeInfo.lastTrainingDate)}</dd>
                          </div>
                        </dl>
                      </div>
                      <div className="ted-breakdown-card">
                        <h3 className="ted-section-title">GIỜ THEO NĂM</h3>
                        <BreakdownList
                          emptyText="Chưa có dữ liệu theo năm."
                          labelKey="year"
                          rows={employeeInfo.yearlyHours}
                        />
                      </div>
                      <div className="ted-breakdown-card">
                        <h3 className="ted-section-title">GIỜ THEO HÌNH THỨC</h3>
                        <BreakdownList
                          emptyText="Chưa có dữ liệu theo hình thức."
                          labelKey="activityTypeName"
                          rows={employeeInfo.activityTypeHours}
                        />
                      </div>
                    </section>

                    {/* Training Records */}
                    <div>
                      <div className="ted-history-heading">
                        <h3 className="ted-section-title">LỊCH SỬ KHAI BÁO GIỜ ĐÀO TẠO</h3>
                        <span>{totalElements} hồ sơ</span>
                      </div>

                      <div className="ted-filter-toolbar">
                        <div className="ted-filter-search">
                          <SearchOutlined aria-hidden="true" />
                          <input
                            value={filterDraft.keyword}
                            onChange={event => updateFilter('keyword', event.target.value)}
                            onKeyDown={event => {
                              if (event.key === 'Enter') handleApplyFilters()
                            }}
                            placeholder="Tìm theo khóa học / hội thảo..."
                            aria-label="Tìm theo khóa học hoặc hội thảo"
                          />
                        </div>
                        <button
                          type="button"
                          className={`ted-filter-trigger${isFilterOpen ? ' is-open' : ''}`}
                          onClick={() => setIsFilterOpen(current => !current)}
                          aria-expanded={isFilterOpen}
                          aria-controls="employee-training-filter-panel"
                        >
                          <FilterOutlined aria-hidden="true" /> Bộ lọc
                          {activeFilterCount > 0 && <span className="ted-filter-count">{activeFilterCount}</span>}
                        </button>
                      </div>

                      {isFilterOpen && (
                        <div className="ted-filter-panel" id="employee-training-filter-panel">
                          {filterOptionsLoading && (
                            <div className="ted-filter-state" role="status">Đang tải danh sách lĩnh vực và hình thức...</div>
                          )}
                          {filterOptionsError && (
                            <div className="ted-filter-state ted-filter-state--error" role="alert">{filterOptionsError} Các bộ lọc còn lại vẫn có thể sử dụng.</div>
                          )}
                          <div className="ted-filter-grid">
                              <FilterSelectField
                                ariaLabel="Lọc theo trạng thái hồ sơ"
                                label="Trạng thái hồ sơ"
                                value={filterDraft.workflowStatus}
                                onChange={value => updateFilter('workflowStatus', value)}
                                options={[
                                  { value: '', label: 'Tất cả trạng thái' },
                                  { value: 'SUBMITTED', label: 'Đã nộp' },
                                  { value: 'DRAFT', label: 'Bản nháp' },
                                  { value: 'CANCELLED', label: 'Đã hủy' },
                                ]}
                              />
                              <label>
                                <span>Từ ngày</span>
                                <KeyboardDatePicker allowInvalidValue value={filterDraft.dateFrom} max={filterDraft.dateTo || TODAY} onChange={val => updateFilter('dateFrom', val)} aria-label="Lọc từ ngày" />
                              </label>
                              <label>
                                <span>Đến ngày</span>
                                <KeyboardDatePicker allowInvalidValue value={filterDraft.dateTo} min={filterDraft.dateFrom || undefined} max={TODAY} onChange={val => updateFilter('dateTo', val)} aria-label="Lọc đến ngày" />
                              </label>
                              <FilterSelectField
                                ariaLabel="Lọc theo lĩnh vực chuyên môn"
                                label="Lĩnh vực chuyên môn"
                                disabled={filterOptionsLoading || filterOptions.professionalFields.length === 0}
                                value={filterDraft.professionalFieldId}
                                onChange={value => updateFilter('professionalFieldId', value)}
                                searchable
                                options={[
                                  { value: '', label: 'Tất cả lĩnh vực' },
                                  ...filterOptions.professionalFields.map(option => ({ value: option.id, label: option.name || option.label })),
                                ]}
                              />
                              <FilterSelectField
                                ariaLabel="Lọc theo hình thức đào tạo"
                                label="Hình thức đào tạo"
                                disabled={filterOptionsLoading || filterOptions.activityTypes.length === 0}
                                value={filterDraft.activityTypeId}
                                onChange={value => updateFilter('activityTypeId', value)}
                                searchable
                                options={[
                                  { value: '', label: 'Tất cả hình thức' },
                                  ...filterOptions.activityTypes.map(option => ({ value: option.id, label: option.name || option.label })),
                                ]}
                              />
                              <FilterSelectField
                                ariaLabel="Lọc theo tình trạng minh chứng"
                                label="Minh chứng"
                                value={filterDraft.hasEvidence}
                                onChange={value => updateFilter('hasEvidence', value)}
                                options={[
                                  { value: '', label: 'Tất cả hồ sơ' },
                                  { value: 'true', label: 'Có minh chứng' },
                                  { value: 'false', label: 'Chưa có minh chứng' },
                                ]}
                              />
                              <FilterSelectField
                                ariaLabel="Lọc theo kết quả minh chứng"
                                label="Kết quả minh chứng"
                                value={filterDraft.moderationStatus}
                                onChange={value => updateFilter('moderationStatus', value)}
                                options={[
                                  { value: '', label: 'Tất cả kết quả' },
                                  { value: 'PENDING', label: 'Chờ kiểm tra' },
                                  { value: 'PASSED', label: 'Đạt' },
                                  { value: 'FAILED', label: 'Không đạt' },
                                  { value: 'ERROR', label: 'Có lỗi' },
                                  { value: 'NOT_REQUESTED', label: 'Chưa yêu cầu kiểm tra' },
                                ]}
                              />
                              <FilterSelectField
                                ariaLabel="Lọc theo nguồn dữ liệu"
                                label="Nguồn dữ liệu"
                                value={filterDraft.sourceType}
                                onChange={value => updateFilter('sourceType', value)}
                                options={[
                                  { value: '', label: 'Tất cả nguồn' },
                                  { value: 'MANUAL', label: 'Nhân viên khai báo' },
                                  { value: 'LEGACY_IMPORT', label: 'Dữ liệu cũ nhập khẩu' },
                                  { value: 'ADMIN_IMPORT', label: 'Admin nhập khẩu' },
                                ]}
                              />
                          </div>
                          {filterDateError && <p className="ted-filter-error" role="alert">{filterDateError}</p>}
                          <FilterActionButtons className="ted-filter-actions" onReset={handleClearFilters} onApply={handleApplyFilters} />
                        </div>
                      )}

                      <div className="ted-table-wrap">
                        <table className="ted-table admin-table-uppercase">
                          <thead>
                            <tr>
                              <th>Khóa học / Đơn vị</th>
                              <th>Phân loại</th>
                              <th>Thời gian</th>
                              <th>Số giờ</th>
                              <th>Minh chứng</th>
                              <th>Trạng thái</th>
                              <th>Hành động</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recordsLoading ? (
                              <tr>
                                <td colSpan={7} className="ch-empty">Đang tải lịch sử đào tạo...</td>
                              </tr>
                            ) : recordsError ? (
                              <tr>
                                <td colSpan={7} className="ch-empty ted-table-error">{recordsError}</td>
                              </tr>
                            ) : recordsList.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="ch-empty">
                                  Không tìm thấy hồ sơ phù hợp với bộ lọc.
                                </td>
                              </tr>
                            ) : (
                              recordsList.map((item, idx) => (
                                <tr key={item.id || idx}>
                                  <td>
                                    <strong className="ted-record-title">{item.title}</strong>
                                    <span className="ted-record-meta">{item.provider || 'Chưa cập nhật đơn vị tổ chức'}</span>
                                    <span className="ted-source-tag">{getSourceLabel(item.sourceType)}</span>
                                  </td>
                                  <td>
                                    <span className="ted-record-primary">{item.activityTypeName || 'Chưa phân loại'}</span>
                                    <span className="ted-record-meta">{item.professionalFieldName || 'Chưa xác định lĩnh vực'}</span>
                                  </td>
                                  <td>
                                    <span className="ted-training-date">
                                      {formatDateRange(item.startDate, item.endDate)}
                                    </span>
                                    {item.expired && (
                                      <span
                                        className="ted-expired-tag"
                                        title={item.validUntil
                                          ? `Hết hạn từ ${new Date(item.validUntil).toLocaleDateString('vi-VN')}`
                                          : 'Hồ sơ đã hết hạn'}
                                      >
                                        Hết hạn
                                      </span>
                                    )}
                                  </td>
                                  <td><strong>{item.hours}h</strong></td>
                                  <td>
                                    <span className="ted-evidence-count">{item.evidenceCount} tệp</span>
                                    {item.failedEvidenceCount > 0 ? (
                                      <span className="ted-evidence-result ted-evidence-result--failed">
                                        {item.failedEvidenceCount} không đạt
                                      </span>
                                    ) : item.passedEvidenceCount > 0 ? (
                                      <span className="ted-evidence-result ted-evidence-result--passed">
                                        {item.passedEvidenceCount} đạt
                                      </span>
                                    ) : (
                                      <span className="ted-record-meta">Chưa có kết quả</span>
                                    )}
                                  </td>
                                  <td>
                                    <span className={`ted-status-badge ted-status-badge--${getStatusMeta(item.workflowStatus).tone}`}>
                                      <span className={`ted-status-dot ted-status-dot--${getStatusMeta(item.workflowStatus).tone}`} />
                                      {getStatusMeta(item.workflowStatus).label}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="admin-table-actions">
                                      <Link
                                        aria-label={`Xem chi tiết hồ sơ ${item.title}`}
                                        className="ted-evidence-link ted-evidence-link--blue admin-table-action admin-table-action--icon admin-table-action--primary"
                                        title="Xem chi tiết hồ sơ"
                                        to={`/training/records/${item.id}`}
                                      >
                                        <EyeOutlined />
                                      </Link>
                                      {item.evidenceUrl ? (
                                        <Link
                                          aria-label={`Xem minh chứng của ${item.title}`}
                                          className="ted-evidence-link ted-evidence-link--green admin-table-action admin-table-action--icon admin-table-action--success"
                                          title="Xem minh chứng"
                                          to={item.evidenceUrl}
                                        >
                                          <FileTextOutlined />
                                        </Link>
                                      ) : (
                                        <span
                                          aria-label="Không có minh chứng"
                                          className="admin-table-action admin-table-action--icon"
                                          role="img"
                                          style={{ color: '#cbd5e1', cursor: 'not-allowed', opacity: 0.6 }}
                                          title="Không có minh chứng"
                                        >
                                          <FileTextOutlined />
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                        {totalElements > 0 && (
                          <div className="ted-pagination">
                            <span>Hiển thị {recordsList.length} / {totalElements} hồ sơ</span>
                            <div className="ted-pagination__controls">
                              <button
                                type="button"
                                onClick={() => setPage(current => Math.max(0, current - 1))}
                                disabled={page === 0}
                                aria-label="Trang trước"
                              >
                                <LeftOutlined />
                              </button>
                              <span>{page + 1} / {Math.max(totalPages, 1)}</span>
                              <button
                                type="button"
                                onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))}
                                disabled={page >= totalPages - 1}
                                aria-label="Trang sau"
                              >
                                <RightOutlined />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

            </div>
    </AppShell>
  )
}

function BreakdownList({ rows, labelKey, emptyText }) {
  if (!rows.length) return <p className="ted-breakdown-empty">{emptyText}</p>

  return (
    <ul className="ted-breakdown-list">
      {rows.map((row, index) => (
        <li key={`${row[labelKey] ?? 'item'}-${index}`}>
          <span>{row[labelKey] ?? 'Chưa xác định'}</span>
          <strong>{row.submittedHours ?? 0}h</strong>
        </li>
      ))}
    </ul>
  )
}

function formatDate(value) {
  if (!value) return '---'
  return new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`))
}

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return '---'
  if (!endDate || startDate === endDate) return formatDate(startDate || endDate)
  return `${formatDate(startDate)} – ${formatDate(endDate)}`
}

function getSourceLabel(sourceType) {
  const labels = {
    MANUAL: 'Nhân viên khai báo',
    LEGACY_IMPORT: 'Dữ liệu cũ',
    ADMIN_IMPORT: 'Admin nhập khẩu',
  }
  return labels[sourceType] || 'Chưa xác định nguồn'
}

function getStatusMeta(status) {
  const statuses = {
    SUBMITTED: { label: 'Đã nộp', tone: 'approved' },
    DRAFT: { label: 'Bản nháp', tone: 'pending' },
    CANCELLED: { label: 'Đã hủy', tone: 'cancelled' },
  }
  return statuses[status] || { label: status || 'Chưa xác định', tone: 'pending' }
}

export default TrainingEmployeeStatusDetailPage
