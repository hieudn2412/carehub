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
                {activeTab === 'knowledge' && <KnowledgeTab data={knowledgeData} />}
                {activeTab === 'skills' && <SkillsTab data={skillData} />}
                {activeTab === 'summary' && <SummaryTab data={summaryData} />}
              </div>
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
          {hasSummary ? (data?.isPassed ? 'Đạt' : 'Chưa đạt') : 'Chưa có kết quả'}
        </span>
      </div>

      <div className="sc-personal-metrics">
        <PersonalMetric icon={<BookOutlined />} label="Điểm lý thuyết" value={data?.knowledgeAverage} />
        <PersonalMetric icon={<ExperimentOutlined />} label="Điểm thực hành" value={data?.skillAverage} />
        <PersonalMetric icon={<TrophyOutlined />} label="Điểm tổng" value={data?.overallScore} />
        <PersonalMetric icon={<PieChartOutlined />} label="Mục tiêu của khoa" value={null} />
      </div>

      <div className="sc-personal-api-note">
        <WarningFilled />
        <span>Backend chưa trả về mục tiêu riêng của khoa nên chưa thể so sánh và cảnh báo chênh lệch cá nhân.</span>
      </div>
    </section>
  )
}

function PersonalMetric({ icon, label, value }) {
  const number = value === null || value === undefined || value === '' ? null : Number(value)
  return (
    <article className="sc-personal-metric">
      <span className="sc-personal-metric__icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{Number.isFinite(number) ? `${formatNumber(number)} điểm` : '—'}</strong>
      </div>
    </article>
  )
}

function KnowledgeTab({ data }) {
  if (!data || !data.items || data.items.length === 0) {
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
              <th>Lĩnh vực</th>
              <th>Số lần thi</th>
              <th>Điểm TB</th>
              <th>Tỷ lệ đạt</th>
              <th>Phân loại</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx} className={!item.isPassed ? 'sc-row--danger' : ''}>
                <td>{item.categoryName || 'Chung'}</td>
                <td>{item.attemptCount}</td>
                <td>{formatNumber(item.averageScore)}</td>
                <td>{item.passRate != null ? `${item.passRate}%` : '—'}</td>
                <td>
                  <span className="sc-badge" style={{ backgroundColor: (item.colorHex || '#6b7280') + '20', color: item.colorHex || '#6b7280', borderColor: item.colorHex || '#6b7280' }}>
                    {item.isPassed ? <CheckCircleFilled style={{ marginRight: 4 }} /> : <WarningFilled style={{ marginRight: 4 }} />}
                    {item.competencyLabel || '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SkillsTab({ data }) {
  if (!data || !data.items || data.items.length === 0) {
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
              <th>Kỹ thuật</th>
              <th>Số lần ĐG</th>
              <th>Điểm TB</th>
              <th>Tỷ lệ đạt</th>
              <th>Phân loại</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx} className={!item.isPassed ? 'sc-row--danger' : ''}>
                <td>{item.formName}</td>
                <td>{item.evaluationCount}</td>
                <td>{formatNumber(item.averageScore)}</td>
                <td>{item.passRate != null ? `${item.passRate}%` : '—'}</td>
                <td>
                  <span className="sc-badge" style={{ backgroundColor: (item.colorHex || '#6b7280') + '20', color: item.colorHex || '#6b7280', borderColor: item.colorHex || '#6b7280' }}>
                    {item.isPassed ? <CheckCircleFilled style={{ marginRight: 4 }} /> : <WarningFilled style={{ marginRight: 4 }} />}
                    {item.competencyLabel || '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

      {!data.isPassed && (
        <div className="sc-warning">
          <WarningFilled style={{ fontSize: 20, marginRight: 8 }} />
          <span>Mức phân loại năng lực chuyên môn chưa đạt. Vui lòng liên hệ Điều dưỡng trưởng khoa.</span>
        </div>
      )}

      <div className="sc-meta">
        <span>Dữ liệu từ {data.fromDate} đến {data.toDate}</span>
      </div>
    </div>
  )
}

export default StaffCompetencyPage
