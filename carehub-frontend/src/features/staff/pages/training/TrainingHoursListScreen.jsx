import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SearchOutlined,
  FilterOutlined,
  PlusOutlined,
  PaperClipOutlined,
  LeftOutlined,
  RightOutlined,
  EyeOutlined,
  ReloadOutlined,
  SendOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { staffApi } from '../../api/staffApi.js'
import { getRolesFromAccessToken } from '../../../../features/auth/utils/jwt.js'
import { tokenStorage } from '../../../../features/auth/services/tokenStorage.js'
import ConfirmModal from '../../../../features/admin/components/ConfirmModal.jsx'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import { getApiErrorMessage } from '../../../../features/auth/utils/apiError.js'
import '../../styles/TrainingHours.css'

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'SUBMITTED', label: 'Đã nộp' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'CANCELLED', label: 'Đã hủy' },
]

function TrainingHoursListScreen() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = roles.some(r => String(r).toUpperCase().includes('ADMIN'))
  const isManager = roles.some(r => String(r).toUpperCase().includes('MANAGER'))
  const dashboardPath = isAdmin ? '/admin/dashboard' : isManager ? '/manager/dashboard' : '/staff/dashboard'
  const [search, setSearch] = useState('')
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [activeFilterPanel, setActiveFilterPanel] = useState(null)
  const filterControlRef = useRef(null)
  const loadingMoreRef = useRef(false)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [status, setStatus] = useState('')
  const [submittingId, setSubmittingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(0)
  const [totalSubmittedHours, setTotalSubmittedHours] = useState(0)
  const [requiredHours, setRequiredHours] = useState(120)
  const [cmeConfigured, setCmeConfigured] = useState(false)
  const [myEmployeeId, setMyEmployeeId] = useState(null)
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  )
  const size = 10

  useEffect(() => {
    staffApi.getProfile()
      .then(res => {
        const profile = res.data?.data
        if (profile?.id) {
          setMyEmployeeId(profile.id)
        }
      })
      .catch(err => console.error("Error fetching profile", err))

    trainingApi.getMyTrainingStatus()
      .then(res => {
        const statusData = res.data?.data
        if (statusData) {
          const configured = statusData.status !== 'NOT_CONFIGURED'
          setCmeConfigured(configured)
          setTotalSubmittedHours(statusData.submittedHours || 0)
          setRequiredHours(configured ? (statusData.requiredHours ?? 0) : 0)
        }
      })
      .catch(err => console.error("Error fetching training status", err))
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)')
    const syncViewport = event => {
      setIsMobileViewport(event.matches)
      setPage(0)
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
        setActiveFilterPanel(null)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsFilterOpen(false)
        setActiveFilterPanel(null)
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
    const timer = setTimeout(() => {
      setLoading(true)
      setListError('')
      const params = {
        page,
        size,
        titleKeyword: search || undefined,
        workflowStatus: status || undefined,
        ...(myEmployeeId != null && { employeeId: myEmployeeId }),
      }
      trainingApi.listRecords(params)
        .then(res => {
          const data = res.data?.data || {}
          const nextRecords = data.content || []
          setRecords(currentRecords => {
            if (!isMobileViewport || page === 0) return nextRecords

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
          if (!isMobileViewport || page === 0) {
            setRecords([])
            setTotalElements(0)
          }
          setListError('Không thể tải danh sách giờ đào tạo. Vui lòng thử lại.')
        })
        .finally(() => {
          loadingMoreRef.current = false
          setLoading(false)
        })
    }, 300)
    return () => clearTimeout(timer)
  }, [page, search, status, myEmployeeId, reloadKey, isMobileViewport])

  const getStatusLabel = (workflowStatus) => ({
    DRAFT: 'Bản nháp',
    SUBMITTED: 'Đã nộp',
    CANCELLED: 'Đã hủy',
  }[workflowStatus] || workflowStatus || '-')

  const handleDirectSubmit = async (recordId, version) => {
    setSubmittingId(recordId)
    setListError('')
    try {
      await trainingApi.submitRecord(recordId, { version })
      setPage(0)
      setReloadKey((value) => value + 1)
    } catch {
      setListError('Không thể nộp hồ sơ đào tạo. Vui lòng kiểm tra minh chứng và thử lại.')
    } finally {
      setSubmittingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      await trainingApi.deleteRecord(deleteTarget.id, deleteTarget.version)
      showToast("Đã xóa hồ sơ đào tạo.", "success")
      setDeleteTarget(null)
      setReloadKey(value => value + 1)
    } catch (error) {
      showToast(getApiErrorMessage(error, "Không thể xóa hồ sơ đào tạo."), "error")
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  const totalPages = Math.ceil(totalElements / size) || 1
  const selectedStatusLabel = STATUS_FILTER_OPTIONS.find(option => option.value === status)?.label
    || STATUS_FILTER_OPTIONS[0].label

  const isCompliant = totalSubmittedHours >= requiredHours
  const progressPct = requiredHours > 0 ? Math.min(Math.round((totalSubmittedHours / requiredHours) * 100), 100) : 0

  const handleMobileRecordsScroll = (event) => {
    if (!isMobileViewport || loading || loadingMoreRef.current || page >= totalPages - 1) return

    const scrollContainer = event.currentTarget
    const remainingDistance = scrollContainer.scrollWidth
      - scrollContainer.scrollLeft
      - scrollContainer.clientWidth

    if (remainingDistance <= 48) {
      loadingMoreRef.current = true
      setPage(currentPage => Math.min(currentPage + 1, totalPages - 1))
    }
  }

  return (
    <AppShell
      className="training-hours-list-shell"
      breadcrumbs={[
        { label: 'Tổng quan', link: dashboardPath },
        { label: 'Giờ đào tạo liên tục' }
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
                <p className="th-page-subtitle">Theo dõi mục tiêu 120 giờ trong 5 năm liên tục</p>
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
            <div className="th-filter-bar">
              <div className={`th-search-box${isSearchExpanded || search ? ' th-search-box--expanded' : ''}`}>
                <SearchOutlined className="th-search-icon" />
                <input
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setIsSearchExpanded(true)
                    setPage(0)
                  }}
                  onFocus={() => setIsSearchExpanded(true)}
                  onBlur={() => {
                    if (!search) setIsSearchExpanded(false)
                  }}
                  placeholder="Tìm theo nội dung đào tạo..."
                  className="th-search-input"
                  aria-label="Tìm theo tên khóa đào tạo"
                />
              </div>
              <div
                className={`th-filter-control${status ? ' th-filter-control--active' : ''}`}
                title="Lọc theo trạng thái hồ sơ"
                ref={filterControlRef}
              >
                <button
                  type="button"
                  className="th-filter-control__trigger"
                  aria-label="Mở bộ lọc"
                  aria-haspopup="menu"
                  aria-expanded={isFilterOpen}
                  onClick={() => {
                    setIsFilterOpen(open => !open)
                    setActiveFilterPanel(null)
                  }}
                >
                  <FilterOutlined aria-hidden="true" />
                </button>
                <select
                  value={status}
                  onChange={e => { setStatus(e.target.value); setPage(0) }}
                  className="th-filter-select"
                  aria-label="Lọc theo trạng thái hồ sơ"
                >
                  {STATUS_FILTER_OPTIONS.map(option => (
                    <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {isFilterOpen && (
                  <div className="th-filter-menu" role="menu" aria-label="Bộ lọc giờ đào tạo">
                    {activeFilterPanel === 'status' ? (
                      <>
                        <button
                          type="button"
                          className="th-filter-menu__back"
                          onClick={() => setActiveFilterPanel(null)}
                        >
                          <LeftOutlined /> Trạng thái hồ sơ
                        </button>
                        <div className="th-filter-menu__options">
                          {STATUS_FILTER_OPTIONS.map(option => (
                            <button
                              key={option.value || 'all'}
                              type="button"
                              role="menuitemradio"
                              aria-checked={status === option.value}
                              className={status === option.value ? 'is-selected' : ''}
                              onClick={() => {
                                setStatus(option.value)
                                setPage(0)
                                setIsFilterOpen(false)
                                setActiveFilterPanel(null)
                              }}
                            >
                              <span>{option.label}</span>
                              {status === option.value && <CheckOutlined aria-hidden="true" />}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        className="th-filter-menu__group"
                        onClick={() => setActiveFilterPanel('status')}
                      >
                        <span>
                          <strong>Trạng thái hồ sơ</strong>
                          <small>{selectedStatusLabel}</small>
                        </span>
                        <RightOutlined aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                className="th-btn-primary th-btn-primary--fab"
                onClick={() => navigate('/staff/training/new')}
                aria-label="Cập nhật giờ đào tạo"
              >
                <PlusOutlined />
                <span>Cập nhật giờ đào tạo</span>
              </button>
            </div>

            {/* Table */}
            <div className="th-table-card">
              {loading && records.length === 0 ? (
                <div className="th-table-state">Đang tải danh sách...</div>
              ) : listError && records.length === 0 ? (
                <div className="th-table-state th-table-state--error" role="alert">
                  <p>{listError}</p>
                  <button className="th-retry-btn" onClick={() => setReloadKey(value => value + 1)}>
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
                  <table className="th-table admin-table-uppercase">
                    <thead>
                      <tr>
                        <th>Ngày đào tạo liên tục</th>
                        <th>Nội dung đào tạo</th>
                        <th className="th-col-num">Số giờ đào tạo</th>
                        <th className="th-col-submitted">Ngày nộp</th>
                        <th className="th-col-center">Minh chứng</th>
                        <th className="th-col-actions">Hành động</th>
                      </tr>
                    </thead>
                    <tbody onScroll={handleMobileRecordsScroll}>
                      {records.map(r => (
                        <tr key={r.id} onClick={() => navigate(`/staff/training/${r.id}`)} className="th-clickable-row">
                          <td data-label="Ngày bắt đầu">
                            <span className="th-training-date">{formatDate(r.startDate)}</span>
                            {r.expired && (
                              <span className="th-expired-tag" title={`Hết hạn từ ${formatDate(r.validUntil)}`}>
                                Hết hạn
                              </span>
                            )}
                          </td>
                          <td data-label="Khóa đào tạo">
                            <span className="th-record-title">{r.title}</span>
                            {r.professionalFieldName && <span className="th-record-provider">{r.professionalFieldName}</span>}
                          </td>
                          <td className="th-col-num" data-label="Số giờ"><strong>{r.declaredHours}h</strong></td>
                          <td className="th-col-submitted" data-label="Ngày nộp">
                            {r.workflowStatus === 'SUBMITTED' ? (
                              <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                                {formatDate(r.submittedAt)}
                              </span>
                            ) : (
                              <span className={`th-badge th-badge--${
                                r.workflowStatus === 'CANCELLED' ? 'danger' : 'warning'
                              }`}>
                                {getStatusLabel(r.workflowStatus)}
                              </span>
                            )}
                          </td>
                          <td className="th-col-center" data-label="Minh chứng">

                            {r.evidenceCount > 0 ? (
                              <span className="th-evidence-count">
                                <PaperClipOutlined /> {r.evidenceCount}
                              </span>
                            ) : (
                              <span className="th-evidence-none">-</span>
                            )}
                          </td>
                          <td className="th-col-actions" data-label="Hành động">
                            <div className="th-actions admin-table-actions" onClick={e => e.stopPropagation()}>
                              {r.workflowStatus === 'DRAFT' && (
                                <button
                                  className="th-action-btn th-action-btn--submit admin-table-action admin-table-action--icon admin-table-action--success"
                                  onClick={() => handleDirectSubmit(r.id, r.version)}
                                  disabled={submittingId === r.id}
                                  title="Nộp hồ sơ"
                                  aria-label={`Nộp hồ sơ ${r.title}`}
                                >
                                  <SendOutlined />
                                </button>
                              )}
                              <button
                                className="th-action-btn th-action-btn--view admin-table-action admin-table-action--icon admin-table-action--primary"
                                onClick={() => navigate(`/staff/training/${r.id}`)}
                                title="Xem chi tiết"
                                aria-label={`Xem chi tiết ${r.title}`}
                              >
                                <EyeOutlined />
                              </button>
                              {r.workflowStatus === 'DRAFT' && (
                                <>
                                  <button
                                    className="th-action-btn th-action-btn--edit admin-table-action admin-table-action--icon"
                                    onClick={() => navigate(`/staff/training/${r.id}/edit`)}
                                    title="Chỉnh sửa"
                                    aria-label={`Chỉnh sửa ${r.title}`}
                                  >
                                    <EditOutlined />
                                  </button>
                                  <button
                                    className="th-action-btn admin-table-action admin-table-action--icon admin-table-action--danger"
                                    onClick={() => setDeleteTarget(r)}
                                    disabled={deletingId === r.id}
                                    title="Xóa hồ sơ"
                                    aria-label={`Xóa hồ sơ ${r.title}`}
                                  >
                                    <DeleteOutlined />
                                  </button>
                                </>
                              )}
                              <button
                                className="th-action-btn th-action-btn--evidence admin-table-action admin-table-action--icon"
                                onClick={() => navigate(`/staff/training/${r.id}/evidence`)}
                                title="Minh chứng"
                                aria-label={`Quản lý minh chứng ${r.title}`}
                              >
                                <PaperClipOutlined />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {loading && records.length > 0 && (
                    <div className="th-infinite-loading" role="status">Đang tải thêm...</div>
                  )}
                  {listError && records.length > 0 && (
                    <button
                      type="button"
                      className="th-infinite-loading th-infinite-loading--error"
                      onClick={() => setReloadKey(value => value + 1)}
                    >
                      Tải thêm thất bại · Thử lại
                    </button>
                  )}

                  <div className="th-pagination">
                    <span className="th-pagination-info">
                      Hiển thị {records.length} / {totalElements} kết quả
                    </span>
                    <div className="th-pagination-pages">
                      <button className="th-page-btn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} aria-label="Trang trước">
                        <LeftOutlined />
                      </button>
                      {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                        const pageNum = totalPages <= 5 ? i : page < 3 ? i : page > totalPages - 3 ? totalPages - 5 + i : page - 2 + i
                        return (
                          <button
                            key={pageNum}
                            className={`th-page-btn ${page === pageNum ? 'th-page-btn--active' : ''}`}
                            onClick={() => setPage(pageNum)}
                            aria-label={`Trang ${pageNum + 1}`}
                            aria-current={page === pageNum ? 'page' : undefined}
                          >
                            {pageNum + 1}
                          </button>
                        )
                      })}
                      <button className="th-page-btn" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} aria-label="Trang sau">
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
