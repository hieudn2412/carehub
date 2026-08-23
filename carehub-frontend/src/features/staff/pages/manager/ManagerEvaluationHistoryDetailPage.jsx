import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { PrinterOutlined, LoadingOutlined, WarningOutlined } from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import { staffApi } from '../../api/staffApi.js'
import { getChecklistDisplayCode } from '../../../admin/utils/formCode.js'
import '../../../admin/styles/AdminQualityHistoryPage.css'
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

function formatDateTime(value) {
  if (!value) return 'Chưa có'
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function getResultLabel(result) {
  if (result === 'PASSED') return 'Đạt'
  if (result === 'FAILED_SCORE') return 'Chưa đạt điểm'
  if (result === 'FAILED_CRITICAL') return 'Không đạt câu trọng yếu'
  return 'Chưa tính điểm'
}

function getResultClass(result) {
  return result === 'PASSED' ? 'success' : 'danger'
}

function formatAnswer(answer) {
  const value = answer?.value || {}
  if (Array.isArray(value.labels) && value.labels.length > 0) return value.labels.join(', ')
  if (value.label) return String(value.label)
  if (value.textValue) return String(value.textValue)
  if (value.numberValue !== undefined && value.numberValue !== null) return String(value.numberValue)
  if (value.dateValue) return String(value.dateValue)
  if (value.timeValue) return String(value.timeValue)
  if (Array.isArray(value.values) && value.values.length > 0) return value.values.join(', ')
  if (value.value !== undefined && value.value !== null) return String(value.value)
  return 'Chưa trả lời'
}

function ManagerEvaluationHistoryDetailPage({ historyPath = '/manager/quality/history' }) {
  const { id } = useParams()
  const [searchParams] = useSearchParams()

  const [evaluation, setEvaluation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const requestedReturnTo = searchParams.get('returnTo') || ''
  const isChecklistReport = historyPath.includes('checklist-dashboard') || requestedReturnTo.includes('checklist-dashboard')
  const safeReturnTo = requestedReturnTo.startsWith('/') ? requestedReturnTo : ''
  const fallbackVersionPath = evaluation?.formId && evaluation?.formVersionId
    ? `${historyPath}/results/forms/${evaluation.formId}/versions/${evaluation.formVersionId}`
    : historyPath
  const returnPath = safeReturnTo || fallbackVersionPath

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
      <AppShell back={{ to: returnPath || historyPath, label: 'Quay lại' }} title="Lịch sử đánh giá">
        <div style={{ textAlign: 'center', padding: 100 }}>
          <LoadingOutlined style={{ fontSize: 32, color: '#2563eb' }} />
          <p style={{ marginTop: 12, color: '#6b7280' }}>Đang tải chi tiết kết quả đánh giá...</p>
        </div>
      </AppShell>
    )
  }

  if (error || !evaluation) {
    return (
      <AppShell back={{ to: returnPath || historyPath, label: 'Quay lại' }} title="Lịch sử đánh giá">
        <div style={{ textAlign: 'center', padding: 100 }}>
          <p style={{ color: '#ef4444', fontWeight: 600 }}>{error || 'Không tìm thấy chi tiết kết quả đánh giá.'}</p>
        </div>
      </AppShell>
    )
  }

  const subjectName = evaluation.subject?.fullName || 'Chưa có tên'
  const subjectCode = evaluation.subject?.employeeCode || ''
  const subjectDept = evaluation.subject?.department || evaluation.subject?.departmentName || 'Chưa xác định khoa/phòng'
  const graderName = evaluation.submittedBy?.fullName || evaluation.submittedBy?.name || 'Chưa xác định'
  const graderCode = evaluation.submittedBy?.employeeCode || evaluation.submittedBy?.username || ''
  const formTitle = evaluation.formTitle || evaluation.title || 'Quy trình chưa có tiêu đề'
  const formCode = evaluation.formCode || ''
  const versionNum = evaluation.versionNumber || 1

  const breadcrumbs = isChecklistReport
    ? [
        { label: 'Giám sát tuân thủ' },
        { label: 'Tuân thủ theo kỹ thuật', link: historyPath },
        { label: 'Chi tiết kết quả' },
      ]
    : [
        { label: 'Giám sát tuân thủ' },
        { label: 'Lịch sử đánh giá', link: historyPath },
        { label: 'Chi tiết kết quả' },
      ]

  return (
    <AppShell
      className="admin-quality-history-page"
      back={{ to: returnPath, label: 'Quay lại' }}
      breadcrumbs={breadcrumbs}
    >
      <div className="admin-quality-history admin-quality-history--detail">
        <section className="admin-quality-history__detail-hero">
          <div>
            <span className="admin-quality-history__eyebrow">Chi tiết lượt đánh giá</span>
            <h1>{formTitle}</h1>
            <p>{getChecklistDisplayCode(formCode)} · Phiên bản v{versionNum}</p>
          </div>
          <button type="button" className="admin-quality-history__refresh" onClick={() => window.print()}>
            <PrinterOutlined /> In kết quả
          </button>
        </section>

        {evaluation.criticalFailure && (
          <section className="aqh-critical-alert" role="alert">
            <WarningOutlined />
            <div>
              <strong>Kết quả có lỗi câu trọng yếu</strong>
              <span>Một hoặc nhiều câu trọng yếu không đạt, cần được kiểm tra lại.</span>
            </div>
          </section>
        )}

        <section className="aqh-detail-summary-grid">
          <article>
            <span>Nhân viên được đánh giá</span>
            <strong style={{ color: '#00866b' }}>{subjectName}</strong>
            <small>{subjectCode ? `${subjectCode} · ` : ''}{subjectDept}</small>
          </article>
          <article>
            <span>Người thực hiện chấm</span>
            <strong>{graderName}</strong>
            <small>{graderCode}</small>
          </article>
          <article>
            <span>Thời gian nộp</span>
            <strong>{formatDateTime(evaluation.submittedAt || evaluation.updatedAt)}</strong>
            <small>Phiếu đã nộp</small>
          </article>
          <article>
            <span>Điểm</span>
            <strong>{formatScore(evaluation.convertedScore)}/10</strong>
            <small>Điểm sàn: {formatScore(evaluation.passingScore != null ? evaluation.passingScore : 6.67)}/10</small>
          </article>
          <article className={`aqh-detail-result aqh-detail-result--${getResultClass(evaluation.result)}`}>
            <span>Kết quả</span>
            <strong>{getResultLabel(evaluation.result)}</strong>
            <small>{evaluation.criticalFailure ? 'Có lỗi trọng yếu' : 'Không có lỗi trọng yếu'}</small>
          </article>
        </section>

        {/* Answer details list */}
        <div className="mgr-card" style={{ marginTop: 18, border: '1px solid #dfe7ef', borderRadius: 12, boxShadow: '0 12px 30px rgba(15, 23, 42, 0.05)' }}>
          <div className="mgr-eval-section" style={{ background: '#fff', border: 'none', padding: 0 }}>
            <div className="mgr-eval-section-title" style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#0f172a' }}>
              Chi tiết câu trả lời kiểm tra
            </div>

            {(evaluation.scoreBreakdown || []).map((ans) => {
              const answeredOk = ans.weightedScore > 0
              const selectedAnswer = (evaluation.answers || []).find(
                (item) => String(item.questionKey) === String(ans.questionKey),
              )
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
                      {ans.title}
                      {ans.critical && (
                        <span className="mgr-badge mgr-badge--red" style={{ padding: '2px 6px', fontSize: 9, marginLeft: 6 }}>
                          Trọng tâm
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      Kết quả: <strong style={{ color: '#334155' }}>{formatAnswer(selectedAnswer)}</strong>
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
    </AppShell>
  )
}

export default ManagerEvaluationHistoryDetailPage
