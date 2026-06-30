import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import '../../styles/ManagerPages.css'

function ManagerExamResultDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [examResult] = useState({
    id: id || 1,
    examTitle: 'Kiểm tra Kỹ năng điều dưỡng cơ bản Q2',
    employeeName: 'Nguyễn Văn An',
    employeeId: 'NV-001',
    date: '02/06/2026',
    score: 76,
    points: '7.6 / 10',
    result: 'Đạt',
    badgeColor: 'green',
    duration: '22 phút 15 giây',
    questions: [
      { id: 1, text: 'Câu 1: Các bước chuẩn bị dụng cụ tiêm dưới da đúng quy trình kỹ thuật?', selectedAnswer: 'A. Rửa tay, chuẩn bị thuốc, kiểm tra đối chiếu, sát khuẩn chuôi ống', correctAnswer: 'A. Rửa tay, chuẩn bị thuốc, kiểm tra đối chiếu, sát khuẩn chuôi ống', isCorrect: true },
      { id: 2, text: 'Câu 2: Khi phát hiện bệnh nhân bị sốc phản vệ, hành động xử trí đầu tiên cần thực hiện ngay lập tức là gì?', selectedAnswer: 'B. Ngừng ngay đường tiếp xúc với dị nguyên và tiêm bắp Adrenalin', correctAnswer: 'B. Ngừng ngay đường tiếp xúc với dị nguyên và tiêm bắp Adrenalin', isCorrect: true },
      { id: 3, text: 'Câu 3: Quy tắc 5 đúng trong dùng thuốc cho người bệnh không bao gồm tiêu chí nào?', selectedAnswer: 'C. Đúng tiền viện phí', correctAnswer: 'D. Đúng liều lượng chỉ định của bác sĩ điều trị', isCorrect: false },
      { id: 4, text: 'Câu 4: Thời gian sát khuẩn da tại vị trí tiêm bằng cồn 70 độ tối thiểu trước khi đâm kim là bao nhiêu?', selectedAnswer: 'A. 30 giây và để khô tự nhiên', correctAnswer: 'A. 30 giây và để khô tự nhiên', isCorrect: true },
    ]
  })

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header breadcrumbs={[
          { label: 'Kết quả thi nhân sự', link: '/manager/exam-results' },
          { label: 'Chi tiết bài làm' }
        ]} />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <button 
              onClick={() => navigate('/manager/exam-results')}
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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Chi tiết kết quả làm bài</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              {examResult.examTitle}
            </p>
          </div>

          <div className="mgr-card">
            {/* Header summary */}
            <div className="mgr-detail-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 20 }}>
              <div className="mgr-avatar" style={{ background: 'var(--mgr-blue-bg)', color: 'var(--mgr-blue)' }}>
                {examResult.score}%
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{examResult.employeeName} ({examResult.employeeId})</div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                  Ngày hoàn thành: {examResult.date} · Thời gian làm bài: {examResult.duration} · Điểm số: {examResult.points} điểm
                </div>
              </div>
              <span className={`mgr-badge mgr-badge--${examResult.badgeColor}`} style={{ marginLeft: 'auto', fontSize: 13, padding: '6px 14px' }}>
                Xếp loại: {examResult.result}
              </span>
            </div>

            {/* Questions detail */}
            <div style={{ marginTop: 20 }}>
              <div className="mgr-card-title" style={{ border: 'none', padding: 0, marginBottom: 16 }}>
                Chi tiết câu hỏi và đáp án làm bài
              </div>

              {examResult.questions.map((q) => (
                <div key={q.id} style={{
                  padding: 16,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  marginBottom: 16,
                  background: q.isCorrect ? '#fff' : '#fef2f2'
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    {q.isCorrect ? (
                      <CheckCircleOutlined style={{ color: '#10b981', fontSize: 18, marginTop: 2 }} />
                    ) : (
                      <CloseCircleOutlined style={{ color: '#ef4444', fontSize: 18, marginTop: 2 }} />
                    )}
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: '#1e293b', lineHeight: 1.4 }}>
                      {q.text}
                    </div>
                  </div>

                  <div style={{ marginLeft: 26, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 13, color: '#475569' }}>
                      <strong>Đáp án đã chọn:</strong>{' '}
                      <span style={{ color: q.isCorrect ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                        {q.selectedAnswer}
                      </span>
                    </div>

                    {!q.isCorrect && (
                      <div style={{ fontSize: 13, color: '#475569' }}>
                        <strong>Đáp án đúng:</strong>{' '}
                        <span style={{ color: '#10b981', fontWeight: 600 }}>
                          {q.correctAnswer}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerExamResultDetailPage
