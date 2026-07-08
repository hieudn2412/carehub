import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchOutlined, EyeOutlined, LoadingOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { staffApi } from '../../api/staffApi.js'
import '../../styles/ManagerPages.css'

const HISTORY_PAGE_SIZE = 10

function formatScore(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return '---'
  }

  const positiveValue = Math.max(numberValue, 0)
  const roundedValue = Math.abs(positiveValue) < 0.00005 ? 0 : positiveValue
  return roundedValue.toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

function getSubmissionVersionNumber(item) {
  return item.formVersion?.versionNumber
    || item.version?.versionNumber
    || item.versionNumber
    || item.formVersionNumber
    || null
}

function getVisiblePages(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const startPage = Math.min(Math.max(currentPage - 2, 1), totalPages - 4)
  return Array.from({ length: 5 }, (_, index) => startPage + index)
}

function ManagerEvaluationHistoryPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [history, setHistory] = useState([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    staffApi.getFormSubmissions({
      page,
      size: HISTORY_PAGE_SIZE,
      status: 'SUBMITTED',
      sort: 'submittedAt,desc',
    })
      .then(res => {
        // Lọc ra các phiếu đã nộp chính thức (SUBMITTED)
        const pageData = res.data?.data || {}
        const submissions = pageData.content || []
        const submittedOnly = submissions.filter(item => item.status === 'SUBMITTED')
        setHistory(submittedOnly)
        setError(null)
        setTotalPages(Math.max(Number(pageData.totalPages) || 1, 1))
        setTotalItems(Number(pageData.totalElements) || submittedOnly.length)
        setLoading(false)
      })
      .catch(err => {
        console.error("Error loading evaluation history", err)
        setError("Không thể tải lịch sử đánh giá.")
        setHistory([])
        setTotalPages(1)
        setTotalItems(0)
        setLoading(false)
      })
  }, [page])

  const goToPage = (nextPage) => {
    setLoading(true)
    setError(null)
    setPage(nextPage)
  }

  const currentPageNumber = page + 1
  const visiblePages = useMemo(
    () => getVisiblePages(currentPageNumber, totalPages),
    [currentPageNumber, totalPages],
  )

  const filteredHistory = history.filter(item => 
    (item.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (getSubmissionVersionNumber(item) ? `v${getSubmissionVersionNumber(item)}` : '').toLowerCase().includes(search.toLowerCase()) ||
    (item.subject?.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
    (item.subject?.employeeCode || '').toLowerCase().includes(search.toLowerCase())
  )

  const getResultText = (result) => {
    switch (result) {
      case 'PASSED':
        return 'Đạt'
      case 'FAILED_SCORE':
        return 'Không đạt (Điểm)'
      case 'FAILED_CRITICAL':
        return 'K.Đạt (Then chốt)'
      default:
        return 'Chưa rõ'
    }
  }

  const getResultColor = (result) => {
    return result === 'PASSED' ? 'green' : 'red'
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Lịch sử đánh giá" />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Lịch sử đánh giá</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              Danh sách kết quả các lần chấm bảng kiểm giám sát chất lượng tại khoa
            </p>
          </div>

          {/* Search toolbar */}
          <div className="mgr-toolbar">
            <div className="mgr-search-box">
              <input 
                type="text" 
                placeholder="Tìm theo tên nhân viên, tên bảng kiểm..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <SearchOutlined />
            </div>
          </div>

          {/* Table Card */}
          <div className="mgr-card" style={{ padding: 0, overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                <LoadingOutlined style={{ fontSize: 24, marginRight: 8 }} /> Đang tải lịch sử đánh giá...
              </div>
            ) : error ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
                {error}
              </div>
            ) : filteredHistory.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                Không có lịch sử đánh giá nào.
              </div>
            ) : (
              <table className="mgr-table">
                <thead>
                  <tr>
                    <th>Tên bảng kiểm</th>
                    <th>Nhân viên được đánh giá</th>
                    <th>Người đánh giá</th>
                    <th>Ngày đánh giá</th>
                    <th>Điểm số đạt</th>
                    <th>Xếp loại kết quả</th>
                    <th style={{ width: 80, textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>
                        <span>{item.title}</span>
                        {getSubmissionVersionNumber(item) && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              marginLeft: 8,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: '#eff6ff',
                              color: '#2563eb',
                              fontSize: 11,
                              fontWeight: 700,
                              verticalAlign: 'middle',
                            }}
                          >
                            v{getSubmissionVersionNumber(item)}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.subject?.fullName}</div>
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>{item.subject?.employeeCode}</div>
                      </td>
                      <td>Trưởng khoa</td>
                      <td style={{ color: '#475569' }}>
                        {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('vi-VN') : new Date(item.updatedAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td>
                        <strong style={{ 
                          color: getResultColor(item.result) === 'green' ? 'var(--mgr-green)' : 'var(--mgr-red)',
                          fontSize: 14
                        }}>
                          {formatScore(item.convertedScore)}
                        </strong>
                      </td>
                      <td>
                        <span className={`mgr-badge mgr-badge--${getResultColor(item.result)}`}>
                          {getResultText(item.result)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          onClick={() => navigate(`/manager/quality/history/${item.id}`)}
                          style={{
                            border: '1px solid #e2e8f0',
                            background: '#fff',
                            padding: '6px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            color: '#475569',
                            transition: 'all 0.15s'
                          }}
                          title="Xem chi tiết kết quả"
                          onMouseOver={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#fff'; }}
                          onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#475569'; }}
                        >
                          <EyeOutlined />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!loading && !error && totalItems > 0 && (
              <div className="mgr-pagination">
                <span className="mgr-pagination-summary">
                  Hiển thị <strong>{history.length}</strong> trên tổng số{' '}
                  <strong>{totalItems}</strong> kết quả
                </span>
                {totalPages > 1 && (
                  <nav className="mgr-pagination-buttons" aria-label="Phân trang lịch sử đánh giá">
                    <button
                      className="mgr-pg-btn"
                      disabled={page === 0}
                      onClick={() => goToPage(Math.max(page - 1, 0))}
                      type="button"
                    >
                      Trước
                    </button>
                    {visiblePages.map((pageNumber) => (
                      <button
                        aria-current={currentPageNumber === pageNumber ? 'page' : undefined}
                        className={`mgr-pg-btn ${currentPageNumber === pageNumber ? 'active' : ''}`}
                        key={pageNumber}
                        onClick={() => goToPage(pageNumber - 1)}
                        type="button"
                      >
                        {pageNumber}
                      </button>
                    ))}
                    <button
                      className="mgr-pg-btn"
                      disabled={currentPageNumber >= totalPages}
                      onClick={() => goToPage(page + 1)}
                      type="button"
                    >
                      Sau
                    </button>
                  </nav>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerEvaluationHistoryPage
