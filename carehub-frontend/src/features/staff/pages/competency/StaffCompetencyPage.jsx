import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { myCompetencyApi } from '../../../evaluation/api/myCompetencyApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../../../evaluation/utils/documentQuestionUi.js'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import { tokenStorage } from '../../../../features/auth/services/tokenStorage.js'
import { getRolesFromAccessToken } from '../../../../features/auth/utils/jwt.js'
import {
  TrophyOutlined,
  BookOutlined,
  ExperimentOutlined,
  PieChartOutlined,
  LoadingOutlined,
  WarningFilled,
  CheckCircleFilled,
  EyeOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import '../../styles/StaffCompetencyPage.css'

const COMPETENCY_COLORS = {
  NOT_COMPETENT: ['#ef4444', '#fef2f2'],
  BEGINNER: ['#f59e0b', '#fffbeb'],
  BASIC: ['#3b82f6', '#eff6ff'],
  PROFICIENT: ['#10b981', '#ecfdf5'],
  ADVANCED: ['#8b5cf6', '#f5f3ff'],
}

function StaffCompetencyPage() {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState('knowledge')

  const [knowledgeData, setKnowledgeData] = useState(null)
  const [skillData, setSkillData] = useState(null)
  const [summaryData, setSummaryData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = roles.some(r => String(r).toUpperCase().includes('ADMIN'))
  const isManager = roles.some(r => String(r).toUpperCase().includes('MANAGER'))
  const dashboardPath = isAdmin ? '/admin/dashboard' : isManager ? '/manager/dashboard' : '/staff/dashboard'

  const now = new Date()
  const firstDayOfYear = `${now.getFullYear()}-01-01`
  const today = now.toISOString().slice(0, 10)
  const [fromDate, setFromDate] = useState(firstDayOfYear)
  const [toDate, setToDate] = useState(today)

  const loadAllData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { fromDate, toDate }
      const [kRes, sRes, sumRes] = await Promise.all([
        myCompetencyApi.getKnowledge(params),
        myCompetencyApi.getSkills(params),
        myCompetencyApi.getSummary(params),
      ])
      setKnowledgeData(apiData(kRes, null))
      setSkillData(apiData(sRes, null))
      setSummaryData(apiData(sumRes, null))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, showToast])

  useEffect(() => {
    const timer = window.setTimeout(loadAllData, 0)
    return () => window.clearTimeout(timer)
  }, [loadAllData])

  const breadcrumbs = [
    { label: 'Dashboard', link: dashboardPath },
    { label: 'Năng lực của tôi' },
  ]

  const tabs = [
    { key: 'knowledge', label: 'Kiến thức chuyên môn', icon: <BookOutlined /> },
    { key: 'skills', label: 'Kỹ năng thực hành', icon: <ExperimentOutlined /> },
    { key: 'summary', label: 'Tổng hợp', icon: <PieChartOutlined /> },
  ]

  const openDetail = async (type, id) => {
    setDetailLoading(true)
    setDetail({ type, data: null })
    try {
      const response = type === 'exam'
        ? await myCompetencyApi.getExamAttempt(id)
        : await myCompetencyApi.getSkillEvaluation(id)
      setDetail({ type, data: apiData(response, null) })
    } catch (error) {
      setDetail(null)
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard-layout">
        <Sidebar />
        <div className="dashboard-layout__content">
          <Header breadcrumbs={breadcrumbs} />
          <div className="dashboard-root">
            <main className="dashboard-body">
              <div className="sc-loading">
                <LoadingOutlined style={{ fontSize: 32, marginBottom: 16, color: '#3b82f6' }} />
                <p>Đang tải dữ liệu năng lực...</p>
              </div>
            </main>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="sc-page">
              <div className="sc-header">
                <div className="sc-header__title-row">
                  <TrophyOutlined className="sc-header__icon" />
                  <h2 className="sc-header__title">Năng lực của tôi</h2>
                </div>
                <p className="sc-header__desc">
                  Đánh giá năng lực chuyên môn cá nhân từ đầu năm {now.getFullYear()} đến nay
                </p>
              </div>

              <div className="sc-filter">
                <label className="sc-filter__label">Từ ngày</label>
                <input type="date" className="sc-filter__input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                <label className="sc-filter__label">Đến ngày</label>
                <input type="date" className="sc-filter__input" value={toDate} onChange={e => setToDate(e.target.value)} />
                <button className="sc-filter__btn" onClick={loadAllData}>Áp dụng</button>
              </div>

              <PersonalCompetencyOverview data={summaryData} />

              <div className="sc-tabs">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    className={`sc-tab ${activeTab === tab.key ? 'sc-tab--active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="sc-content">
                {activeTab === 'knowledge' && <KnowledgeTab data={knowledgeData} onView={id => openDetail('exam', id)} />}
                {activeTab === 'skills' && <SkillsTab data={skillData} onView={id => openDetail('skill', id)} />}
                {activeTab === 'summary' && <SummaryTab data={summaryData} />}
              </div>

              {detail && (
                <CompetencyDetailDialog
                  detail={detail}
                  loading={detailLoading}
                  onClose={() => setDetail(null)}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function PersonalCompetencyOverview({ data }) {
  const hasSummary = data && [data.knowledgeAverage, data.skillAverage, data.overallScore]
    .some((value) => value !== null && value !== undefined)

  return (
    <section className="sc-personal-overview" aria-labelledby="personal-competency-title">
      <div className="sc-personal-overview__heading">
        <div>
          <span>NĂNG LỰC CỦA TÔI</span>
          <h3 id="personal-competency-title">Kết quả tuân thủ quy trình</h3>
        </div>
        <span className={`sc-personal-status ${data?.isPassed ? 'sc-personal-status--passed' : ''}`}>
          {!hasSummary ? 'Chưa đủ dữ liệu'
            : data?.targetScore == null ? 'Chưa đặt mục tiêu'
              : data?.isPassed ? 'Đạt' : 'Chưa đạt'}
        </span>
      </div>

      <div className="sc-personal-metrics">
        <PersonalMetric icon={<BookOutlined />} label="Điểm lý thuyết" value={data?.knowledgeAverage} />
        <PersonalMetric icon={<ExperimentOutlined />} label="Điểm thực hành" value={data?.skillAverage} />
        <PersonalMetric icon={<TrophyOutlined />} label="Điểm tổng" value={data?.overallScore} />
        <PersonalMetric icon={<PieChartOutlined />} label="Mục tiêu của khoa" value={data?.targetScore} />
      </div>

      {data?.targetScore == null && (
        <div className="sc-personal-api-note">
          <WarningFilled />
          <span>Manager của {data?.departmentName || 'khoa'} chưa thiết lập điểm mục tiêu.</span>
        </div>
      )}
    </section>
  )
}

function PersonalMetric({ icon, label, value, suffix = 'điểm' }) {
  const number = value === null || value === undefined || value === '' ? null : Number(value)
  return (
    <article className="sc-personal-metric">
      <span className="sc-personal-metric__icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{Number.isFinite(number) ? `${formatNumber(number)} ${suffix}` : '—'}</strong>
      </div>
    </article>
  )
}

function KnowledgeTab({ data, onView }) {
  const attempts = (data?.items || []).flatMap(item =>
    (item.attempts || []).map(attempt => ({ ...attempt, categoryName: item.categoryName || 'Chung' })))

  if (attempts.length === 0) {
    return (
      <div className="sc-empty">
        <BookOutlined style={{ fontSize: 48, color: '#d1d5db', marginBottom: 16 }} />
        <p className="sc-empty__title">Chưa có dữ liệu kiểm tra kiến thức</p>
        <p className="sc-empty__desc">Bạn chưa thực hiện bài kiểm tra trắc nghiệm nào trong khoảng thời gian này.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="sc-summary-card">
        <div className="sc-summary-card__item">
          <span className="sc-summary-card__label">Điểm trung bình kiến thức</span>
          <span className="sc-summary-card__value">{data.overallAverage != null ? formatNumber(data.overallAverage) : '—'}</span>
        </div>
        <div className="sc-summary-card__item">
          <span className="sc-summary-card__label">Tổng số lần thi</span>
          <span className="sc-summary-card__value">{data.totalAttempts || 0}</span>
        </div>
      </div>

      <div className="sc-table-wrapper">
        <table className="sc-table">
          <thead>
            <tr>
              <th>Bài kiểm tra</th>
              <th>Lĩnh vực</th>
              <th>Ngày làm</th>
              <th>Điểm</th>
              <th>Kết quả</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map(attempt => (
              <tr key={attempt.attemptId} className={!attempt.passed ? 'sc-row--danger' : ''}>
                <td><strong>{attempt.examPaperTitle || 'Bài kiểm tra'}</strong></td>
                <td>{attempt.categoryName}</td>
                <td>{formatLocalDate(attempt.attemptDate)}</td>
                <td>{formatNumber(attempt.score)} / 100</td>
                <td>
                  <span className="sc-badge" style={{ backgroundColor: (attempt.colorHex || '#6b7280') + '20', color: attempt.colorHex || '#6b7280', borderColor: attempt.colorHex || '#6b7280' }}>
                    {attempt.passed ? <CheckCircleFilled style={{ marginRight: 4 }} /> : <WarningFilled style={{ marginRight: 4 }} />}
                    {attempt.passed ? 'Đạt' : 'Chưa đạt'}
                  </span>
                </td>
                <td><button type="button" className="sc-view-btn" onClick={() => onView(attempt.attemptId)}><EyeOutlined /> Chi tiết</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SkillsTab({ data, onView }) {
  const evaluations = (data?.items || []).flatMap(item =>
    (item.attempts || []).map(attempt => ({ ...attempt, formName: item.formName })))

  if (evaluations.length === 0) {
    return (
      <div className="sc-empty">
        <ExperimentOutlined style={{ fontSize: 48, color: '#d1d5db', marginBottom: 16 }} />
        <p className="sc-empty__title">Chưa có dữ liệu giám sát kỹ năng</p>
        <p className="sc-empty__desc">Bạn chưa được đánh giá kỹ năng thực hành nào trong khoảng thời gian này.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="sc-summary-card">
        <div className="sc-summary-card__item">
          <span className="sc-summary-card__label">Điểm trung bình kỹ năng</span>
          <span className="sc-summary-card__value">{data.overallAverage != null ? formatNumber(data.overallAverage) : '—'}</span>
        </div>
        <div className="sc-summary-card__item">
          <span className="sc-summary-card__label">Tổng số lần đánh giá</span>
          <span className="sc-summary-card__value">{data.totalEvaluations || 0}</span>
        </div>
      </div>

      <div className="sc-table-wrapper">
        <table className="sc-table">
          <thead>
            <tr>
              <th>Bảng kiểm</th>
              <th>Ngày đánh giá</th>
              <th>Người đánh giá</th>
              <th>Điểm</th>
              <th>Kết quả</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map(evaluation => (
              <tr key={evaluation.submissionId} className={!evaluation.passed ? 'sc-row--danger' : ''}>
                <td><strong>{evaluation.formName}</strong></td>
                <td>{formatLocalDate(evaluation.evaluatedAt)}</td>
                <td>{evaluation.evaluatedBy || '—'}</td>
                <td>{formatNumber(evaluation.score)} / 100</td>
                <td>
                  <span className="sc-badge" style={{ backgroundColor: (evaluation.colorHex || '#6b7280') + '20', color: evaluation.colorHex || '#6b7280', borderColor: evaluation.colorHex || '#6b7280' }}>
                    {evaluation.passed ? <CheckCircleFilled style={{ marginRight: 4 }} /> : <WarningFilled style={{ marginRight: 4 }} />}
                    {evaluation.passed ? 'Đạt' : 'Chưa đạt'}
                  </span>
                </td>
                <td><button type="button" className="sc-view-btn" onClick={() => onView(evaluation.submissionId)}><EyeOutlined /> Chi tiết</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatLocalDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('vi-VN')
}

function CompetencyDetailDialog({ detail, loading, onClose }) {
  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const data = detail.data
  const isExam = detail.type === 'exam'
  const title = isExam ? data?.examPaperName : data?.title
  const skillScore = data?.convertedScore == null ? null : Number(data.convertedScore) * 10

  return (
    <div className="sc-detail-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="sc-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="competency-detail-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="sc-detail-dialog__header">
          <div>
            <span>{isExam ? 'KẾT QUẢ BÀI KIỂM TRA' : 'KẾT QUẢ BẢNG KIỂM'}</span>
            <h3 id="competency-detail-title">{title || 'Chi tiết kết quả'}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng chi tiết"><CloseOutlined /></button>
        </header>

        {loading ? (
          <div className="sc-detail-dialog__loading"><LoadingOutlined spin /> Đang tải chi tiết...</div>
        ) : !data ? (
          <div className="sc-detail-dialog__loading">Không tìm thấy dữ liệu chi tiết.</div>
        ) : isExam ? (
          <ExamResultDetail data={data} />
        ) : (
          <SkillResultDetail data={data} score={skillScore} />
        )}
      </section>
    </div>
  )
}

function ExamResultDetail({ data }) {
  return (
    <div className="sc-detail-dialog__body">
      <div className="sc-detail-metrics">
        <PersonalMetric icon={<TrophyOutlined />} label="Điểm bài thi" value={data.score} />
        <PersonalMetric icon={<CheckCircleFilled />} label="Số câu đúng" value={data.correctCount} suffix="câu" />
        <PersonalMetric icon={<BookOutlined />} label="Tổng số câu" value={data.totalQuestions} suffix="câu" />
      </div>
      {(data.questions || []).map(question => {
        const answer = (data.answers || []).find(item => item.paperQuestionId === question.paperQuestionId)
        return (
          <article key={question.paperQuestionId} className="sc-detail-question">
            <div><strong>Câu {question.position}</strong><span>{answer?.correct ? 'Đúng' : 'Sai'}</span></div>
            <p>{question.stem}</p>
            <small>Đã chọn: {answer?.selectedAnswer || question.selectedAnswer || 'Chưa chọn'}{answer?.correctAnswer ? ` · Đáp án đúng: ${answer.correctAnswer}` : ''}</small>
            {answer?.explanation && <small>Giải thích: {answer.explanation}</small>}
          </article>
        )
      })}
    </div>
  )
}

function SkillResultDetail({ data, score }) {
  return (
    <div className="sc-detail-dialog__body">
      <div className="sc-detail-metrics">
        <PersonalMetric icon={<TrophyOutlined />} label="Điểm thực hành" value={score} />
        <PersonalMetric icon={<ExperimentOutlined />} label="Điểm thô" value={data.totalScore} />
        <PersonalMetric icon={<CheckCircleFilled />} label="Điểm đạt" value={data.passingScore} />
      </div>
      <div className="sc-detail-breakdown">
        <h4>Chi tiết tiêu chí</h4>
        {(data.scoreBreakdown || []).length === 0 ? (
          <p>Không có dữ liệu phân rã điểm.</p>
        ) : (data.scoreBreakdown || []).map(item => (
          <article key={item.questionKey}>
            <div><strong>{item.code} · {item.title}</strong>{item.critical && <span>Tiêu chí trọng yếu</span>}</div>
            <small>Điểm: {formatNumber(item.weightedScore)} / {formatNumber(item.maxScore)}</small>
          </article>
        ))}
      </div>
    </div>
  )
}

function SummaryTab({ data }) {
  if (!data) {
    return (
      <div className="sc-empty">
        <PieChartOutlined style={{ fontSize: 48, color: '#d1d5db', marginBottom: 16 }} />
        <p className="sc-empty__title">Chưa có dữ liệu tổng hợp</p>
        <p className="sc-empty__desc">Hệ thống chưa đủ dữ liệu kiến thức và kỹ năng để tổng hợp năng lực của bạn.</p>
      </div>
    )
  }

  const [fg] = COMPETENCY_COLORS[data.competencyLevel] || ['#6b7280']

  return (
    <div className="sc-summary-panel">
      <div className="sc-summary-grid">
        <div className="sc-summary-card">
          <div className="sc-summary-card__item">
            <span className="sc-summary-card__label">Điểm TB kiến thức</span>
            <span className="sc-summary-card__value">{data.knowledgeAverage != null ? formatNumber(data.knowledgeAverage) : '—'}</span>
          </div>
        </div>
        <div className="sc-summary-card">
          <div className="sc-summary-card__item">
            <span className="sc-summary-card__label">Mục tiêu của khoa</span>
            <span className="sc-summary-card__value">{data.targetScore != null ? formatNumber(data.targetScore) : '—'}</span>
          </div>
        </div>
        <div className="sc-summary-card">
          <div className="sc-summary-card__item">
            <span className="sc-summary-card__label">Điểm TB kỹ năng</span>
            <span className="sc-summary-card__value">{data.skillAverage != null ? formatNumber(data.skillAverage) : '—'}</span>
          </div>
        </div>
        <div className="sc-summary-card">
          <div className="sc-summary-card__item">
            <span className="sc-summary-card__label">Tổng điểm</span>
            <span className="sc-summary-card__value">{data.overallScore != null ? formatNumber(data.overallScore) : '—'}</span>
          </div>
        </div>
        <div className="sc-summary-card sc-summary-card--highlight" style={{ borderColor: fg }}>
          <div className="sc-summary-card__item">
            <span className="sc-summary-card__label">Mức phân loại</span>
            <span className="sc-summary-card__value" style={{ color: fg }}>
              {data.competencyLabel || 'Chưa xác định'}
            </span>
          </div>
        </div>
      </div>

      {data.targetScore == null ? (
        <div className="sc-warning sc-warning--neutral">
          <WarningFilled style={{ fontSize: 20, marginRight: 8 }} />
          <span>Manager của khoa chưa thiết lập điểm mục tiêu.</span>
        </div>
      ) : data.overallScore == null ? (
        <div className="sc-warning sc-warning--neutral">
          <WarningFilled style={{ fontSize: 20, marginRight: 8 }} />
          <span>Cần có cả kết quả lý thuyết và thực hành để tính điểm tổng.</span>
        </div>
      ) : !data.isPassed && (
        <div className="sc-warning">
          <WarningFilled style={{ fontSize: 20, marginRight: 8 }} />
          <span>Điểm tổng chưa vượt mục tiêu của khoa. Vui lòng liên hệ Điều dưỡng trưởng khoa.</span>
        </div>
      )}

      <div className="sc-meta">
        <span>Dữ liệu từ {data.fromDate} đến {data.toDate}</span>
      </div>
    </div>
  )
}

export default StaffCompetencyPage
