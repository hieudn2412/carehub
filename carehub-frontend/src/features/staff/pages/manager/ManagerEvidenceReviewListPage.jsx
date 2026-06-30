import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchOutlined, CheckCircleOutlined, EyeOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import '../../styles/ManagerPages.css'

function ManagerEvidenceReviewListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const [evidences] = useState([
    { id: 1, employeeId: 'NV-001', employeeName: 'Nguyễn Văn An', title: 'Chứng chỉ Kiểm soát nhiễm khuẩn 2026', hours: 8, date: '20/06/2026', filename: 'ksnk_cert_2026.pdf', size: '1.2MB' },
    { id: 2, employeeId: 'NV-002', employeeName: 'Trần Thị Bích', title: 'Chứng chỉ Tiêm truyền an toàn', hours: 4, date: '18/06/2026', filename: 'tiem_truyen_safe.png', size: '850KB' },
    { id: 3, employeeId: 'NV-005', employeeName: 'Hoàng Minh Đức', title: 'Hội thảo ICU Cấp cứu nâng cao', hours: 6, date: '15/06/2026', filename: 'icu_emergency_ws.pdf', size: '2.4MB' },
    { id: 4, employeeId: 'NV-002', employeeName: 'Trần Thị Bích', title: 'Chứng chỉ Chăm sóc vết thương ngoại khoa', hours: 8, date: '10/06/2026', filename: 'wound_dressing.pdf', size: '1.8MB' },
    { id: 5, employeeId: 'NV-001', employeeName: 'Nguyễn Văn An', title: 'Nghiên cứu khoa học Điều dưỡng Q1', hours: 16, date: '05/06/2026', filename: 'research_q1_vn.pdf', size: '3.1MB' },
  ])

  const filteredEvidences = evidences.filter(ev => 
    ev.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    ev.employeeId.toLowerCase().includes(search.toLowerCase()) ||
    ev.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Duyệt minh chứng" />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Duyệt minh chứng</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              Xem xét và phê duyệt các tệp chứng chỉ/minh chứng CME do điều dưỡng tự khai báo
            </p>
          </div>

          {/* Toolbar */}
          <div className="mgr-toolbar">
            <div className="mgr-search-box">
              <input 
                type="text" 
                placeholder="Tìm theo tên nhân viên, tên khóa học..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <SearchOutlined />
            </div>
          </div>

          {/* List Card */}
          <div className="mgr-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="mgr-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Tên khóa đào tạo / Hội thảo</th>
                  <th>Số giờ khai báo</th>
                  <th>Ngày nộp</th>
                  <th>Tên file đính kèm</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvidences.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{ev.employeeName}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>{ev.employeeId}</div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{ev.title}</td>
                    <td><strong style={{ color: '#2563eb' }}>{ev.hours}h</strong></td>
                    <td style={{ color: '#475569' }}>{ev.date}</td>
                    <td style={{ color: '#64748b', fontSize: 12.5 }}>
                      📄 {ev.filename} <span style={{ color: '#94a3b8' }}>({ev.size})</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => navigate(`/manager/evidence-review/${ev.id}`)}
                        style={{
                          border: '1px solid #e2e8f0',
                          background: '#fff',
                          padding: '6px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          color: '#475569',
                          transition: 'all 0.15s'
                        }}
                        title="Xem chi tiết & Phê duyệt"
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

export default ManagerEvidenceReviewListPage
