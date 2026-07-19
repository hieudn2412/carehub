import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  PaperClipOutlined,
  LeftOutlined,
  RightOutlined,
  SendOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { staffApi } from '../../api/staffApi.js'
import { getRolesFromAccessToken } from '../../../../features/auth/utils/jwt.js'
import { tokenStorage } from '../../../../features/auth/services/tokenStorage.js'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import '../../styles/TrainingHours.css'

function TrainingHoursListScreen() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = roles.some(r => String(r).toUpperCase().includes('ADMIN'))
  const isManager = roles.some(r => String(r).toUpperCase().includes('MANAGER'))
  const dashboardPath = isAdmin ? '/admin/dashboard' : isManager ? '/manager/dashboard' : '/staff/dashboard'
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(0)
  const [totalSubmittedHours, setTotalSubmittedHours] = useState(0)
  const [requiredHours, setRequiredHours] = useState(120)
  const [cmeConfigured, setCmeConfigured] = useState(false)
  const [submittingId, setSubmittingId] = useState(null)
  const [myEmployeeId, setMyEmployeeId] = useState(null)
  const [trigger, setTrigger] = useState(0)
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
  }, [trigger])

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      const params = {
        page,
        size,
        keyword: search || undefined,
        workflowStatus: status || undefined,
        ...(myEmployeeId != null && { employeeId: myEmployeeId }),
      }
      trainingApi.listRecords(params)
        .then(res => {
          setRecords(res.data?.data?.content || [])
          setTotalElements(res.data?.data?.totalElements || 0)
        })
        .catch(err => console.error("Error fetching training records", err))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [page, search, status, trigger, myEmployeeId])

  const handleDirectSubmit = (recordId, version) => {
    setSubmittingId(recordId)
    trainingApi.submitRecord(recordId, { version })
      .then(() => {
        showToast("Nộp hồ sơ thành công!", "success")
        setTrigger(t => t + 1)
      })
      .catch(() => showToast("Nộp hồ sơ thất bại.", "error"))
      .finally(() => setSubmittingId(null))
  }

  const getStatusLabel = (s) => {
    switch (s) {
      case 'SUBMITTED': return 'Đã nộp'
      case 'DRAFT': return 'Nháp'
      case 'CANCELLED': return 'Đã hủy'
      default: return s
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  const totalPages = Math.ceil(totalElements / size) || 1

  const isCompliant = totalSubmittedHours >= requiredHours
  const progressPct = requiredHours > 0 ? Math.min(Math.round((totalSubmittedHours / requiredHours) * 100), 100) : 0

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header breadcrumbs={[
          { label: 'Tổng quan', link: dashboardPath },
          { label: 'Giờ đào tạo' }
        ]} />
        <div className="dashboard-layout__body">
          <div className="training-page">

            {/* Compliance Summary Banner */}
            <div className={`th-compliance-banner ${
              !cmeConfigured ? 'th-compliance-banner--neutral'
                : isCompliant ? 'th-compliance-banner--success'
                : 'th-compliance-banner--warning'
            }`}>
              <div className="th-compliance-banner__left">
                <h1 className="th-page-title">Giờ đào tạo của tôi</h1>
                <p className="th-page-subtitle">Hồ sơ đào tạo · Chu kỳ 5 năm cuốn chiều</p>
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
                  placeholder="Tìm theo tên khóa đào tạo..."
                  className="th-search-input"
                />
              </div>
              <select
                value={status}
                onChange={e => { setStatus(e.target.value); setPage(0) }}
                className="th-filter-select"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="SUBMITTED">Đã nộp</option>
                <option value="DRAFT">Nháp</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
              <button className="th-btn-primary" onClick={() => navigate('/staff/training/new')}>
                <PlusOutlined /> Thêm hồ sơ
              </button>
            </div>

            {/* Table */}
            <div className="th-table-card">
              {loading ? (
                <div className="th-table-state">Đang tải danh sách...</div>
              ) : records.length === 0 ? (
                <div className="th-table-state">
                  <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: '#374151' }}>Chưa có hồ sơ nào</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
                    {search || status ? 'Không tìm thấy kết quả phù hợp.' : 'Nhấn "Thêm hồ sơ" để bắt đầu khai báo giờ đào tạo.'}
                  </p>
                </div>
              ) : (
                <>
                  <table className="th-table">
                    <thead>
                      <tr>
                        <th>Tên khóa đào tạo</th>
                        <th className="th-col-num">Giờ</th>
                        <th>Ngày</th>
                        <th>Trạng thái</th>
                        <th className="th-col-center">Minh chứng</th>
                        <th className="th-col-actions">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map(r => (
                        <tr key={r.id} onClick={() => navigate(`/staff/training/${r.id}`)} className="th-clickable-row">
                          <td>
                            <span className="th-record-title">{r.title}</span>
                            {r.provider && <span className="th-record-provider">{r.provider}</span>}
                          </td>
                          <td className="th-col-num"><strong>{r.declaredHours}h</strong></td>
                          <td>{formatDate(r.startDate)}</td>
                          <td>
                            <span className={`th-badge th-badge--${
                              r.workflowStatus === 'SUBMITTED' ? 'success'
                                : r.workflowStatus === 'CANCELLED' ? 'danger'
                                : 'warning'
                            }`}>
                              {getStatusLabel(r.workflowStatus)}
                            </span>
                          </td>
                          <td className="th-col-center">
                            {r.evidenceCount > 0 ? (
                              <span className="th-evidence-count">
                                <PaperClipOutlined /> {r.evidenceCount}
                              </span>
                            ) : (
                              <span className="th-evidence-none">-</span>
                            )}
                          </td>
                          <td className="th-col-actions">
                            <div className="th-actions" onClick={e => e.stopPropagation()}>
                              {r.workflowStatus === 'DRAFT' && (
                                <button
                                  className="th-action-btn th-action-btn--submit"
                                  onClick={() => handleDirectSubmit(r.id, r.version)}
                                  disabled={submittingId === r.id}
                                  title="Nộp hồ sơ"
                                >
                                  <SendOutlined />
                                </button>
                              )}
                              <button
                                className="th-action-btn th-action-btn--view"
                                onClick={() => navigate(`/staff/training/${r.id}`)}
                                title="Xem chi tiết"
                              >
                                <EyeOutlined />
                              </button>
                              {r.workflowStatus === 'DRAFT' && (
                                <button
                                  className="th-action-btn th-action-btn--edit"
                                  onClick={() => navigate(`/staff/training/${r.id}/edit`)}
                                  title="Chỉnh sửa"
                                >
                                  <EditOutlined />
                                </button>
                              )}
                              <button
                                className="th-action-btn th-action-btn--evidence"
                                onClick={() => navigate(`/staff/training/${r.id}/evidence`)}
                                title="Minh chứng"
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
                      <button className="th-page-btn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                        <LeftOutlined />
                      </button>
                      {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                        const pageNum = totalPages <= 5 ? i : page < 3 ? i : page > totalPages - 3 ? totalPages - 5 + i : page - 2 + i
                        return (
                          <button
                            key={pageNum}
                            className={`th-page-btn ${page === pageNum ? 'th-page-btn--active' : ''}`}
                            onClick={() => setPage(pageNum)}
                          >
                            {pageNum + 1}
                          </button>
                        )
                      })}
                      <button className="th-page-btn" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                        <RightOutlined />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrainingHoursListScreen
