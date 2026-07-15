import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchOutlined, EyeOutlined, LoadingOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { examAssignmentApi } from '../../../../features/evaluation/api/examAssignmentApi'
import '../../styles/ManagerPages.css'

function ManagerExamResultsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    examAssignmentApi.listAssignments()
      .then(res => {
        const data = res.data?.data?.content || res.data?.data || []
        setAssignments(Array.isArray(data) ? data : [])
      })
      .catch(err => {
        console.error("Error fetching exam assignments", err)
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredResults = assignments.filter(item => {
    const title = (item.title || item.examTitle || '').toLowerCase()
    return title.includes(search.toLowerCase())
  })

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Kết quả thi nhân sự" />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Kết quả thi nhân sự</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              Theo dõi kết quả các kỳ thi năng lực của điều dưỡng trong khoa
            </p>
          </div>

          {/* Search toolbar */}
          <div className="mgr-toolbar">
            <div className="mgr-search-box">
              <input 
                type="text" 
                placeholder="Tìm theo tên nhân viên, tên bài thi..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <SearchOutlined />
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="mgr-card" style={{ textAlign: 'center', padding: 40 }}>
              <LoadingOutlined style={{ fontSize: 24, color: '#6b7280' }} />
              <p style={{ marginTop: 12, color: '#6b7280' }}>Đang tải dữ liệu...</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="mgr-card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: '#6b7280' }}>Không có kỳ thi nào.</p>
            </div>
          ) : (
          <div className="mgr-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="mgr-table">
              <thead>
                <tr>
                  <th>Tên kỳ thi</th>
                  <th>Ngày tạo</th>
                  <th>Trạng thái</th>
                  <th>Hạn nộp</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.title || item.examTitle || `Kỳ thi #${item.id}`}</td>
                    <td style={{ color: '#475569' }}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '--'}
                    </td>
                    <td>
                      <span className={`mgr-badge mgr-badge--${item.status === 'OPEN' ? 'green' : item.status === 'CLOSED' ? 'red' : 'amber'}`}>
                        {item.status === 'OPEN' ? 'Đang mở' : item.status === 'CLOSED' ? 'Đã đóng' : item.status || '--'}
                      </span>
                    </td>
                    <td style={{ color: '#475569' }}>
                      {item.dueDate ? new Date(item.dueDate).toLocaleDateString('vi-VN') : '--'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => navigate(`/manager/exam-results/detail/${item.id}`)}
                        style={{
                          border: '1px solid #e2e8f0',
                          background: '#fff',
                          padding: '6px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          color: '#475569',
                          transition: 'all 0.15s'
                        }}
                        title="Xem kết quả"
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
          </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ManagerExamResultsPage
