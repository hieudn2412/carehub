import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchOutlined, EyeOutlined, LoadingOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { staffApi } from '../../api/staffApi.js'
import '../../styles/ManagerPages.css'

function ManagerEvaluationHistoryPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    staffApi.getFormSubmissions({ size: 100 })
      .then(res => {
        // Lọc ra các phiếu đã nộp chính thức (SUBMITTED)
        const submissions = res.data?.data?.content || []
        const submittedOnly = submissions.filter(item => item.status === 'SUBMITTED')
        setHistory(submittedOnly)
        setLoading(false)
      })
      .catch(err => {
        console.error("Error loading evaluation history", err)
        setError("Không thể tải lịch sử đánh giá.")
        setLoading(false)
      })
  }, [])

  const filteredHistory = history.filter(item => 
    (item.title || '').toLowerCase().includes(search.toLowerCase()) ||
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
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.title}</td>
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
                          {item.convertedScore !== null ? Number(item.convertedScore).toFixed(0) : '---'}
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerEvaluationHistoryPage
