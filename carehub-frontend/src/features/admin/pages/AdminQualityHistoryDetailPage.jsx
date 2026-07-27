import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  DownOutlined,
  LoadingOutlined,
  PrinterOutlined,
  ReloadOutlined,
  UpOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
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
  return numberValue.toLocaleString('vi-VN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
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

function getDetailErrorMessage(error) {
  return error?.response?.data?.message || 'Không thể tải chi tiết kết quả đánh giá.'
}

function getQuestionItems(section) {
  return Array.isArray(section?.items)
    ? [...section.items].sort((left, right) => Number(left.displayOrder) - Number(right.displayOrder))
    : []
}

function getAnswerDisplay(answer, question) {
  if (!answer) return 'Chưa trả lời'
  const selectedOption = question?.options?.find((option) => String(option.optionKey) === String(answer.optionKey))
  if (selectedOption) return selectedOption.label || selectedOption.value || 'Đã chọn'

  const value = answer.value || {}
  if (Array.isArray(value.labels)) return value.labels.join(', ')
  if (Array.isArray(value.values)) return value.values.join(', ')
  const simpleValue = value.textValue
    ?? value.numberValue
    ?? value.dateValue
    ?? value.timeValue
    ?? value.label
    ?? value.value
  if (simpleValue !== null && simpleValue !== undefined && simpleValue !== '') return String(simpleValue)
  return 'Chưa trả lời'
}

function getBackTarget(submission, returnTo) {
  if (!submission) return '/admin/quality/history'
  const expectedPath = `/admin/quality/history/forms/${submission.formId}/versions/${submission.formVersionId}`
  if (returnTo === expectedPath || returnTo?.startsWith(`${expectedPath}?`)) return returnTo
  return expectedPath
}

function AdminQualityHistoryDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const [submission, setSubmission] = useState(null)
  const [version, setVersion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [expandedSections, setExpandedSections] = useState(new Set())

  useEffect(() => {
    let alive = true

    adminApi.getFormSubmission(id)
      .then(async (response) => {
        const submissionData = unwrapData(response)
        if (!submissionData) throw new Error('Không tìm thấy kết quả đánh giá.')
        const versionResponse = await adminApi.getFormVersionById(
          submissionData.formId,
          submissionData.formVersionId,
        )
        if (!alive) return
        const versionData = unwrapData(versionResponse)
        setSubmission(submissionData)
        setVersion(versionData)
        setExpandedSections(new Set((versionData?.sections || []).map((section) => String(section.sectionKey || section.id))))
        setErrorMessage('')
      })
      .catch((error) => {
        if (!alive) return
        setErrorMessage(error?.response ? getDetailErrorMessage(error) : (error.message || getDetailErrorMessage(error)))
        setSubmission(null)
        setVersion(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [id, refreshKey])

  const answersByQuestion = useMemo(() => new Map(
    (submission?.answers || []).map((answer) => [String(answer.questionKey), answer]),
  ), [submission])
  const scoresByQuestion = useMemo(() => new Map(
    (submission?.scoreBreakdown || []).map((score) => [String(score.questionKey), score]),
  ), [submission])
  const sections = useMemo(() => (
    [...(version?.sections || [])].sort((left, right) => Number(left.displayOrder) - Number(right.displayOrder))
  ), [version])
  const totalQuestions = useMemo(() => sections.reduce((total, section) => (
    total + getQuestionItems(section).filter((item) => item.question).length
  ), 0), [sections])
  const returnTo = searchParams.get('returnTo') || ''
  const backTarget = getBackTarget(submission, returnTo)
  const allExpanded = sections.length > 0 && expandedSections.size === sections.length

  const toggleSection = (sectionKey) => {
    setExpandedSections((current) => {
      const next = new Set(current)
      if (next.has(sectionKey)) next.delete(sectionKey)
      else next.add(sectionKey)
      return next
    })
  }

  return (
    <AppShell
      className="admin-quality-history-page"
      back={{ label: 'Quay lại', onClick: () => navigate(backTarget) }}
      breadcrumbs={[
        { label: 'Chất lượng' },
        { label: 'Lịch sử đánh giá', link: '/admin/quality/history' },
        { label: 'Chi tiết kết quả' },
      ]}
    >
        <div className="admin-quality-history admin-quality-history--detail">
          {loading ? (
            <div className="admin-quality-history__detail-state"><LoadingOutlined spin /><span>Đang tải chi tiết kết quả...</span></div>
          ) : errorMessage || !submission || !version ? (
            <div className="admin-quality-history__detail-state admin-quality-history__detail-state--error">
              <WarningOutlined /><strong>Không thể tải chi tiết</strong><span>{errorMessage || 'Không tìm thấy kết quả đánh giá.'}</span>
              <button onClick={() => { setLoading(true); setErrorMessage(''); setRefreshKey((value) => value + 1) }} type="button"><ReloadOutlined /> Thử lại</button>
            </div>
          ) : (
            <>
              <section className="admin-quality-history__detail-hero">
                <div>
                  <span className="admin-quality-history__eyebrow">Chi tiết lượt đánh giá</span>
                  <h1>{submission.title || version.title || 'Quy trình chưa có tiêu đề'}</h1>
                  <p>{getChecklistDisplayCode(submission.formCode)} · Phiên bản v{submission.versionNumber}</p>
                </div>
                <button type="button" className="admin-quality-history__refresh" onClick={() => window.print()}><PrinterOutlined /> In kết quả</button>
              </section>

              {submission.criticalFailure && (
                <section className="aqh-critical-alert" role="alert">
                  <WarningOutlined />
                  <div><strong>Kết quả có lỗi câu trọng yếu</strong><span>Một hoặc nhiều câu trọng yếu không đạt, cần được kiểm tra lại.</span></div>
                </section>
              )}

              <section className="aqh-detail-summary-grid">
                <article><span>Nhân viên được đánh giá</span><strong>{submission.subject?.fullName || 'Chưa có tên'}</strong><small>{submission.subject?.employeeCode || 'Chưa có mã'} · {submission.subject?.department || 'Chưa xác định khoa/phòng'}</small></article>
                <article><span>Người thực hiện chấm</span><strong>{submission.submittedBy?.fullName || 'Chưa xác định'}</strong><small>{submission.submittedBy?.employeeCode || 'Chưa có mã nhân viên'}</small></article>
                <article><span>Thời gian nộp</span><strong>{formatDateTime(submission.submittedAt || submission.updatedAt)}</strong><small>Phiếu đã nộp</small></article>
                <article><span>Điểm</span><strong>{formatScore(submission.convertedScore)}/10</strong><small>Điểm sàn: {formatScore(version.passingScore ?? submission.passingScore)}/10</small></article>
                <article className={`aqh-detail-result aqh-detail-result--${getResultClass(submission.result)}`}><span>Kết quả</span><strong>{getResultLabel(submission.result)}</strong><small>{submission.criticalFailure ? 'Có lỗi trọng yếu' : 'Không có lỗi trọng yếu'}</small></article>
              </section>

              <section className="aqh-readonly-checklist">
                <header className="aqh-readonly-checklist__header">
                  <div><h2>Bảng kiểm đã thực hiện</h2><p>{sections.length} phần · {totalQuestions} câu hỏi</p></div>
                  <button
                    onClick={() => setExpandedSections(allExpanded ? new Set() : new Set(sections.map((section) => String(section.sectionKey || section.id))))}
                    type="button"
                  >{allExpanded ? <UpOutlined /> : <DownOutlined />}{allExpanded ? 'Thu gọn tất cả' : 'Mở tất cả'}</button>
                </header>

                <div className="aqh-readonly-sections">
                  {sections.map((section, sectionIndex) => {
                    const sectionKey = String(section.sectionKey || section.id)
                    const isExpanded = expandedSections.has(sectionKey)
                    const items = getQuestionItems(section)
                    return (
                      <article className="aqh-readonly-section" key={sectionKey}>
                        <button aria-expanded={isExpanded} className="aqh-readonly-section__toggle" onClick={() => toggleSection(sectionKey)} type="button">
                          <span className="aqh-readonly-section__number">{sectionIndex + 1}</span>
                          <span><strong>{section.title || `Phần ${sectionIndex + 1}`}</strong>{section.description && <small>{section.description}</small>}</span>
                          {isExpanded ? <UpOutlined /> : <DownOutlined />}
                        </button>
                        {isExpanded && (
                          <div className="aqh-readonly-section__content">
                            {items.map((item, itemIndex) => {
                              if (!item.question) {
                                return (
                                  <div className="aqh-readonly-content-block" key={item.itemKey || item.id || itemIndex}>
                                    {item.title && <strong>{item.title}</strong>}
                                    {item.description && <p>{item.description}</p>}
                                  </div>
                                )
                              }

                              const question = item.question
                              const questionKey = String(question.questionKey)
                              const answer = answersByQuestion.get(questionKey)
                              const score = scoresByQuestion.get(questionKey)
                              const selectedOption = question.options?.find((option) => String(option.optionKey) === String(answer?.optionKey))
                              const hasScore = !question.excludeFromScore && score
                              const weightedScore = Number(score?.weightedScore)
                              const maxScore = Number(score?.maxScore)
                              const isQuestionFailed = selectedOption?.compliant === false
                                || (hasScore && Number.isFinite(weightedScore) && Number.isFinite(maxScore) && weightedScore < maxScore)
                              return (
                                <div className={`aqh-readonly-question${isQuestionFailed ? ' aqh-readonly-question--failed' : ''}`} key={questionKey}>
                                  <div className="aqh-readonly-question__main">
                                    <div className="aqh-readonly-question__title">
                                      <span>{itemIndex + 1}</span>
                                      <div><strong>{question.title || item.title || `Câu hỏi ${itemIndex + 1}`}</strong>{question.code && <small>{question.code}</small>}</div>
                                      {question.critical && <em>Trọng yếu</em>}
                                      {question.excludeFromScore && <em className="is-neutral">Không tính điểm</em>}
                                    </div>
                                    {question.helpText && <p className="aqh-readonly-question__help">{question.helpText}</p>}
                                    <div className={`aqh-readonly-answer${!answer ? ' is-empty' : ''}`}>
                                      <span>Câu trả lời</span><strong>{getAnswerDisplay(answer, question)}</strong>
                                    </div>
                                  </div>
                                  {hasScore && (
                                    <div className="aqh-readonly-question__score">
                                      <span>Điểm</span><strong>{formatScore(score.weightedScore)} / {formatScore(score.maxScore)}</strong>
                                      <small>{isQuestionFailed ? 'Cần xem lại' : 'Đạt điểm tối đa'}</small>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </div>
    </AppShell>
  )
}

export default AdminQualityHistoryDetailPage
