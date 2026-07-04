import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined, PrinterOutlined, LoadingOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import { staffApi } from '../../api/staffApi.js'
import '../../styles/ManagerPages.css'

function formatScore(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return '---'
  }

  const positiveValue = Math.max(numberValue, 0)
  const roundedValue = Math.abs(positiveValue) < 0.00005 ? 0 : positiveValue
  return roundedValue.toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

function ManagerEvaluationHistoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [evaluation, setEvaluation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    staffApi.getFormSubmission(id)
      .then(res => {
        setEvaluation(res.data?.data)
        setLoading(false)
      })
      .catch(err => {
        console.error("Error loading evaluation details", err)
        setError("Không thể tải chi tiết kết quả đánh giá.")
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar />
        <div className="dashboard-layout__content">
          <Header title="Lịch sử đánh giá" />
          <div className="dashboard-layout__body" style={{ textAlign: 'center', padding: 100 }}>
            <LoadingOutlined style={{ fontSize: 32, color: '#2563eb' }} />
            <p style={{ marginTop: 12, color: '#6b7280' }}>Đang tải chi tiết kết quả đánh giá...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !evaluation) {
    return (
      <div className="dashboard-layout">
        <Sidebar />
        <div className="dashboard-layout__content">
          <Header title="Lịch sử đánh giá" />
          <div className="dashboard-layout__body" style={{ textAlign: 'center', padding: 100 }}>
            <p style={{ color: '#ef4444', fontWeight: 600 }}>{error || 'Không tìm thấy chi tiết kết quả đánh giá.'}</p>
            <button className="training-button" onClick={() => navigate('/manager/quality/history')} style={{ marginTop: 12 }}>
              <ArrowLeftOutlined /> Quay lại danh sách
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isPassed = evaluation.result === 'PASSED'
  const resultText = evaluation.result === 'PASSED' ? 'Đạt' : (evaluation.result === 'FAILED_SCORE' ? 'Không đạt điểm' : 'Không đạt tiêu chí trọng yếu')
  const badgeColor = isPassed ? 'green' : 'red'

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
                {evaluation.title}
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
              <div className="mgr-avatar" style={{ 
                background: isPassed ? 'var(--mgr-green-bg)' : 'var(--mgr-red-bg)', 
                color: isPassed ? 'var(--mgr-green)' : 'var(--mgr-red)' 
              }}>
                {formatScore(evaluation.convertedScore)}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {evaluation.subject?.fullName} ({evaluation.subject?.employeeCode})
                </div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                  Người đánh giá: Trưởng khoa · Ngày thực hiện: {evaluation.submittedAt ? new Date(evaluation.submittedAt).toLocaleDateString('vi-VN') : new Date(evaluation.updatedAt).toLocaleDateString('vi-VN')}
                </div>
              </div>
              <span className={`mgr-badge mgr-badge--${badgeColor}`} style={{ marginLeft: 'auto', fontSize: 13, padding: '6px 14px' }}>
                Xếp loại: {resultText}
              </span>
            </div>

            {/* Answer details list */}
            <div className="mgr-eval-section" style={{ background: '#fff', border: 'none', padding: 0 }}>
              <div className="mgr-eval-section-title" style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
                Chi tiết câu trả lời kiểm tra
              </div>
              
              {(evaluation.scoreBreakdown || []).map((ans) => {
                const answeredOk = ans.weightedScore > 0
                return (
                  <div key={ans.questionKey} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    border: '1px solid #f1f5f9',
                    borderRadius: 8,
                    marginBottom: 10,
                    background: answeredOk ? '#fff' : '#fff5f5'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                        {ans.code ? `${ans.code}. ` : ''}{ans.title} 
                        {ans.critical && (
                          <span className="mgr-badge mgr-badge--red" style={{ padding: '2px 6px', fontSize: 9, marginLeft: 6 }}>
                            Trọng tâm
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span className={`mgr-badge mgr-badge--${answeredOk ? 'green' : 'red'}`} style={{ fontSize: 12, fontWeight: 700 }}>
                        {answeredOk ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', minWidth: 50, textAlign: 'right' }}>
                        {formatScore(ans.weightedScore)} / {formatScore(ans.maxScore)} điểm
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerEvaluationHistoryDetailPage
