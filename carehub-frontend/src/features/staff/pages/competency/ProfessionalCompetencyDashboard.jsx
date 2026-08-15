import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRightOutlined,
  BookOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import LoadingState from '../../../../shared/components/LoadingState.jsx'
import EmptyState from '../../../../shared/components/EmptyState.jsx'
import { myCompetencyApi } from '../../../evaluation/api/myCompetencyApi.js'
import { myExamApi } from '../../../evaluation/api/myExamApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../../../evaluation/utils/documentQuestionUi.js'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import './ProfessionalCompetencyDashboard.css'

const SCORE_FORMATTER = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const DEFAULT_COMPETENCY_TARGET_SCORE = 6

function localToday() {
  const date = new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function defaultFromDate() {
  return `${new Date().getFullYear()}-01-01`
}

function formatScore(value) {
  const score = Number(value)
  return SCORE_FORMATTER.format(Number.isFinite(score) ? score : 0)
}

function parseFilters(params) {
  return {
    q: (params.get('q') || '').trim(),
    dateFrom: params.get('dateFrom') || defaultFromDate(),
    dateTo: params.get('dateTo') || localToday(),
  }
}

function isActionable(assignment) {
  return Boolean(assignment?.currentAttemptId || assignment?.actionable)
}

function assignmentTime(value, fallback) {
  if (!value) return fallback
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : fallback
}

function sortAssignments(left, right) {
  const leftInProgress = left.currentAttemptId ? 0 : 1
  const rightInProgress = right.currentAttemptId ? 0 : 1
  if (leftInProgress !== rightInProgress) return leftInProgress - rightInProgress

  const dueDifference = assignmentTime(left.dueAt, Number.MAX_SAFE_INTEGER)
    - assignmentTime(right.dueAt, Number.MAX_SAFE_INTEGER)
  if (dueDifference !== 0) return dueDifference
  return assignmentTime(right.createdAt, 0) - assignmentTime(left.createdAt, 0)
}

function CompetencyMetricCard({ type, icon, title, description, score, count, countLabel }) {
  return (
    <article className={`pc-metric-card pc-metric-card--${type}`}>
      <div className="pc-metric-card__heading">
        <span className="pc-metric-card__icon" aria-hidden="true">{icon}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="pc-metric-card__score">
        <strong>{formatScore(score)}</strong><span>/10</span>
      </div>
      <div className="pc-metric-card__count">
        <strong>{Number(count || 0)}</strong>
        <span>{countLabel}</span>
      </div>
    </article>
  )
}

function CompetencySearchForm({ filters, onChange, onClear, onApply, dateError = '', autoFocus = false }) {
  return (
    <div className="pc-search-form">
      <label className="pc-search-form__query">
        <span>Tìm bài kiểm tra</span>
        <div className="pc-search-form__input-wrap">
          <SearchOutlined aria-hidden="true" />
          <input
            value={filters.q}
            onChange={event => onChange({ q: event.target.value })}
            onKeyDown={event => {
              if (event.key === 'Enter') onApply()
            }}
            placeholder="Nhập tên bài kiểm tra..."
            aria-label="Tìm bài kiểm tra"
            data-mobile-search-autofocus={autoFocus ? true : undefined}
          />
        </div>
      </label>
      <label>
        <span>Từ ngày</span>
        <input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={event => onChange({ dateFrom: event.target.value })} aria-label="Từ ngày năng lực" />
      </label>
      <label>
        <span>Đến ngày</span>
        <input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} max={localToday()} onChange={event => onChange({ dateTo: event.target.value })} aria-label="Đến ngày năng lực" />
      </label>
      {dateError && <p className="pc-search-form__error" role="alert">{dateError}</p>}
      <div className="pc-search-form__actions">
        <button type="button" className="pc-button pc-button--ghost" onClick={onClear}>Xóa bộ lọc</button>
        <button type="button" className="pc-button pc-button--primary" onClick={onApply}>Áp dụng</button>
      </div>
    </div>
  )
}

function ProfessionalCompetencyDashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])
  const [draftFilters, setDraftFilters] = useState(filters)
  const [summary, setSummary] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)
  const [summaryError, setSummaryError] = useState('')
  const [assignmentsError, setAssignmentsError] = useState('')
  const [dateError, setDateError] = useState('')
  const [startingId, setStartingId] = useState(null)

  useEffect(() => setDraftFilters(filters), [filters])

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError('')
    try {
      setSummary(apiData(await myCompetencyApi.getSummary({ fromDate: filters.dateFrom, toDate: filters.dateTo }), null))
    } catch (error) {
      setSummaryError(apiErrorMessage(error))
    } finally {
      setSummaryLoading(false)
    }
  }, [filters.dateFrom, filters.dateTo])

  const loadAssignments = useCallback(async () => {
    setAssignmentsLoading(true)
    setAssignmentsError('')
    try {
      setAssignments(apiData(await myExamApi.listAssignments(), []))
    } catch (error) {
      setAssignmentsError(apiErrorMessage(error))
    } finally {
      setAssignmentsLoading(false)
    }
  }, [])

  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => { loadAssignments() }, [loadAssignments])

  const visibleAssignments = useMemo(() => {
    const query = filters.q.toLowerCase()
    return assignments
      .filter(isActionable)
      .filter(item => !query || String(item.name || '').toLowerCase().includes(query))
      .sort(sortAssignments)
      .slice(0, 4)
  }, [assignments, filters.q])

  const updateDraftFilters = values => setDraftFilters(current => ({ ...current, ...values }))
  const clearFilters = () => {
    setDraftFilters({ q: '', dateFrom: defaultFromDate(), dateTo: localToday() })
    setDateError('')
  }
  const applyFilters = () => {
    if (draftFilters.dateFrom && draftFilters.dateTo && draftFilters.dateFrom > draftFilters.dateTo) {
      setDateError('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
      return false
    }
    setDateError('')
    const nextParams = new URLSearchParams()
    if (draftFilters.q.trim()) nextParams.set('q', draftFilters.q.trim())
    if (draftFilters.dateFrom) nextParams.set('dateFrom', draftFilters.dateFrom)
    if (draftFilters.dateTo) nextParams.set('dateTo', draftFilters.dateTo)
    setSearchParams(nextParams)
    return true
  }

  const startAssignment = async assignment => {
    if (startingId) return
    if (assignment.currentAttemptId) {
      navigate(`/staff/exam/take/${assignment.currentAttemptId}`)
      return
    }
    setStartingId(assignment.id)
    try {
      const attempt = apiData(await myExamApi.startAssignment(assignment.id), null)
      if (!attempt?.id) throw new Error('Thiếu lượt làm bài trong phản hồi')
      navigate(`/staff/exam/take/${attempt.id}`)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setStartingId(null)
    }
  }

  const activeFilterCount = Number(Boolean(filters.q))
    + Number(filters.dateFrom !== defaultFromDate() || filters.dateTo !== localToday())
  const renderMobileSearch = ({ close }) => (
    <CompetencySearchForm
      filters={draftFilters}
      onChange={updateDraftFilters}
      onClear={clearFilters}
      onApply={() => { if (applyFilters()) close() }}
      dateError={dateError}
      autoFocus
    />
  )

  const knowledgeAverage = Number(summary?.knowledgeAverage || 0)
  const skillAverage = Number(summary?.skillAverage || 0)
  const overallScore = Number(summary?.overallScore ?? ((knowledgeAverage + skillAverage) / 2))
  const targetScore = summary?.targetScore == null
    ? DEFAULT_COMPETENCY_TARGET_SCORE
    : Number(summary.targetScore)
  const status = summary?.targetScore == null
    ? overallScore >= targetScore ? 'PASSED' : 'FAILED'
    : summary?.isPassed ? 'PASSED' : 'FAILED'

  return (
    <AppShell
      title="Năng lực chuyên môn"
      className="professional-competency-shell"
      mobileSearch={{
        title: 'Tìm kiếm năng lực chuyên môn',
        ariaLabel: 'Mở tìm kiếm năng lực chuyên môn',
        activeCount: activeFilterCount,
        renderContent: renderMobileSearch,
      }}
      breadcrumbs={[{ label: 'Năng lực chuyên môn' }]}
    >
      <div className="pc-page">
        <section className="pc-toolbar" aria-label="Bộ lọc năng lực chuyên môn">
          <div className="pc-toolbar__title"><span>Đánh giá cá nhân</span><strong>{filters.dateFrom} → {filters.dateTo}</strong></div>
          <CompetencySearchForm filters={draftFilters} onChange={updateDraftFilters} onClear={clearFilters} onApply={applyFilters} dateError={dateError} />
        </section>

        <section className="pc-metric-grid" aria-label="Hai nhóm năng lực">
          {summaryLoading ? <div className="pc-state pc-state--wide"><LoadingState label="Đang tải năng lực chuyên môn..." /></div> : summaryError ? <div className="pc-state pc-state--wide pc-state--error" role="alert"><span>{summaryError}</span><button type="button" onClick={loadSummary}><ReloadOutlined /> Thử lại</button></div> : (
            <>
              <CompetencyMetricCard type="knowledge" icon={<BookOutlined />} title="Kiến thức" description="Kết quả các bài kiểm tra" score={knowledgeAverage} count={summary?.knowledgeAttemptCount} countLabel="lượt làm bài kiểm tra" />
              <CompetencyMetricCard type="skills" icon={<SafetyCertificateOutlined />} title="Kỹ năng" description="Kết quả các bảng kiểm được chấm" score={skillAverage} count={summary?.skillEvaluationCount} countLabel="lượt được chấm" />
            </>
          )}
        </section>

        {!summaryLoading && !summaryError && <section className={`pc-overall-card pc-overall-card--${status.toLowerCase()}`} aria-label="Năng lực chuyên môn tổng hợp">
          <div className="pc-overall-card__icon"><TrophyOutlined /></div>
          <div className="pc-overall-card__content"><span className="pc-overall-card__eyebrow">Năng lực chuyên môn</span><strong>{formatScore(overallScore)}<small>/10</small></strong><span>Điểm trung bình của Kiến thức và Kỹ năng</span></div>
          <div className="pc-overall-card__status">{status === 'PASSED' && <CheckCircleFilled />}{status === 'FAILED' && <CloseCircleFilled />}<b>{status === 'PASSED' ? 'Đạt' : 'Không đạt'}</b><small>Điểm sàn hiện tại: {formatScore(targetScore)}/10</small></div>
        </section>}

        <section className="pc-exams-card" aria-labelledby="pc-exams-title">
          <header className="pc-section-header"><div><span className="pc-section-header__eyebrow">Mới nhất</span><h2 id="pc-exams-title">Kiểm tra kiến thức</h2><p>Các bài kiểm tra đang sẵn sàng để bạn thực hiện.</p></div><button type="button" className="pc-view-all" onClick={() => navigate('/staff/professional-competency/all')}>Xem toàn bộ <ArrowRightOutlined /></button></header>
          {assignmentsLoading ? <LoadingState label="Đang tải bài kiểm tra..." /> : assignmentsError ? <div className="pc-state pc-state--error" role="alert"><span>{assignmentsError}</span><button type="button" onClick={loadAssignments}><ReloadOutlined /> Thử lại</button></div> : visibleAssignments.length === 0 ? <EmptyState>{filters.q ? 'Không có bài kiểm tra phù hợp.' : 'Hiện không có bài kiểm tra nào cần làm.'}</EmptyState> : <div className="pc-assignment-list">{visibleAssignments.map(item => <button key={item.id} type="button" className="pc-assignment-row" onClick={() => startAssignment(item)} disabled={startingId != null && startingId !== item.id}><span className="pc-assignment-row__icon"><PlayCircleOutlined /></span><span className="pc-assignment-row__main"><strong>{item.name}</strong><small>{item.professionalFieldName || 'Năng lực chuyên môn'} · Hạn {formatDateTime(item.dueAt)}</small></span><span className="pc-assignment-row__action">{startingId === item.id ? <LoadingOutlined spin /> : <ArrowRightOutlined />}</span></button>)}</div>}
        </section>
      </div>
    </AppShell>
  )
}

export default ProfessionalCompetencyDashboard
