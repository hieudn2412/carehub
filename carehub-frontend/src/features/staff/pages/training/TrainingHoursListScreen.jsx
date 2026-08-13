import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  SearchOutlined,
  FilterOutlined,
  PlusOutlined,
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { staffApi } from '../../api/staffApi.js'
import ConfirmModal from '../../../../features/admin/components/ConfirmModal.jsx'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import { getApiErrorMessage } from '../../../../features/auth/utils/apiError.js'
import TrainingRecordTable from './components/TrainingRecordTable.jsx'
import TrainingSearchFilters from './components/TrainingSearchFilters.jsx'
import {
  countActiveFilterGroups,
  createEmptyTrainingFilters,
  isDateRangeValid,
  parseTrainingQuery,
  serializeTrainingQuery,
  toTrainingListApiParams,
} from './utils/trainingRecordQuery.js'
import '../../styles/TrainingHours.css'

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'SUBMITTED', label: 'Đã nộp' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'CANCELLED', label: 'Đã hủy' },
]

function TrainingHoursListScreen() {
  const navigate = useNavigate()
  const [urlSearchParams, setUrlSearchParams] = useSearchParams()
  const urlQuery = urlSearchParams.toString()
  const queryFilters = useMemo(() => parseTrainingQuery(urlQuery), [urlQuery])
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const filterControlRef = useRef(null)
  const loadingMoreRef = useRef(false)
  const listBaseKeyRef = useRef('')
  const pageRecordIdsRef = useRef(new Map())
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [totalElements, setTotalElements] = useState(0)
  const [totalSubmittedHours, setTotalSubmittedHours] = useState(0)
  const [requiredHours, setRequiredHours] = useState(120)
  const [trainingWindowYears, setTrainingWindowYears] = useState(5)
  const [cmeConfigured, setCmeConfigured] = useState(false)
  const [myEmployeeId, setMyEmployeeId] = useState(null)
  const [profileResolved, setProfileResolved] = useState(false)
  const [profileReloadKey, setProfileReloadKey] = useState(0)
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  )
  const [filterDraft, setFilterDraft] = useState(createEmptyTrainingFilters)
  const [filterOptions, setFilterOptions] = useState({ activityTypes: [], professionalFields: [] })
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false)
  const [filterOptionsError, setFilterOptionsError] = useState('')
  const [filterDateError, setFilterDateError] = useState('')
  const size = 10

  const page = queryFilters.page - 1

  useEffect(() => {
    setSearch(queryFilters.q)
    setFilterDraft(queryFilters)
  }, [urlQuery, queryFilters])

  useEffect(() => {
    setProfileResolved(false)
    staffApi.getProfile()
      .then(res => {
        const profile = res.data?.data
        if (profile?.id) {
          setMyEmployeeId(profile.id)
        } else {
          setListError('Không thể xác định hồ sơ nhân viên. Vui lòng thử lại.')
        }
      })
      .catch(err => {
        console.error("Error fetching profile", err)
        setListError('Không thể xác định hồ sơ nhân viên. Vui lòng thử lại.')
      })
      .finally(() => setProfileResolved(true))

    trainingApi.getMyTrainingStatus()
      .then(res => {
        const statusData = res.data?.data
        if (statusData) {
          const configured = statusData.status !== 'NOT_CONFIGURED'
          setCmeConfigured(configured)
          setTotalSubmittedHours(statusData.submittedHours || 0)
          setRequiredHours(configured ? (statusData.requiredHours ?? 0) : 0)
          setTrainingWindowYears(Number(statusData.cycleYears) || 5)
        }
      })
      .catch(err => console.error("Error fetching training status", err))
  }, [profileReloadKey])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)')
    const syncViewport = event => {
      setIsMobileViewport(event.matches)
    }

    setIsMobileViewport(mediaQuery.matches)
    mediaQuery.addEventListener('change', syncViewport)
    return () => mediaQuery.removeEventListener('change', syncViewport)
  }, [])

  useEffect(() => {
    if (!isFilterOpen) return undefined

    const handlePointerDown = (event) => {
      if (!filterControlRef.current?.contains(event.target)) {
        setIsFilterOpen(false)
        setFilterDateError('')
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsFilterOpen(false)
        setFilterDateError('')
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFilterOpen])

  useEffect(() => {
    if (!profileResolved || myEmployeeId == null) return undefined

    const timer = setTimeout(() => {
      setLoading(true)
      setListError('')
      const baseQueryKey = JSON.stringify({
        q: queryFilters.q,
        status: queryFilters.status,
        dateFrom: queryFilters.dateFrom,
        dateTo: queryFilters.dateTo,
        professionalFieldId: queryFilters.professionalFieldId,
        activityTypeId: queryFilters.activityTypeId,
      })
      const append = isMobileViewport
        && queryFilters.page > 1
        && listBaseKeyRef.current === baseQueryKey
      if (!append) listBaseKeyRef.current = baseQueryKey
      const params = toTrainingListApiParams(queryFilters, myEmployeeId, size)
      trainingApi.listRecords(params)
        .then(res => {
          const data = res.data?.data || {}
          const nextRecords = data.content || []
          pageRecordIdsRef.current.set(queryFilters.page, nextRecords.map(record => record.id))
          setRecords(currentRecords => {
            if (!append) return nextRecords

            const currentIds = new Set(currentRecords.map(record => record.id))
            return [
              ...currentRecords,
              ...nextRecords.filter(record => !currentIds.has(record.id)),
            ]
          })
          setTotalElements(data.totalElements || 0)
        })
        .catch(err => {
          console.error("Error fetching training records", err)
          setListError('Không thể tải danh sách giờ đào tạo. Vui lòng thử lại.')
        })
        .finally(() => {
          loadingMoreRef.current = false
          setLoading(false)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [queryFilters, myEmployeeId, profileResolved, reloadKey, isMobileViewport])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await trainingApi.deleteRecord(deleteTarget.id, deleteTarget.version)
      showToast("Đã xóa hồ sơ đào tạo.", "success")
      setDeleteTarget(null)
      const currentPageRecordIds = pageRecordIdsRef.current.get(queryFilters.page) || []
      if (currentPageRecordIds.length === 1 && queryFilters.page > 1) {
        setUrlSearchParams(serializeTrainingQuery({ ...queryFilters, page: queryFilters.page - 1 }))
      }
      setReloadKey(value => value + 1)
    } catch (error) {
      showToast(getApiErrorMessage(error, "Không thể xóa hồ sơ đào tạo."), "error")
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.ceil(totalElements / size) || 1
  const isCompliant = totalSubmittedHours >= requiredHours
  const progressPct = requiredHours > 0 ? Math.min(Math.round((totalSubmittedHours / requiredHours) * 100), 100) : 0

  const handleListRetry = () => {
    setReloadKey(value => value + 1)
    if (myEmployeeId == null) {
      setProfileReloadKey(value => value + 1)
    }
  }

  const handleMobileRecordsScroll = (event) => {
    if (!isMobileViewport || loading || loadingMoreRef.current || page >= totalPages - 1) return

    const scrollContainer = event.currentTarget
    const remainingDistance = scrollContainer.scrollWidth
      - scrollContainer.scrollLeft
      - scrollContainer.clientWidth

    if (remainingDistance <= 48) {
      loadingMoreRef.current = true
      setUrlSearchParams(serializeTrainingQuery({ ...queryFilters, page: Math.min(queryFilters.page + 1, totalPages) }))
    }
  }

  const loadFilterOptions = useCallback(async () => {
    setFilterOptionsLoading(true)
    setFilterOptionsError('')
    try {
      const response = await trainingApi.getRecordOptions()
      const data = response.data?.data || {}
      setFilterOptions({
        activityTypes: Array.isArray(data.activityTypes) ? data.activityTypes : [],
        professionalFields: Array.isArray(data.professionalFields) ? data.professionalFields : [],
      })
    } catch {
      setFilterOptionsError('Không thể tải danh sách bộ lọc.')
    } finally {
      setFilterOptionsLoading(false)
    }
  }, [])

  const handleFilterToggle = () => {
    const nextOpen = !isFilterOpen
    setIsFilterOpen(nextOpen)
    if (nextOpen && !filterOptionsLoading && !filterOptionsError && !filterOptions.activityTypes.length && !filterOptions.professionalFields.length) {
      loadFilterOptions()
    }
    if (!nextOpen) setFilterDateError('')
  }

  const handleApplyFilters = () => {
    if (!isDateRangeValid(filterDraft.dateFrom, filterDraft.dateTo)) {
      setFilterDateError('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
      return
    }
    setUrlSearchParams(serializeTrainingQuery({ ...filterDraft, page: 1 }))
    setFilterDateError('')
    setIsFilterOpen(false)
  }

  const handleClearFilters = () => {
    setFilterDraft(createEmptyTrainingFilters())
    setFilterDateError('')
  }

  const handleMobileApplyFilters = (close) => {
    if (!isDateRangeValid(filterDraft.dateFrom, filterDraft.dateTo)) {
      setFilterDateError('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
      return
    }

    setUrlSearchParams(serializeTrainingQuery({ ...filterDraft, q: search.trim(), page: 1 }))
    setFilterDateError('')
    close()
  }

  const renderMobileSearch = ({ close }) => (
    <TrainingSearchFilters
      searchValue={search}
      onSearchChange={setSearch}
      onSearchKeyDown={event => {
        if (event.key === 'Enter') handleMobileApplyFilters(close)
      }}
      filters={filterDraft}
      onFilterChange={setFilterDraft}
      filterOptions={filterOptions}
      filterOptionsLoading={filterOptionsLoading}
      filterOptionsError={filterOptionsError}
      onRetryOptions={loadFilterOptions}
      dateError={filterDateError}
      onClear={handleClearFilters}
      onApply={() => handleMobileApplyFilters(close)}
    />
  )

  const mobileSearchActiveCount = (search.trim() ? 1 : 0) + countActiveFilterGroups(filterDraft)

  const handleSearchKeyDown = event => {
    if (event.key !== 'Enter') return
    setUrlSearchParams(serializeTrainingQuery({ ...queryFilters, q: search.trim(), page: 1 }))
  }

  return (
    <AppShell
      className="training-hours-list-shell"
      mobileSearch={{
        title: 'Tìm kiếm giờ đào tạo',
        ariaLabel: 'Mở tìm kiếm và bộ lọc giờ đào tạo',
        activeCount: mobileSearchActiveCount,
        onOpen: () => {
          if (!filterOptionsLoading && !filterOptionsError && !filterOptions.activityTypes.length && !filterOptions.professionalFields.length) {
            loadFilterOptions()
          }
        },
        renderContent: renderMobileSearch,
      }}
      breadcrumbs={[
        { label: 'Giờ đào tạo liên tục', link: '/staff/training' },
        { label: 'Danh sách tất cả' }
      ]}
    >
      <div className="training-page training-page--list">

            {/* Compliance Summary Banner */}
            <div className={`th-compliance-banner ${
              !cmeConfigured ? 'th-compliance-banner--neutral'
                : isCompliant ? 'th-compliance-banner--success'
                : 'th-compliance-banner--warning'
            }`}>
              <div className="th-compliance-banner__left">
                <h1 className="th-page-title">Giờ đào tạo liên tục</h1>
                <p className="th-page-subtitle">
                  Theo dõi mục tiêu {requiredHours} giờ trong {trainingWindowYears} năm liên tục
                </p>
              </div>
              <div className="th-compliance-banner__right">
                {cmeConfigured ? (
                  <>
                    <div className="th-compliance-ring">
                      <svg viewBox="0 0 36 36" className="th-ring-svg">
                        <path
                          className="th-ring-bg"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="th-ring-fill"
                          strokeDasharray={`${progressPct}, 100`}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className="th-ring-value">{progressPct}%</span>
                    </div>
                    <div className="th-compliance-stats">
                      <span className="th-compliance-total">
                        {totalSubmittedHours} <small>/ {requiredHours}h</small>
                      </span>
                      <span className="th-compliance-label">
                        {isCompliant ? 'Đã hoàn thành mục tiêu' : `Còn thiếu ${requiredHours - totalSubmittedHours} giờ`}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="th-compliance-stats">
                    <span className="th-compliance-total">Không áp dụng</span>
                    <span className="th-compliance-label">Phòng ban không thuộc diện giờ đào tạo</span>
                  </div>
                )}
              </div>
            </div>

            {/* Filters + Add */}
            <div className="th-filter-bar" ref={filterControlRef}>
              <div className={`th-search-box${isSearchExpanded || search ? ' th-search-box--expanded' : ''}`}>
                <SearchOutlined className="th-search-icon" />
                <input
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setIsSearchExpanded(true)
                  }}
                  onFocus={() => setIsSearchExpanded(true)}
                  onBlur={() => {
                    if (!search) setIsSearchExpanded(false)
                  }}
                  placeholder="Tìm theo nội dung đào tạo..."
                  className="th-search-input"
                  aria-label="Tìm theo tên khóa đào tạo"
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
              <div className={`th-filter-control${countActiveFilterGroups(filterDraft) ? ' th-filter-control--active' : ''}`} title="Lọc hồ sơ">
                <button
                  type="button"
                  className="th-filter-control__trigger"
                  aria-label="Mở bộ lọc"
                  aria-haspopup="menu"
                  aria-expanded={isFilterOpen}
                  onClick={handleFilterToggle}
                >
                  <FilterOutlined aria-hidden="true" />
                  <span className="th-filter-trigger-label">Bộ lọc</span>
                  {countActiveFilterGroups(filterDraft) > 0 && <span className="th-filter-active-count">{countActiveFilterGroups(filterDraft)}</span>}
                </button>
              </div>
              <button
                className="th-btn-primary th-btn-primary--fab"
                onClick={() => navigate('/staff/training/new')}
                aria-label="Cập nhật giờ đào tạo"
              >
                <PlusOutlined />
                <span>Cập nhật giờ đào tạo</span>
              </button>
              {isFilterOpen && (
                <div className="th-desktop-filter-panel th-list-filter-panel" role="dialog" aria-label="Bộ lọc giờ đào tạo">
                  <div className="th-list-filter-panel__header">
                    <strong>Bộ lọc giờ đào tạo</strong>
                    <span>{countActiveFilterGroups(filterDraft)} điều kiện đang chọn</span>
                  </div>
                  {filterOptionsLoading ? (
                    <div className="th-list-filter-panel__state" role="status">Đang tải tùy chọn lọc...</div>
                  ) : filterOptionsError ? (
                    <div className="th-list-filter-panel__state th-list-filter-panel__state--error" role="alert">
                      <span>{filterOptionsError}</span>
                      <button type="button" className="th-retry-btn" onClick={loadFilterOptions}>Thử lại</button>
                    </div>
                  ) : (
                    <div className="th-list-filter-panel__grid">
                      <label>
                        <span>Trạng thái hồ sơ</span>
                        <select value={filterDraft.status} onChange={event => setFilterDraft(current => ({ ...current, status: event.target.value }))} aria-label="Lọc theo trạng thái hồ sơ">
                          {STATUS_FILTER_OPTIONS.map(option => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Từ ngày</span>
                        <input type="date" value={filterDraft.dateFrom} onChange={event => setFilterDraft(current => ({ ...current, dateFrom: event.target.value }))} aria-label="Lọc từ ngày" />
                      </label>
                      <label>
                        <span>Đến ngày</span>
                        <input type="date" value={filterDraft.dateTo} onChange={event => setFilterDraft(current => ({ ...current, dateTo: event.target.value }))} aria-label="Lọc đến ngày" />
                      </label>
                      <label>
                        <span>Lĩnh vực chuyên môn</span>
                        <select value={filterDraft.professionalFieldId} onChange={event => setFilterDraft(current => ({ ...current, professionalFieldId: event.target.value }))} aria-label="Lọc theo lĩnh vực chuyên môn">
                          <option value="">Tất cả lĩnh vực</option>
                          {filterOptions.professionalFields.map(option => <option key={option.id} value={option.id}>{option.name || option.label}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Hình thức đào tạo</span>
                        <select value={filterDraft.activityTypeId} onChange={event => setFilterDraft(current => ({ ...current, activityTypeId: event.target.value }))} aria-label="Lọc theo hình thức đào tạo">
                          <option value="">Tất cả hình thức</option>
                          {filterOptions.activityTypes.map(option => <option key={option.id} value={option.id}>{option.name || option.label}</option>)}
                        </select>
                      </label>
                    </div>
                  )}
                  {filterDateError && <p className="th-list-filter-panel__error" role="alert">{filterDateError}</p>}
                  <div className="th-list-filter-panel__actions">
                    <button type="button" className="th-overview-filter-panel__clear" onClick={handleClearFilters}>Xóa bộ lọc</button>
                    <button type="button" className="th-btn-primary" onClick={handleApplyFilters}>Áp dụng</button>
                  </div>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="th-table-card">
              {(loading || !profileResolved) && records.length === 0 ? (
                <div className="th-table-state">Đang tải danh sách...</div>
              ) : listError && records.length === 0 ? (
                <div className="th-table-state th-table-state--error" role="alert">
                  <p>{listError}</p>
                  <button className="th-retry-btn" onClick={handleListRetry}>
                    <ReloadOutlined /> Thử lại
                  </button>
                </div>
              ) : records.length === 0 ? (
                <div className="th-table-state">
                  <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: '#374151' }}>Chưa có hồ sơ nào</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
                    {search ? 'Không tìm thấy kết quả phù hợp.' : 'Nhấn "Cập nhật giờ đào tạo" để bắt đầu khai báo.'}
                  </p>
                </div>
              ) : (
                <>
                  <TrainingRecordTable
                    records={records}
                    columns={['date', 'title', 'hours', 'submitted', 'actions']}
                    onBodyScroll={handleMobileRecordsScroll}
                    onRowClick={record => navigate(`/staff/training/${record.id}`)}
                    actions={['view', 'edit', 'delete']}
                    onView={record => navigate(`/staff/training/${record.id}`)}
                    onEdit={record => navigate(`/staff/training/${record.id}/edit`)}
                    onDelete={record => setDeleteTarget(record)}
                    deletingId={deletingId}
                  />

                  {loading && records.length > 0 && (
                    <div className="th-infinite-loading" role="status">Đang tải thêm...</div>
                  )}
                  {listError && records.length > 0 && (
                    <button
                      type="button"
                      className="th-infinite-loading th-infinite-loading--error"
                      onClick={handleListRetry}
                    >
                      Tải thêm thất bại · Thử lại
                    </button>
                  )}

                  <div className="th-pagination">
                    <span className="th-pagination-info">
                      Hiển thị {records.length} / {totalElements} kết quả
                    </span>
                    <div className="th-pagination-pages">
                      <button className="th-page-btn" onClick={() => setUrlSearchParams(serializeTrainingQuery({ ...queryFilters, page: Math.max(1, queryFilters.page - 1) }))} disabled={page === 0} aria-label="Trang trước">
                        <LeftOutlined />
                      </button>
                      {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                        const pageNum = totalPages <= 5 ? i : page < 3 ? i : page > totalPages - 3 ? totalPages - 5 + i : page - 2 + i
                        return (
                          <button
                            key={pageNum}
                            className={`th-page-btn ${page === pageNum ? 'th-page-btn--active' : ''}`}
                            onClick={() => setUrlSearchParams(serializeTrainingQuery({ ...queryFilters, page: pageNum + 1 }))}
                            aria-label={`Trang ${pageNum + 1}`}
                            aria-current={page === pageNum ? 'page' : undefined}
                          >
                            {pageNum + 1}
                          </button>
                        )
                      })}
                      <button className="th-page-btn" onClick={() => setUrlSearchParams(serializeTrainingQuery({ ...queryFilters, page: Math.min(totalPages, queryFilters.page + 1) }))} disabled={page >= totalPages - 1} aria-label="Trang sau">
                        <RightOutlined />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
      </div>
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Xóa hồ sơ đào tạo"
        message={`Bạn có chắc chắn muốn xóa hồ sơ “${deleteTarget?.title || ''}” không? Hồ sơ sẽ được lưu trạng thái đã hủy để bảo đảm lịch sử thay đổi.`}
        confirmText="Xóa hồ sơ"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  )
}

export default TrainingHoursListScreen
