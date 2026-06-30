import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import '../../styles/ManagerPages.css'

function ManagerChecklistEvaluationPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Mock checklist details based on ID
  const [checklist] = useState({
    id: id || 1,
    name: id === '2' ? 'Bảng kiểm quy trình tiêm truyền tĩnh mạch' : 'Bảng kiểm tuân thủ vệ sinh tay',
    type: 'Quy trình kiểm tra',
    dept: 'Toàn bộ bệnh viện',
    questions: [
      { id: 'q1', text: '1. Thực hiện vệ sinh tay trước khi tiếp xúc với bệnh nhân.', scoreValue: 1 },
      { id: 'q2', text: '2. Thực hiện vệ sinh tay trước khi làm thủ thuật vô trùng.', scoreValue: 1 },
      { id: 'q3', text: '3. Thực hiện vệ sinh tay sau khi tiếp xúc với máu, dịch tiết sinh học.', scoreValue: 1, isCritical: true },
      { id: 'q4', text: '4. Thực hiện vệ sinh tay sau khi tiếp xúc với bệnh nhân.', scoreValue: 1 },
      { id: 'q5', text: '5. Thực hiện vệ sinh tay sau khi chạm vào đồ vật xung quanh bệnh nhân.', scoreValue: 1 },
      { id: 'q6', text: '6. Tuân thủ chà tay đúng đủ 6 bước quy định.', scoreValue: 1 },
      { id: 'q7', text: '7. Đảm bảo thời gian chà sát tay tối thiểu 30 giây.', scoreValue: 1 },
      { id: 'q8', text: '8. Làm khô tay bằng khăn lau sạch dùng một lần hoặc máy sấy.', scoreValue: 1 },
    ]
  })

  // State to hold answers
  const [answers, setAnswers] = useState(
    checklist.questions.reduce((acc, q) => ({ ...acc, [q.id]: null }), {})
  )

  const handleSelectOption = (qId, val) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: val
    }))
  }

  const [employees] = useState([
    { code: 'NV-001', name: 'Nguyễn Văn An' },
    { code: 'NV-002', name: 'Trần Thị Bích' },
    { code: 'NV-003', name: 'Lê Văn Cường' },
    { code: 'NV-004', name: 'Phạm Thị Dung' },
    { code: 'NV-005', name: 'Hoàng Minh Đức' },
  ])

  const handleSubmit = (isDraft = false) => {
    if (!selectedEmployee) {
      showToast("Vui lòng lựa chọn nhân viên cần đánh giá.", "warning")
      return
    }

    const unanswered = Object.keys(answers).filter(k => answers[k] === null)
    if (!isDraft && unanswered.length > 0) {
      showToast("Vui lòng hoàn thành tất cả tiêu chí đánh giá.", "warning")
      return
    }

    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      if (isDraft) {
        showToast("Đã lưu bản nháp đánh giá thành công!", "success")
        navigate('/manager/quality/history')
      } else {
        // Calculate score
        const total = checklist.questions.length
        const scored = Object.values(answers).filter(v => v === 'YES').length
        const pct = Math.round((scored / total) * 100)
        showToast(`Đã nộp kết quả đánh giá! Xếp loại đạt: ${pct}%`, "success")
        navigate('/manager/quality/history')
      }
    }, 1000)
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header breadcrumbs={[
          { label: 'Bảng kiểm', link: '/manager/quality/checklists' },
          { label: 'Thực hiện đánh giá' }
        ]} />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <button 
              onClick={() => navigate('/manager/quality/checklists')}
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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Thực hiện đánh giá bảng kiểm</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              {checklist.name}
            </p>
          </div>

          <div className="mgr-card">
            {/* Step 1: Employee selection */}
            <div style={{ marginBottom: 24, borderBottom: '1px solid #f1f5f9', paddingBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                Chọn nhân sự được giám sát / đánh giá <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select 
                className="mgr-select"
                style={{ width: '100%', maxWidth: 400, height: 42, fontSize: 14 }}
                value={selectedEmployee}
                onChange={e => setSelectedEmployee(e.target.value)}
              >
                <option value="">-- Chọn nhân viên trong khoa --</option>
                {employees.map(emp => (
                  <option key={emp.code} value={emp.code}>
                    {emp.name} ({emp.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Evaluation Checklist questions */}
            <div className="mgr-eval-section">
              <div className="mgr-eval-section-title">Tiêu chí kiểm tra đánh giá</div>
              
              {checklist.questions.map((q) => (
                <div key={q.id} className="mgr-eval-question">
                  <div className="mgr-eval-question-text">
                    {q.text} {q.isCritical && <span className="mgr-badge mgr-badge--red" style={{ padding: '2px 6px', fontSize: 10 }}>Trọng tâm</span>}
                  </div>
                  
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => handleSelectOption(q.id, 'YES')}
                      className={`mgr-eval-option ${answers[q.id] === 'YES' ? 'mgr-eval-option--correct' : ''}`}
                      style={{ flex: 1, height: 38, justifyContent: 'center' }}
                    >
                      Đạt (Có)
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleSelectOption(q.id, 'NO')}
                      className={`mgr-eval-option ${answers[q.id] === 'NO' ? 'mgr-eval-option--selected' : ''}`}
                      style={{ flex: 1, height: 38, justifyContent: 'center' }}
                    >
                      Không đạt (Không)
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Remarks box */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                Ý kiến đóng góp / Ghi chú giám sát
              </label>
              <textarea 
                className="f-textarea"
                placeholder="Nhập các ý kiến đóng góp, nhận xét thêm về quy trình thực tế..."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                style={{ minHeight: 90 }}
              />
            </div>

            {/* Actions footer */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
              <button 
                onClick={() => navigate('/manager/quality/checklists')}
                className="training-button"
                style={{ height: 38, borderRadius: 8, fontSize: 13.5 }}
                disabled={submitting}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => handleSubmit(true)}
                className="training-button"
                style={{ height: 38, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}
                disabled={submitting}
              >
                <SaveOutlined /> Lưu bản nháp
              </button>
              <button 
                onClick={() => handleSubmit(false)}
                className="training-button training-button--primary"
                style={{ height: 38, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}
                disabled={submitting}
              >
                <SendOutlined /> Nộp kết quả
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerChecklistEvaluationPage
