import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchOutlined, EyeOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import '../../styles/ManagerPages.css'

function ManagerExamResultsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const [examResults] = useState([
    { id: 1, employeeId: 'NV-001', employeeName: 'Nguyễn Văn An', examTitle: 'Kiểm tra Kỹ năng điều dưỡng cơ bản Q2', date: '02/06/2026', score: 76, result: 'Đạt', color: 'green' },
    { id: 2, employeeId: 'NV-002', employeeName: 'Trần Thị Bích', examTitle: 'Đánh giá Kiểm soát nhiễm khuẩn định kỳ', date: '01/06/2026', score: 85, result: 'Đạt', color: 'green' },
    { id: 3, employeeId: 'NV-003', employeeName: 'Lê Văn Cường', examTitle: 'Tập huấn Cấp cứu ngừng tuần hoàn cơ bản', date: '28/05/2026', score: 52, result: 'Chưa đạt', color: 'red' },
    { id: 5, employeeId: 'NV-005', employeeName: 'Hoàng Minh Đức', examTitle: 'Đánh giá Kiểm soát nhiễm khuẩn định kỳ', date: '25/05/2026', score: 40, result: 'Chưa đạt', color: 'red' },
  ])

  const filteredResults = examResults.filter(item => 
    item.examTitle.toLowerCase().includes(search.toLowerCase()) ||
    item.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    item.employeeId.toLowerCase().includes(search.toLowerCase())
  )

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

          {/* Table Card */}
          <div className="mgr-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="mgr-table">
              <thead>
                <tr>
                  <th>Tên bài thi</th>
                  <th>Nhân viên thực hiện</th>
                  <th>Ngày hoàn thành</th>
                  <th>Điểm thi</th>
                  <th>Kết quả xếp loại</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.examTitle}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{item.employeeName}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{item.employeeId}</div>
                    </td>
                    <td style={{ color: '#475569' }}>{item.date}</td>
                    <td>
                      <strong style={{ 
                        color: item.color === 'green' ? 'var(--mgr-green)' : 'var(--mgr-red)',
                        fontSize: 14
                      }}>
                        {item.score}%
                      </strong>
                    </td>
                    <td>
                      <span className={`mgr-badge mgr-badge--${item.color}`}>{item.result}</span>
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
                        title="Xem chi tiết bài làm"
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
        </div>
      </div>
    </div>
  )
}

export default ManagerExamResultsPage
