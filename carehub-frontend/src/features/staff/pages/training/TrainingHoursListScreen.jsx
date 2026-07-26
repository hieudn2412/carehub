import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SearchOutlined,
  PlusOutlined,
  PaperClipOutlined,
  LeftOutlined,
  RightOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { staffApi } from '../../api/staffApi.js'
import { getRolesFromAccessToken } from '../../../../features/auth/utils/jwt.js'
import { tokenStorage } from '../../../../features/auth/services/tokenStorage.js'
import '../../styles/TrainingHours.css'

function TrainingHoursListScreen() {
  const navigate = useNavigate()
  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = roles.some(r => String(r).toUpperCase().includes('ADMIN'))
  const isManager = roles.some(r => String(r).toUpperCase().includes('MANAGER'))
  const dashboardPath = isAdmin ? '/admin/dashboard' : isManager ? '/manager/dashboard' : '/staff/dashboard'
  const [search, setSearch] = useState('')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(0)
  const [totalSubmittedHours, setTotalSubmittedHours] = useState(0)
  const [requiredHours, setRequiredHours] = useState(120)
  const [cmeConfigured, setCmeConfigured] = useState(false)
  const [myEmployeeId, setMyEmployeeId] = useState(null)
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
    const timer = setTimeout(() => {
      setLoading(true)
      setListError('')
      const params = {
        page,
        size,
        titleKeyword: search || undefined,
        ...(myEmployeeId != null && { employeeId: myEmployeeId }),
      }
      trainingApi.listRecords(params)
        .then(res => {
          const data = res.data?.data || {}
          setRecords(data.content || [])
          setTotalElements(data.totalElements || 0)
        })
        .catch(err => {
          console.error("Error fetching training records", err)
          setRecords([])
          setTotalElements(0)
          setListError('Không thể tải danh sách giờ đào tạo. Vui lòng thử lại.')
        })
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [page, search, myEmployeeId, reloadKey])

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  const totalPages = Math.ceil(totalElements / size) || 1

  const isCompliant = totalSubmittedHours >= requiredHours
  const progressPct = requiredHours > 0 ? Math.min(Math.round((totalSubmittedHours / requiredHours) * 100), 100) : 0

  return (
    <AppShell breadcrumbs={[
      { label: 'Tổng quan', link: dashboardPath },
      { label: 'Giờ đào tạo liên tục' }
    ]}>
      <div className="training-page">

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
              <div className="th-search-box">
                <SearchOutlined className="th-search-icon" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0) }}
                  placeholder="Tìm theo nội dung đào tạo..."
                  className="th-search-input"
                  aria-label="Tìm theo tên khóa đào tạo"
                />
              </div>
              <select
                value={status}
                onChange={e => { setStatus(e.target.value); setPage(0) }}
                className="th-filter-select"
                aria-label="Lọc theo trạng thái hồ sơ"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="SUBMITTED">Đã nộp</option>
                <option value="DRAFT">Nháp</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
              <button className="th-btn-primary" onClick={() => navigate('/staff/training/new')}>
                <PlusOutlined /> Cập nhật giờ đào tạo
              </button>
            </div>

            {/* Table */}
            <div className="th-table-card">
              {loading ? (
                <div className="th-table-state">Đang tải danh sách...</div>
              ) : listError ? (
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
                  <table className="th-table">
                    <thead>
                      <tr>
                        <th>Ngày đào tạo liên tục</th>
                        <th>Nội dung đào tạo</th>
                        <th className="th-col-num">Số giờ đào tạo</th>
                        <th className="th-col-center">Minh chứng</th>
                        <th className="th-col-actions">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
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
                          <td data-label="Ngày nộp">
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
                          <td className="th-col-actions" data-label="Thao tác">
                            <div className="th-actions" onClick={e => e.stopPropagation()}>
                              {r.workflowStatus === 'DRAFT' && (
                                <button
                                  className="th-action-btn th-action-btn--submit"
                                  onClick={() => handleDirectSubmit(r.id, r.version, r.startDate)}
                                  disabled={submittingId === r.id}
                                  title="Nộp hồ sơ"
                                  aria-label={`Nộp hồ sơ ${r.title}`}
                                >
                                  <SendOutlined />
                                </button>
                              )}
                              <button
                                className="th-action-btn th-action-btn--view"
                                onClick={() => navigate(`/staff/training/${r.id}`)}
                                title="Xem chi tiết"
                                aria-label={`Xem chi tiết ${r.title}`}
                              >
                                <EyeOutlined />
                              </button>
                              {r.workflowStatus === 'DRAFT' && (
                                <button
                                  className="th-action-btn th-action-btn--edit"
                                  onClick={() => navigate(`/staff/training/${r.id}/edit`)}
                                  title="Chỉnh sửa"
                                  aria-label={`Chỉnh sửa ${r.title}`}
                                >
                                  <EditOutlined />
                                </button>
                              )}
                              <button
                                className="th-action-btn th-action-btn--evidence"
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
    </AppShell>
  )
}

export default TrainingHoursListScreen
