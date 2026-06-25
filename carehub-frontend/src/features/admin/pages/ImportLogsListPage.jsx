import { useState, useEffect, useMemo } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import { LeftOutlined, RightOutlined, LoadingOutlined } from '@ant-design/icons'
import '../styles/ImportLogsListPage.css'

// Helper to generate 248 mock import logs for offline/fallback mode
const generateMockLogs = () => {
  const logs = []
  const startTimestamp = new Date(2026, 5, 17, 18, 0, 0).getTime() // June 17, 2026
  const files = ['nhan_vien_goc.xlsx', 'phong_ban_goc.xlsx']
  
  for (let i = 0; i < 248; i++) {
    const id = 248 - i
    const fileIndex = i % 2
    
    // Distribute statuses realistically
    const statusRand = i % 10
    let status = 'SUCCESS'
    if (statusRand === 3 || statusRand === 7) {
      status = 'PARTIAL'
    } else if (statusRand === 9) {
      status = 'FAILED'
    }
    
    const totalRows = 50 + (i * 3) % 150
    let failedRows = 0
    if (status === 'PARTIAL') {
      failedRows = 1 + (i % 5)
    } else if (status === 'FAILED') {
      failedRows = totalRows
    }
    
    let insertedRows = 0
    let updatedRows = 0
    if (status === 'SUCCESS') {
      insertedRows = Math.floor(totalRows * 0.7)
      updatedRows = totalRows - insertedRows
    } else if (status === 'PARTIAL') {
      const successRows = totalRows - failedRows
      insertedRows = Math.floor(successRows * 0.6)
      updatedRows = successRows - insertedRows
    }
    
    // Decreasing timestamp by i * 4 hours
    const logTime = new Date(startTimestamp - i * 4 * 3600 * 1000)

    // Generate mock rowResultsJson for detail modal
    const rowResults = []
    const limit = Math.min(totalRows, 15)
    for (let r = 1; r <= limit; r++) {
      let rStatus
      let rMsg
      if (status === 'FAILED') {
        rStatus = 'FAILED'
        rMsg = 'Dòng chứa thông tin không hợp lệ: Định dạng ngày tháng sai'
      } else if (status === 'PARTIAL') {
        if (r % 3 === 0) {
          rStatus = 'FAILED'
          rMsg = 'Mã nhân viên đã tồn tại ở một phòng ban khác'
        } else if (r % 3 === 1) {
          rStatus = 'INSERTED'
          rMsg = 'Thêm mới tài khoản và nhân viên thành công'
        } else {
          rStatus = 'UPDATED'
          rMsg = 'Cập nhật phòng ban và chức vụ thành công'
        }
      } else if (status === 'SUCCESS') {
        rStatus = r % 2 === 0 ? 'INSERTED' : 'UPDATED'
        rMsg = rStatus === 'INSERTED' ? 'Đã thêm mới bản ghi tham chiếu' : 'Đã cập nhật thông tin tham chiếu'
      } else {
        rStatus = 'UNCHANGED'
        rMsg = 'Không có thay đổi dữ liệu'
      }
      rowResults.push({
        rowNumber: r + 1,
        employeeCode: `NV${1000 + r + i}`,
        status: rStatus,
        message: rMsg
      })
    }
    
    logs.push({
      id,
      sourceFile: files[fileIndex],
      status,
      totalRows,
      insertedRows,
      updatedRows,
      failedRows,
      durationMs: 500 + (i * 15) % 1500,
      createdAt: logTime.toISOString(),
      rowResultsJson: JSON.stringify(rowResults)
    })
  }
  return logs
}

function ImportLogsListPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [useMock, setUseMock] = useState(false)

  // Filters State
  const [fileFilter, setFileFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Details Modal State
  const [selectedLog, setSelectedLog] = useState(null)
  const [logDetail, setLogDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [rowStatusFilter, setRowStatusFilter] = useState('ALL')
  const [rowSearchQuery, setRowSearchQuery] = useState('')

  const isSystemLogsPath = window.location.pathname.includes('/admin/system-logs')
  const isSyncHistoryPath = window.location.pathname.includes('/admin/reference/sync-history')

  // Breadcrumbs config for AdminHeader
  const breadcrumbs = isSyncHistoryPath
    ? [
        { label: 'Dữ liệu tham chiếu' },
        { label: 'Lịch sử đồng bộ' }
      ]
    : [
        { label: 'Hệ thống' },
        { label: isSystemLogsPath ? 'System logs' : 'Import logs' }
      ]

  // Generate pagination buttons array with ellipsis for clean design
  const getVisiblePages = () => {
    const pages = []
    const range = 1
    pages.push(1)
    if (page - range > 2) {
      pages.push('...')
    }
    const start = Math.max(2, page - range)
    const end = Math.min(totalPages - 1, page + range)
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    if (page + range < totalPages - 1) {
      pages.push('...')
    }
    if (totalPages > 1) {
      pages.push(totalPages)
    }
    return pages
  }

  // Generate mock logs once
  const mockDatabase = useMemo(() => generateMockLogs(), [])

  // Local filtering logic for Mock Data
  const applyMockFilters = () => {
    let filtered = [...mockDatabase]

    // 1. Filter by source file
    if (fileFilter !== 'all') {
      filtered = filtered.filter(log => log.sourceFile === fileFilter)
    }

    // 2. Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(log => log.status === statusFilter)
    }

    // 3. Filter by dateFrom
    if (dateFrom) {
      const fromTime = new Date(dateFrom + 'T00:00:00').getTime()
      filtered = filtered.filter(log => new Date(log.createdAt).getTime() >= fromTime)
    }

    // 4. Filter by dateTo
    if (dateTo) {
      const toTime = new Date(dateTo + 'T23:59:59').getTime()
      filtered = filtered.filter(log => new Date(log.createdAt).getTime() <= toTime)
    }

    setTotalElements(filtered.length)
    const computedPages = Math.ceil(filtered.length / 10)
    setTotalPages(computedPages || 1)

    // Slice to current page
    const startIdx = (page - 1) * 10
    const pageData = filtered.slice(startIdx, startIdx + 10)
    setLogs(pageData)
    setLoading(false)
  }

  // Fetch data
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)

    if (useMock) {
      applyMockFilters()
      return
    }

    // Prepare parameters for API
    let apiStatus = undefined
    if (statusFilter === 'SUCCESS') {
      apiStatus = 'COMPLETED'
    } else if (statusFilter === 'PARTIAL') {
      apiStatus = 'COMPLETED_WITH_ERRORS'
    } else if (statusFilter === 'FAILED') {
      apiStatus = 'FAILED'
    }

    const params = {
      page: page - 1, // 0-indexed in backend
      size: 10,
      q: fileFilter !== 'all' ? fileFilter : undefined,
      status: apiStatus
    }

    adminApi.getImportLogs(params)
      .then(res => {
        const responseData = res.data?.data
        if (responseData && responseData.content && responseData.content.length > 0) {
          let apiLogs = responseData.content

          // Apply client-side date filtering if specified
          if (dateFrom) {
            const fromTime = new Date(dateFrom + 'T00:00:00').getTime()
            apiLogs = apiLogs.filter(log => new Date(log.createdAt).getTime() >= fromTime)
          }
          if (dateTo) {
            const toTime = new Date(dateTo + 'T23:59:59').getTime()
            apiLogs = apiLogs.filter(log => new Date(log.createdAt).getTime() <= toTime)
          }

          setLogs(apiLogs)
          setTotalElements(responseData.totalElements || 0)
          setTotalPages(responseData.totalPages || 0)
          setLoading(false)
        } else {
          // If response succeeded but returned empty, fallback to mock data
          setUseMock(true)
        }
      })
      .catch(err => {
        console.warn('GET /system/import-logs API request failed or not found. Falling back to mock logs.', err)
        setUseMock(true)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fileFilter, statusFilter, dateFrom, dateTo, useMock])

  // Reset page to 1 when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1)
  }, [fileFilter, statusFilter, dateFrom, dateTo])

  // Re-apply filters for mock data when page or filters change
  useEffect(() => {
    if (useMock) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      applyMockFilters()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fileFilter, statusFilter, dateFrom, dateTo, useMock])

  // Open details modal
  const handleOpenDetailModal = (log) => {
    setSelectedLog(log)
    setIsDetailModalOpen(true)
    setRowStatusFilter('ALL')
    setRowSearchQuery('')

    if (useMock) {
      setLogDetail(log)
      return
    }

    setDetailLoading(true)
    setLogDetail(null)
    adminApi.getImportLogById(log.id)
      .then(res => {
        const responseData = res.data?.data
        if (responseData) {
          setLogDetail(responseData)
        } else {
          setLogDetail(log)
        }
        setDetailLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch import log detail:', err)
        setLogDetail(log)
        setDetailLoading(false)
      })
  }

  // Parse rowResultsJson
  const parsedRowResults = useMemo(() => {
    if (!logDetail?.rowResultsJson) return []
    try {
      const parsed = JSON.parse(logDetail.rowResultsJson)
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      console.error('Failed to parse rowResultsJson:', e)
      return []
    }
  }, [logDetail])

  // Filtered row results within the modal
  const filteredRowResults = useMemo(() => {
    let result = parsedRowResults
    if (rowStatusFilter !== 'ALL') {
      result = result.filter(r => r.status === rowStatusFilter)
    }
    if (rowSearchQuery.trim()) {
      const q = rowSearchQuery.toLowerCase()
      result = result.filter(r => r.employeeCode && r.employeeCode.toLowerCase().includes(q))
    }
    return result
  }, [parsedRowResults, rowStatusFilter, rowSearchQuery])

  // Helper to format date string to DD/MM/YYYY HH:mm
  const fmtDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  // Helper to render status badges
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
      case 'COMPLETED':
        return (
          <span className="il-badge il-badge--success">
            <span className="il-badge__dot" />
            Thành công
          </span>
        )
      case 'PARTIAL':
      case 'COMPLETED_WITH_ERRORS':
        return (
          <span className="il-badge il-badge--partial">
            <span className="il-badge__dot" />
            Lỗi một phần
          </span>
        )
      case 'FAILED':
        return (
          <span className="il-badge il-badge--failed">
            <span className="il-badge__dot" />
            Thất bại
          </span>
        )
      default:
        return (
          <span className="il-badge">
            <span className="il-badge__dot" />
            {status}
          </span>
        )
    }
  }

  // Helper to render status badge of specific Excel rows in modal
  const renderRowStatusBadge = (status) => {
    switch (status) {
      case 'INSERTED':
        return <span className="il-row-badge il-row-badge--inserted">Thêm mới</span>
      case 'UPDATED':
        return <span className="il-row-badge il-row-badge--updated">Cập nhật</span>
      case 'UNCHANGED':
        return <span className="il-row-badge il-row-badge--unchanged">Không đổi</span>
      case 'FAILED':
        return <span className="il-row-badge il-row-badge--failed">Thất bại</span>
      default:
        return <span className="il-row-badge">{status}</span>
    }
  }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="il-page">
              
              {/* Title & Subtitle Card */}
              <div className="il-title-card">
                <h1 className="il-title">
                  {isSyncHistoryPath
                    ? 'Lịch sử đồng bộ'
                    : isSystemLogsPath
                    ? 'Nhật ký hệ thống (System logs)'
                    : 'Nhật ký nhập dữ liệu (Import logs)'}
                </h1>
                <p className="il-subtitle">
                  {isSyncHistoryPath
                    ? 'Lịch sử của tất cả các đợt đồng bộ/nhập dữ liệu tham chiếu.'
                    : isSystemLogsPath
                    ? 'Giám sát và kiểm toán toàn bộ hoạt động nhập dữ liệu tham chiếu trên hệ thống.'
                    : 'Lịch sử của tất cả các đợt nhập dữ liệu tham chiếu.'}
                </p>
              </div>

              {/* Filters Block */}
              <div className="il-filter-bar">
                <div className="il-filter-field">
                  <span className="il-filter-label">Loại dữ liệu nhập</span>
                  <select
                    className="il-filter-select"
                    value={fileFilter}
                    onChange={(e) => setFileFilter(e.target.value)}
                  >
                    <option value="all">Tất cả loại dữ liệu</option>
                    <option value="nhan_vien_goc.xlsx">Nhân viên tham chiếu (nhan_vien_goc.xlsx)</option>
                    <option value="phong_ban_goc.xlsx">Phòng ban tham chiếu (phong_ban_goc.xlsx)</option>
                  </select>
                </div>

                <div className="il-filter-field">
                  <span className="il-filter-label">Trạng thái</span>
                  <select
                    className="il-filter-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="SUCCESS">Thành công</option>
                    <option value="PARTIAL">Lỗi một phần</option>
                    <option value="FAILED">Thất bại</option>
                  </select>
                </div>

                <div className="il-filter-field">
                  <span className="il-filter-label">Từ ngày</span>
                  <input
                    type="date"
                    className="il-filter-date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>

                <div className="il-filter-field">
                  <span className="il-filter-label">Đến ngày</span>
                  <input
                    type="date"
                    className="il-filter-date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>

                <span className="il-results-count">{totalElements} kết quả</span>
              </div>

              {/* Table Card */}
              <div className="il-table-card">
                <table className="il-table">
                  <thead>
                    <tr>
                      <th>Thời gian diễn ra</th>
                      <th>Loại dữ liệu nhập</th>
                      <th style={{ textAlign: 'right' }}>Tổng</th>
                      <th style={{ textAlign: 'right' }}>Thành công</th>
                      <th style={{ textAlign: 'right' }}>Lỗi</th>
                      <th>Trạng thái</th>
                      <th style={{ textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                          <LoadingOutlined style={{ marginRight: 8 }} /> Đang tải lịch sử nhập dữ liệu...
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                          Không tìm thấy nhật ký nhập dữ liệu phù hợp.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => {
                        const successCount = log.insertedRows + log.updatedRows
                        return (
                          <tr key={log.id}>
                            <td>{fmtDate(log.createdAt)}</td>
                            <td>
                              <span className="il-source-file">{log.sourceFile}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>{log.totalRows}</td>
                            <td style={{ textAlign: 'right' }}>{successCount}</td>
                            <td style={{ textAlign: 'right' }}>
                              <span className={log.failedRows > 0 ? "il-failed-count--more" : "il-failed-count--zero"}>
                                {log.failedRows}
                              </span>
                            </td>
                            <td>{renderStatusBadge(log.status)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="il-action-btn"
                                onClick={() => handleOpenDetailModal(log)}
                              >
                                Chi tiết
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>

                {/* Pagination Footer */}
                {!loading && logs.length > 0 && (
                  <div className="il-pagination">
                    <span className="il-pagination-info">
                      Hiển thị {logs.length} trong tổng số {totalElements} kết quả
                    </span>
                    <div className="il-page-nums">
                      <button
                        className="il-pn"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <LeftOutlined />
                      </button>

                      {getVisiblePages().map((n, idx) => {
                        if (n === '...') {
                          return (
                            <span key={`dots-${idx}`} className="il-pn-dots">
                              ...
                            </span>
                          )
                        }
                        return (
                          <button
                            key={n}
                            className={`il-pn ${n === page ? 'il-pn--active' : ''}`}
                            onClick={() => setPage(n)}
                          >
                            {n}
                          </button>
                        )
                      })}

                      <button
                        className="il-pn"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || totalPages === 0}
                      >
                        <RightOutlined />
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </main>
        </div>
      </div>

      {/* Details Modal */}
      {isDetailModalOpen && (
        <div className="il-modal-overlay" onClick={() => setIsDetailModalOpen(false)}>
          <div className="il-modal" onClick={(e) => e.stopPropagation()}>
            <div className="il-modal-header">
              <div>
                <h2 className="il-modal-title">Chi tiết đợt nhập dữ liệu #{selectedLog?.id}</h2>
                <p className="il-modal-subtitle">Chi tiết kết quả và các dòng lỗi từ file nhập.</p>
              </div>
              <button className="il-modal-close" onClick={() => setIsDetailModalOpen(false)}>
                &times;
              </button>
            </div>

            <div className="il-modal-body">
              {detailLoading ? (
                <div className="il-modal-loading">
                  <LoadingOutlined /> Đang tải thông tin chi tiết...
                </div>
              ) : (
                <>
                  {/* Summary Grid */}
                  <div className="il-summary-grid">
                    <div className="il-summary-item">
                      <span className="il-summary-label">Tên tệp nguồn</span>
                      <span className="il-summary-value">{logDetail?.sourceFile}</span>
                    </div>
                    <div className="il-summary-item">
                      <span className="il-summary-label">Thời gian nhập</span>
                      <span className="il-summary-value">{fmtDate(logDetail?.createdAt)}</span>
                    </div>
                    <div className="il-summary-item">
                      <span className="il-summary-label">Thời gian chạy</span>
                      <span className="il-summary-value">{((logDetail?.durationMs || 0) / 1000).toFixed(2)} giây</span>
                    </div>
                    <div className="il-summary-item">
                      <span className="il-summary-label">Trạng thái chung</span>
                      <span className="il-summary-value">{renderStatusBadge(logDetail?.status)}</span>
                    </div>
                  </div>

                  {/* Count Stats Cards */}
                  <div className="il-stats-row">
                    <div className="il-stat-card il-stat-card--total">
                      <div className="il-stat-num">{logDetail?.totalRows || 0}</div>
                      <div className="il-stat-label">Tổng số dòng</div>
                    </div>
                    <div className="il-stat-card il-stat-card--inserted">
                      <div className="il-stat-num">{logDetail?.insertedRows || 0}</div>
                      <div className="il-stat-label">Thêm mới</div>
                    </div>
                    <div className="il-stat-card il-stat-card--updated">
                      <div className="il-stat-num">{logDetail?.updatedRows || 0}</div>
                      <div className="il-stat-label">Cập nhật</div>
                    </div>
                    <div className="il-stat-card il-stat-card--failed">
                      <div className="il-stat-num">{logDetail?.failedRows || 0}</div>
                      <div className="il-stat-label">Thất bại</div>
                    </div>
                  </div>

                  {/* Row Level Results */}
                  <div className="il-row-results-section">
                    <div className="il-row-results-header">
                      <h3>Kết quả chi tiết từng dòng ({parsedRowResults.length})</h3>
                      <div className="il-row-filters">
                        <select
                          className="il-filter-select il-row-filter-select"
                          value={rowStatusFilter}
                          onChange={(e) => setRowStatusFilter(e.target.value)}
                        >
                          <option value="ALL">Tất cả trạng thái</option>
                          <option value="INSERTED">Thêm mới</option>
                          <option value="UPDATED">Cập nhật</option>
                          <option value="UNCHANGED">Không đổi</option>
                          <option value="FAILED">Thất bại</option>
                        </select>
                        <input
                          type="text"
                          className="il-row-search-input"
                          placeholder="Tìm mã nhân viên..."
                          value={rowSearchQuery}
                          onChange={(e) => setRowSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="il-row-table-container">
                      <table className="il-row-table">
                        <thead>
                          <tr>
                            <th style={{ width: '80px' }}>Dòng Excel</th>
                            <th style={{ width: '150px' }}>Mã nhân viên</th>
                            <th style={{ width: '130px' }}>Kết quả</th>
                            <th>Thông báo chi tiết</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRowResults.length === 0 ? (
                            <tr>
                              <td colSpan="4" style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
                                Không tìm thấy kết quả dòng phù hợp với bộ lọc.
                              </td>
                            </tr>
                          ) : (
                            filteredRowResults.map((row, idx) => (
                              <tr key={idx}>
                                <td>{row.rowNumber}</td>
                                <td>
                                  <span className="il-row-emp-code">{row.employeeCode || '-'}</span>
                                </td>
                                <td>{renderRowStatusBadge(row.status)}</td>
                                <td className="il-row-msg-cell">
                                  <span className={row.status === 'FAILED' ? 'il-row-msg-error' : 'il-row-msg-info'}>
                                    {row.message}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="il-modal-footer">
              <button className="il-modal-btn il-modal-btn--secondary" onClick={() => setIsDetailModalOpen(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImportLogsListPage
