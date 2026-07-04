import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  PrinterOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AdminHeader from '../components/AdminHeader'
import AdminSidebar from '../components/AdminSidebar'
import { adminApi } from '../api/adminApi'
import { getChecklistDisplayCode } from '../utils/formCode.js'
import '../styles/AdminQualityHistoryPage.css'

function unwrapData(response) {
  return response?.data?.data ?? null
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

function formatScore(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return '--'
  const positiveValue = Math.max(numberValue, 0)
  const roundedValue = Math.abs(positiveValue) < 0.00005 ? 0 : positiveValue
  return roundedValue.toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

function getResultLabel(result) {
  switch (result) {
    case 'PASSED':
      return 'Đạt'
    case 'FAILED_SCORE':
      return 'Không đạt điểm'
    case 'FAILED_CRITICAL':
      return 'Không đạt tiêu chí trọng yếu'
    default:
      return 'Chưa tính điểm'
  }
}

function getResultClass(result) {
  return result === 'PASSED' ? 'success' : 'danger'
}

function getDetailErrorMessage(error) {
  const backendMessage = error?.response?.data?.message
  if (backendMessage) return backendMessage
  return 'Không thể tải chi tiết kết quả đánh giá.'
}

function AdminQualityHistoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [submission, setSubmission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let alive = true

    adminApi.getFormSubmission(id)
      .then((response) => {
        if (!alive) return
        setSubmission(unwrapData(response))
      })
      .catch((error) => {
        if (!alive) return
        setErrorMessage(getDetailErrorMessage(error))
        setSubmission(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [id])

  const scoreBreakdown = useMemo(() => (
    Array.isArray(submission?.scoreBreakdown) ? submission.scoreBreakdown : []
  ), [submission])

  const resultClass = getResultClass(submission?.result)

  return (
    <div className="dashboard-layout admin-quality-history-page">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader
          breadcrumbs={[
            { label: 'Chất lượng' },
            { label: 'Lịch sử đánh giá', link: '/admin/quality/history' },
            { label: 'Chi tiết kết quả' },
          ]}
        />

        <main className="admin-quality-history admin-quality-history--detail">
          <button
            type="button"
            className="admin-quality-history__back"
            onClick={() => navigate('/admin/quality/history')}
          >
            <ArrowLeftOutlined />
            Quay lại lịch sử đánh giá
          </button>

          {loading ? (
            <div className="admin-quality-history__detail-state">
              <LoadingOutlined />
              <span>Đang tải chi tiết kết quả...</span>
            </div>
          ) : errorMessage || !submission ? (
            <div className="admin-quality-history__detail-state admin-quality-history__detail-state--error">
              <WarningOutlined />
              <span>{errorMessage || 'Không tìm thấy kết quả đánh giá.'}</span>
            </div>
          ) : (
            <>
              <section className="admin-quality-history__detail-hero">
                <div>
                  <span className="admin-quality-history__eyebrow">Kết quả checklist</span>
                  <h1>{submission.title || 'Checklist chưa có tiêu đề'}</h1>
                  <p>
                    {getChecklistDisplayCode(submission.formCode)}
                    {submission.versionNumber ? ` · Phiên bản ${submission.versionNumber}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="admin-quality-history__refresh"
                  onClick={() => window.print()}
                >
                  <PrinterOutlined />
                  In kết quả
                </button>
              </section>

              <section className="admin-quality-history__summary">
                <article className="admin-quality-history__summary-card">
                  <span>Nhân viên được đánh giá</span>
                  <strong>{submission.subject?.fullName || 'Chưa có tên'}</strong>
                  <small>{submission.subject?.employeeCode || 'Chưa có mã nhân viên'}</small>
                </article>
                <article className="admin-quality-history__summary-card">
                  <span>Ngày manager nộp</span>
                  <strong>{formatDateTime(submission.submittedAt || submission.updatedAt)}</strong>
                  <small>Trạng thái: {submission.status || 'SUBMITTED'}</small>
                </article>
                <article className="admin-quality-history__summary-card">
                  <span>Điểm quy đổi</span>
                  <strong>{formatScore(submission.convertedScore)}</strong>
                  <small>
                    Điểm thô: {formatScore(submission.rawScore)}
                  </small>
                </article>
                <article className={`admin-quality-history__summary-card admin-quality-history__summary-card--${resultClass}`}>
                  <span>Kết quả</span>
                  <strong>{getResultLabel(submission.result)}</strong>
                  <small>{submission.result || 'Chưa có mã kết quả'}</small>
                </article>
              </section>

              <section className="admin-quality-history__detail-card">
                <div className="admin-quality-history__detail-card-header">
                  <div>
                    <h2>Chi tiết điểm theo tiêu chí</h2>
                    <p>Admin dùng phần này để kiểm tra các câu manager đã đánh giá.</p>
                  </div>
                  <span>{scoreBreakdown.length} tiêu chí</span>
                </div>

                {scoreBreakdown.length === 0 ? (
                  <div className="admin-quality-history__state">
                    <CheckCircleOutlined />
                    <span>Backend chưa trả về chi tiết điểm cho phiếu này.</span>
                  </div>
                ) : (
                  <div className="admin-quality-history__breakdown-list">
                    {scoreBreakdown.map((item, index) => {
                      const weightedScore = Number(item.weightedScore)
                      const maxScore = Number(item.maxScore)
                      const isPassed = Number.isFinite(weightedScore)
                        && Number.isFinite(maxScore)
                        && weightedScore >= maxScore

                      return (
                        <article
                          key={item.questionKey || item.code || index}
                          className="admin-quality-history__breakdown-item"
                        >
                          <div className="admin-quality-history__breakdown-index">
                            {index + 1}
                          </div>
                          <div className="admin-quality-history__breakdown-body">
                            <div className="admin-quality-history__breakdown-title">
                              <strong>{item.title || item.code || `Tiêu chí ${index + 1}`}</strong>
                              {item.critical && <span>Trọng yếu</span>}
                            </div>
                            {item.code && <small>{item.code}</small>}
                          </div>
                          <div className="admin-quality-history__breakdown-score">
                            <span className={`admin-quality-history__badge admin-quality-history__badge--${isPassed ? 'success' : 'danger'}`}>
                              {isPassed ? 'Đạt' : 'Cần xem lại'}
                            </span>
                            <strong>
                              {formatScore(item.weightedScore)} / {formatScore(item.maxScore)}
                            </strong>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default AdminQualityHistoryDetailPage
