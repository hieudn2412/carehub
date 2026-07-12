import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SearchOutlined,
  CalendarOutlined,
  PlusOutlined,
  EditOutlined,
  PaperClipOutlined,
  ExclamationCircleOutlined,
  LeftOutlined,
  RightOutlined,
  SendOutlined,
  FileDoneOutlined,
  FileExclamationOutlined,
} from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import '../../styles/TrainingHours.css'

function TrainingHoursListScreen() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(0)
  const [totalSubmittedHours, setTotalSubmittedHours] = useState(0)
  const [requiredHours, setRequiredHours] = useState(120)
  const [cmeConfigured, setCmeConfigured] = useState(false)
  const [trigger, setTrigger] = useState(0)
  const size = 10

  // Fetch approved hours dynamically from compliance status (5-year rolling cycle)
  useEffect(() => {
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
      .catch(err => console.error("Error fetching approved hours", err))
  }, [trigger])

  // Fetch training records with debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setLoading(true)
      const params = {
        page,
        size,
        keyword: search || undefined,
        workflowStatus: status || undefined,
      }
      trainingApi.listRecords(params)
        .then(res => {
          setRecords(res.data?.data?.content || [])
          setTotalElements(res.data?.data?.totalElements || 0)
        })
        .catch(err => {
          console.error("Error fetching training records", err)
        })
        .finally(() => {
          setLoading(false)
        })
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [page, search, status, trigger])

  const handleDirectSubmit = (recordId) => {
    trainingApi.submitRecord(recordId)
      .then(() => {
        showToast("Nộp hồ sơ thành công!", "success")
        setTrigger(t => t + 1)
      })
      .catch(err => {
        console.error("Error submitting record", err)
        showToast("Nộp hồ sơ thất bại. Vui lòng kiểm tra lại.", "error")
      })
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'SUBMITTED':
        return 'Đã nộp'
      case 'DRAFT':
        return 'Nháp'
      case 'CANCELLED':
        return 'Đã hủy'
      default:
        return status
    }
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'SUBMITTED':
        return 'training-badge--approved'
      case 'CANCELLED':
        return 'training-badge--rejected'
      case 'DRAFT':
        return 'training-badge--pending'
      default:
        return 'training-badge--pending'
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}/${month}/${year}`
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < Math.ceil(totalElements / size)) {
      setPage(newPage)
    }
  }

  const totalPages = Math.ceil(totalElements / size) || 1

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Giờ đào tạo" />
        <div className="dashboard-layout__body">
          <div className="training-page">
            {/* Title & Alerts */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Giờ đào tạo của tôi</h1>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>Hồ sơ CME · Chu kỳ 5 năm cuốn chiều</p>
              </div>
              <div className="training-alert">
                <ExclamationCircleOutlined style={{ color: '#dc2626', fontSize: 18 }} />
                <span>
                  {cmeConfigured
                    ? <>Tổng số giờ CME: <strong>{totalSubmittedHours} / {requiredHours} giờ</strong> — {totalSubmittedHours >= requiredHours ? 'Đã hoàn thành mục tiêu!' : `Còn thiếu ${requiredHours - totalSubmittedHours} giờ.`}</>
                    : <>Phòng ban của bạn không áp dụng yêu cầu CME. Hồ sơ đào tạo vẫn được lưu bình thường.</>}
                </span>
              </div>
            </div>

            {/* Filters Row */}
            <div className="training-filters-row">
              <div className="training-search-container">
                <span className="training-search-icon">
                  <SearchOutlined style={{ color: '#9ca3af' }} />
                </span>
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(0)
                  }}
                  placeholder="Tìm theo tên khóa đào tạo..."
                  className="training-search-input"
                />
              </div>

              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setPage(0)
                }}
                className="training-select"
              >
                <option value="">Trạng thái</option>
                <option value="SUBMITTED">Đã nộp</option>
                <option value="DRAFT">Nháp</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>

              <div className="training-date-trigger">
                <CalendarOutlined />
                <span>Từ ngày</span>
              </div>

              <button
                onClick={() => navigate('/staff/training/new')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '10px 20px',
                  background: '#1aaa84',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <PlusOutlined /> Thêm hồ sơ
              </button>
            </div>

            {/* Table */}
            <div className="training-table-container">
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Đang tải danh sách...</div>
              ) : records.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Không tìm thấy hồ sơ nào.</div>
              ) : (
                <>
                  <table className="training-table">
                    <thead>
                      <tr>
                        <th>Tên khóa đào tạo</th>
                        <th>Giờ</th>
                        <th>Ngày</th>
                        <th>Trạng thái</th>
                        <th>Minh chứng</th>
                        <th>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={r.id}>
                          <td className="training-table__name">{r.title}</td>
                          <td>{r.declaredHours}h</td>
                          <td>{formatDate(r.startDate)}</td>
                          <td>
                            <span className={`training-badge ${getStatusClass(r.workflowStatus)}`}>
                              <span className="training-badge__dot" />
                              {getStatusLabel(r.workflowStatus)}
                            </span>
                          </td>
                          <td>
                            {r.evidenceCount > 0 ? (
                              <FileDoneOutlined style={{ color: '#16a34a', fontSize: 18 }} title="Đã có minh chứng" />
                            ) : (
                              <FileExclamationOutlined style={{ color: '#dc2626', fontSize: 18 }} title="Chưa có minh chứng" />
                            )}
                          </td>
                          <td>
                            <div className="training-actions">
                              {r.workflowStatus === 'DRAFT' && (
                                <button
                                  onClick={() => handleDirectSubmit(r.id)}
                                  className="training-action-btn"
                                  style={{ color: '#16a34a', borderColor: '#16a34a' }}
                                  title="Nộp hồ sơ"
                                >
                                  <SendOutlined />
                                </button>
                              )}
                              <button
                                onClick={() => navigate(`/staff/training/${r.id}`)}
                                className="training-action-btn"
                                style={{ color: '#2563eb', borderColor: '#2563eb' }}
                                title="Xem & Chỉnh sửa"
                              >
                                <EditOutlined />
                              </button>
                              <button
                                onClick={() => navigate(`/staff/training/${r.id}/evidence`)}
                                className="training-action-btn"
                                style={{ color: '#374151', borderColor: '#d1d5db' }}
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

                  {/* Pagination */}
                  <div className="training-pagination">
                    <span className="training-pagination__info">
                      Hiển thị {records.length} trong tổng số {totalElements} kết quả
                    </span>
                    <div className="training-pagination__pages">
                      <button
                        className="training-page-btn"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 0}
                      >
                        <LeftOutlined />
                      </button>
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          className={`training-page-btn ${page === i ? 'active' : ''}`}
                          onClick={() => setPage(i)}
                        >
                          {i + 1}
                        </button>
                      ))}
                      <button
                        className="training-page-btn"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page === totalPages - 1}
                      >
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
