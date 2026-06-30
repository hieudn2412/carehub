import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchOutlined, PlayCircleOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import '../../styles/ManagerPages.css'

function ManagerChecklistListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const [checklists] = useState([
    { id: 1, name: 'Bảng kiểm tuân thủ vệ sinh tay', type: 'Quy trình kiểm tra', dept: 'Toàn bộ bệnh viện', criteria: 8, status: 'Active', color: 'green' },
    { id: 2, name: 'Bảng kiểm quy trình tiêm truyền tĩnh mạch', type: 'Quy trình kiểm tra', dept: 'Toàn bộ bệnh viện', criteria: 12, status: 'Active', color: 'green' },
    { id: 3, name: 'Bảng kiểm phòng ngừa viêm phổi thở máy (VAP)', type: 'Gói chăm sóc (Care bundle)', dept: 'Khoa Hồi sức tích cực (ICU)', criteria: 14, status: 'Active', color: 'green' },
    { id: 4, name: 'Bảng kiểm chuyển viện an toàn', type: 'Quy trình kiểm tra', dept: 'Toàn bộ bệnh viện', criteria: 7, status: 'Active', color: 'green' },
  ])

  const filteredChecklists = checklists.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.type.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Bảng kiểm chất lượng" />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Bảng kiểm giám sát</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              Danh sách các biểu mẫu bảng kiểm chất lượng được phân bổ để thực hiện giám sát chuyên môn trong khoa
            </p>
          </div>

          {/* Toolbar */}
          <div className="mgr-toolbar">
            <div className="mgr-search-box">
              <input 
                type="text" 
                placeholder="Tìm bảng kiểm..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <SearchOutlined />
            </div>
          </div>

          {/* Grid of Checklists */}
          <div className="mgr-dashboard-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {filteredChecklists.map((c) => (
              <div key={c.id} className="mgr-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <span className="mgr-badge mgr-badge--blue" style={{ fontSize: 11 }}>{c.type}</span>
                    <span className="mgr-badge mgr-badge--green" style={{ fontSize: 11 }}>Đang áp dụng</span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8, lineHeight: 1.4 }}>
                    {c.name}
                  </h3>
                  <div style={{ fontSize: 13, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 6, margin: '14px 0 20px' }}>
                    <div>🏢 <strong>Đối tượng phân bổ:</strong> {c.dept}</div>
                    <div>📋 <strong>Số chỉ tiêu kiểm tra:</strong> {c.criteria} tiêu chí</div>
                  </div>
                </div>
                
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => navigate(`/manager/quality/checklists/${c.id}/evaluate`)}
                    className="training-button training-button--primary"
                    style={{ height: 36, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                  >
                    <PlayCircleOutlined /> Thực hiện đánh giá
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerChecklistListPage
