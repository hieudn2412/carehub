import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined, BookOutlined, FileDoneOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import '../../styles/ManagerPages.css'

function ManagerEmployeeDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [employee] = useState({
    id: id || 'NV-001',
    name: 'Nguyễn Văn An',
    title: 'Điều dưỡng hạng III',
    dept: 'Khoa Nội tổng hợp',
    education: 'Cử nhân Điều dưỡng',
    entryDate: '15/03/2019',
    specialty: 'Nội khoa, Chăm sóc mãn tính',
    status: 'Đang làm việc',
    hours: 106,
    requiredHours: 120,
    examScore: 76,
    performance: 'Khá',
    badgeColor: 'amber'
  })

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header breadcrumbs={[
          { label: 'Nhân sự trong khoa', link: '/manager/employees' },
          { label: 'Chi tiết nhân sự' }
        ]} />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <button 
              onClick={() => navigate('/manager/employees')}
              style={{
                background: 'none',
                border: 'none',
                color: '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                fontWeight: 500,
                padding: '4px 0',
                marginBottom: 8
              }}
            >
              <ArrowLeftOutlined /> Quay lại danh sách
            </button>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Chi tiết nhân sự</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              Thông tin hồ sơ và hoạt động kiểm tra chuyên môn
            </p>
          </div>

          <div className="mgr-card">
            {/* Detail Head */}
            <div className="mgr-detail-header">
              <div className="mgr-avatar">NV</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{employee.name}</div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                  {employee.id} · {employee.dept} · {employee.title}
                </div>
              </div>
              <span className={`mgr-badge mgr-badge--${employee.badgeColor}`} style={{ marginLeft: 'auto' }}>
                Đang theo dõi
              </span>
            </div>

            {/* Information Grid */}
            <div className="mgr-kv-grid" style={{ marginBottom: 24 }}>
              <div className="mgr-kv-item">
                <span className="mgr-kv-label">Trình độ chuyên môn</span>
                <div className="mgr-kv-val">{employee.education}</div>
              </div>
              <div className="mgr-kv-item">
                <span className="mgr-kv-label">Ngày vào làm việc</span>
                <div className="mgr-kv-val">{employee.entryDate}</div>
              </div>
              <div className="mgr-kv-item">
                <span className="mgr-kv-label">Lĩnh vực chuyên môn</span>
                <div className="mgr-kv-val">{employee.specialty}</div>
              </div>
              <div className="mgr-kv-item">
                <span className="mgr-kv-label">Trạng thái công tác</span>
                <div className="mgr-kv-val">{employee.status}</div>
              </div>
            </div>

            {/* Metrics cards inside Detail */}
            <div className="mgr-card-title" style={{ border: 'none', margin: '24px 0 12px', padding: 0 }}>
              Tổng hợp hoạt động
            </div>
            <div className="mgr-dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
              <div className="mgr-metric-card" style={{ cursor: 'default' }}>
                <div className="mgr-metric-label">Giờ đào tạo tích lũy</div>
                <div className="mgr-metric-val" style={{ color: '#d97706' }}>{employee.hours}h</div>
                <div className="mgr-metric-sub">yêu cầu: {employee.requiredHours}h</div>
              </div>

              <div className="mgr-metric-card" style={{ cursor: 'default' }}>
                <div className="mgr-metric-label">Điểm thi chuyên môn</div>
                <div className="mgr-metric-val" style={{ color: '#10b981' }}>{employee.examScore}%</div>
                <div className="mgr-metric-sub">lần thi gần nhất</div>
              </div>

              <div className="mgr-metric-card" style={{ cursor: 'default' }}>
                <div className="mgr-metric-label">Xếp loại năng lực</div>
                <div className="mgr-metric-val" style={{ color: '#2563eb', fontSize: 26 }}>{employee.performance}</div>
                <div className="mgr-metric-sub">Đánh giá chu kỳ hiện tại</div>
              </div>
            </div>

            {/* Actions Footer */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
              <button 
                onClick={() => navigate(`/training/employees/${employee.id}`)}
                className="training-button"
                style={{ height: 38, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                <BookOutlined /> Hồ sơ đào tạo CME
              </button>
              <button 
                onClick={() => navigate(`/manager/exam-results/${employee.id}`)}
                className="training-button training-button--primary"
                style={{ height: 38, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              >
                <FileDoneOutlined /> Xem kết quả thi
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerEmployeeDetailPage
