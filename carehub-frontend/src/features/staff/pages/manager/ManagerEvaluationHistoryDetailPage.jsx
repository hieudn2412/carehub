import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import '../../styles/ManagerPages.css'

function ManagerEvaluationHistoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [evaluation] = useState({
    id: id || 1,
    formName: 'Bảng kiểm tuân thủ vệ sinh tay',
    employeeName: 'Phạm Quốc Bảo',
    employeeId: 'NV-00055',
    evaluatorName: 'Trần Văn Hùng',
    date: '02/06/2026',
    score: '95%',
    result: 'Đạt',
    badgeColor: 'green',
    remarks: 'Nhân viên thực hiện quy trình vệ sinh tay nhanh chóng, tuân thủ đúng 6 bước chà sát tay vô trùng và lau khô đúng quy trình. Cần tiếp tục duy trì.',
    answers: [
      { id: 'q1', text: '1. Thực hiện vệ sinh tay trước khi tiếp xúc với bệnh nhân.', answered: 'YES', points: 1 },
      { id: 'q2', text: '2. Thực hiện vệ sinh tay trước khi làm thủ thuật vô trùng.', answered: 'YES', points: 1 },
      { id: 'q3', text: '3. Thực hiện vệ sinh tay sau khi tiếp xúc với máu, dịch tiết sinh học.', answered: 'YES', points: 1, isCritical: true },
      { id: 'q4', text: '4. Thực hiện vệ sinh tay sau khi tiếp xúc với bệnh nhân.', answered: 'YES', points: 1 },
      { id: 'q5', text: '5. Thực hiện vệ sinh tay sau khi chạm vào đồ vật xung quanh bệnh nhân.', answered: 'YES', points: 1 },
      { id: 'q6', text: '6. Tuân thủ chà tay đúng đủ 6 bước quy định.', answered: 'YES', points: 1 },
      { id: 'q7', text: '7. Đảm bảo thời gian chà sát tay tối thiểu 30 giây.', answered: 'NO', points: 0 },
      { id: 'q8', text: '8. Làm khô tay bằng khăn lau sạch dùng một lần hoặc máy sấy.', answered: 'YES', points: 1 },
    ]
  })

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header breadcrumbs={[
          { label: 'Lịch sử đánh giá', link: '/manager/quality/history' },
          { label: 'Chi tiết kết quả' }
        ]} />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <button 
                onClick={() => navigate('/manager/quality/history')}
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
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Kết quả đánh giá bảng kiểm</h1>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
                {evaluation.formName}
              </p>
            </div>
            
            <button 
              onClick={() => showToast("Đang chuẩn bị in bảng kiểm...", "success")}
              className="training-button"
              style={{ height: 38, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <PrinterOutlined /> In kết quả đánh giá
            </button>
          </div>

          <div className="mgr-card">
            {/* Header info */}
            <div className="mgr-detail-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 20 }}>
              <div className="mgr-avatar" style={{ background: 'var(--mgr-green-bg)', color: 'var(--mgr-green)' }}>
                {evaluation.score}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{evaluation.employeeName} ({evaluation.employeeId})</div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                  Người đánh giá: {evaluation.evaluatorName} · Ngày thực hiện: {evaluation.date}
                </div>
              </div>
              <span className={`mgr-badge mgr-badge--${evaluation.badgeColor}`} style={{ marginLeft: 'auto', fontSize: 13, padding: '6px 14px' }}>
                Xếp loại: {evaluation.result}
              </span>
            </div>

            {/* Answer details list */}
            <div className="mgr-eval-section" style={{ background: '#fff', border: 'none', padding: 0 }}>
              <div className="mgr-eval-section-title" style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
                Chi tiết câu trả lời kiểm tra
              </div>
              
              {evaluation.answers.map((ans, idx) => (
                <div key={ans.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 16px',
                  border: '1px solid #f1f5f9',
                  borderRadius: 8,
                  marginBottom: 10,
                  background: ans.answered === 'YES' ? '#fff' : '#fff5f5'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                      {ans.text} {ans.isCritical && <span className="mgr-badge mgr-badge--red" style={{ padding: '2px 6px', fontSize: 9, marginLeft: 6 }}>Trọng tâm</span>}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span className={`mgr-badge mgr-badge--${ans.answered === 'YES' ? 'green' : 'red'}`} style={{ fontSize: 12, fontWeight: 700 }}>
                      {ans.answered === 'YES' ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', minWidth: 50, textAlign: 'right' }}>
                      {ans.points} / 1 điểm
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Remarks content */}
            {evaluation.remarks && (
              <div style={{ marginTop: 24, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  Ý kiến đóng góp / Ghi chú giám sát
                </div>
                <div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.5 }}>
                  {evaluation.remarks}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerEvaluationHistoryDetailPage
