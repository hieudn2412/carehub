import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchOutlined, EyeOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import '../../styles/ManagerPages.css'

function ManagerEvaluationHistoryPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const [history] = useState([
    { id: 1, form: 'Bảng kiểm tuân thủ vệ sinh tay', employee: 'Phạm Quốc Bảo', employeeId: 'NV-00055', evaluator: 'Trần Văn Hùng', date: '02/06/2026', score: '95%', result: 'Đạt', color: 'green' },
    { id: 2, form: 'Bảng kiểm quy trình tiêm truyền tĩnh mạch', employee: 'Hoàng Minh Đức', employeeId: 'NV-00315', evaluator: 'Trần Văn Hùng', date: '01/06/2026', score: '72%', result: 'Không đạt', color: 'red' },
    { id: 3, form: 'Bảng kiểm phòng ngừa viêm phổi thở máy (VAP)', employee: 'Lê Thị Mai', employeeId: 'NV-00201', evaluator: 'Đặng Thị Hoa', date: '30/05/2026', score: '88%', result: 'Đạt', color: 'green' },
    { id: 4, form: 'Bảng kiểm tuân thủ vệ sinh tay', employee: 'Hoàng Minh Đức', employeeId: 'NV-00315', evaluator: 'Trần Văn Hùng', date: '28/05/2026', score: '60%', result: 'Không đạt', color: 'red' },
  ])

  const filteredHistory = history.filter(item => 
    item.form.toLowerCase().includes(search.toLowerCase()) ||
    item.employee.toLowerCase().includes(search.toLowerCase()) ||
    item.employeeId.toLowerCase().includes(search.toLowerCase())
  )

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
            <table className="mgr-table">
              <thead>
                <tr>
                  <th>Tên bảng kiểm</th>
                  <th>Nhân viên được đánh giá</th>
                  <th>Người đánh giá (Trưởng khoa)</th>
                  <th>Ngày đánh giá</th>
                  <th>Điểm số đạt</th>
                  <th>Xếp loại kết quả</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.form}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{item.employee}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{item.employeeId}</div>
                    </td>
                    <td>{item.evaluator}</td>
                    <td style={{ color: '#475569' }}>{item.date}</td>
                    <td>
                      <strong style={{ 
                        color: item.color === 'green' ? 'var(--mgr-green)' : 'var(--mgr-red)',
                        fontSize: 14
                      }}>
                        {item.score}
                      </strong>
                    </td>
                    <td>
                      <span className={`mgr-badge mgr-badge--${item.color}`}>{item.result}</span>
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerEvaluationHistoryPage
