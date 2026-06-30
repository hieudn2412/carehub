import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchOutlined, EyeOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import '../../styles/ManagerPages.css'

function ManagerEmployeeListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const [employees] = useState([
    { id: 'NV-001', name: 'Nguyễn Văn An', title: 'Điều dưỡng hạng III', dept: 'Khoa Nội tổng hợp', hours: 106, status: 'Đang theo dõi', color: 'amber' },
    { id: 'NV-002', name: 'Trần Thị Bích', title: 'Điều dưỡng hạng II', dept: 'Khoa Nội tổng hợp', hours: 88, status: 'Chưa đạt', color: 'red' },
    { id: 'NV-003', name: 'Lê Văn Cường', title: 'Điều dưỡng hạng III', dept: 'Khoa Nội tổng hợp', hours: 120, status: 'Đạt', color: 'green' },
    { id: 'NV-004', name: 'Phạm Thị Dung', title: 'Điều dưỡng hạng I', dept: 'Khoa Nội tổng hợp', hours: 132, status: 'Đạt', color: 'green' },
    { id: 'NV-005', name: 'Hoàng Minh Đức', title: 'Hộ sinh hạng II', dept: 'Khoa Nội tổng hợp', hours: 72, status: 'Chưa đạt', color: 'red' },
  ])

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) || emp.id.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'MET' && emp.status === 'Đạt') ||
      (statusFilter === 'NOT_MET' && emp.status === 'Chưa đạt') ||
      (statusFilter === 'PENDING' && emp.status === 'Đang theo dõi')
    return matchesSearch && matchesStatus
  })

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Nhân sự trong khoa" />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Nhân sự trong khoa</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              Danh sách và trạng thái đào tạo CME của điều dưỡng Khoa Nội tổng hợp
            </p>
          </div>

          {/* Toolbar */}
          <div className="mgr-toolbar">
            <div className="mgr-search-box">
              <input 
                type="text" 
                placeholder="Tìm nhân sự theo tên, mã NV..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <SearchOutlined />
            </div>
            
            <div className="mgr-filter-group">
              <select 
                className="mgr-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="MET">Đạt</option>
                <option value="NOT_MET">Chưa đạt</option>
                <option value="PENDING">Đang theo dõi</option>
              </select>
            </div>
          </div>

          {/* Table Card */}
          <div className="mgr-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="mgr-table">
              <thead>
                <tr>
                  <th>Mã NV</th>
                  <th>Họ và tên</th>
                  <th>Chức danh</th>
                  <th>Khoa / Phòng</th>
                  <th>Giờ đào tạo</th>
                  <th>Trạng thái</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td style={{ color: '#64748b', fontWeight: 600 }}>{emp.id}</td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{emp.name}</td>
                    <td>{emp.title}</td>
                    <td>{emp.dept}</td>
                    <td>
                      <strong style={{ 
                        color: emp.color === 'green' ? 'var(--mgr-green)' : emp.color === 'red' ? 'var(--mgr-red)' : 'var(--mgr-amber)',
                        fontSize: 14
                      }}>
                        {emp.hours}h
                      </strong>
                    </td>
                    <td>
                      <span className={`mgr-badge mgr-badge--${emp.color}`}>{emp.status}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => navigate(`/manager/employees/${emp.id}`)}
                        style={{
                          border: '1px solid #e2e8f0',
                          background: '#fff',
                          padding: '6px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          color: '#475569',
                          transition: 'all 0.15s'
                        }}
                        title="Xem chi tiết"
                        className="mgr-view-btn"
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

export default ManagerEmployeeListPage
