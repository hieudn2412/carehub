import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircleFilled, CloseOutlined, EyeOutlined, FilterOutlined, SafetyCertificateOutlined, SearchOutlined, WarningFilled } from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import LoadingState from '../../../../shared/components/LoadingState.jsx'
import EmptyState from '../../../../shared/components/EmptyState.jsx'
import { myCompetencyApi } from '../../../evaluation/api/myCompetencyApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../../../../shared/utils/apiUi.js'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import '../../styles/StaffCompetencyPage.css'

const localToday = () => {
  const date = new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const SCORE_FORMATTER = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const formatScore10 = value => {
  const score = Number(value)
  return SCORE_FORMATTER.format(Number.isFinite(score) ? score : 0)
}

const convertToTenPointScale = (value, totalMaxScore) => {
  const score = Number(value)
  const maxScore = Number(totalMaxScore)
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return 0
  return score * 10 / maxScore
}

export default function StaffCompetencyPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const today = localToday()
  const fromDate = searchParams.get('dateFrom') || `${new Date().getFullYear()}-01-01`
  const toDate = searchParams.get('dateTo') || today
  const query = (searchParams.get('q') || '').trim()
  const [draftFilters, setDraftFilters] = useState({ q: query, dateFrom: fromDate, dateTo: toDate })
  const [dateError, setDateError] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailAttempts, setDetailAttempts] = useState([])
  const [activeSubmissionId, setActiveSubmissionId] = useState(null)

  useEffect(() => {
    setDraftFilters({ q: query, dateFrom: fromDate, dateTo: toDate })
  }, [fromDate, query, toDate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(apiData(await myCompetencyApi.getSkills({ fromDate, toDate }), null))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [fromDate, showToast, toDate])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const totals = useMemo(() => {
    const items = data?.items || []
    const evaluated = items.reduce((sum, item) => sum + Number(item.evaluationCount || 0), 0)
    const passed = items.reduce((sum, item) => sum + Number(item.passCount || 0), 0)
    return { evaluated, passed, rate: evaluated ? passed * 100 / evaluated : 0 }
  }, [data])

  const visibleItems = useMemo(() => {
    if (!query) return data?.items || []
    return (data?.items || []).filter(item => String(item.formName || '').toLowerCase().includes(query.toLowerCase()))
  }, [data, query])

  const applyFilters = () => {
    if (draftFilters.dateFrom && draftFilters.dateTo && draftFilters.dateFrom > draftFilters.dateTo) {
      setDateError('Đến ngày phải lớn hơn hoặc bằng Từ ngày.')
      return false
    }
    setDateError('')
    const params = new URLSearchParams()
    if (draftFilters.q.trim()) params.set('q', draftFilters.q.trim())
    if (draftFilters.dateFrom) params.set('dateFrom', draftFilters.dateFrom)
    if (draftFilters.dateTo) params.set('dateTo', draftFilters.dateTo)
    setSearchParams(params)
    return true
  }

  const clearFilters = () => {
    setDraftFilters({ q: '', dateFrom: `${new Date().getFullYear()}-01-01`, dateTo: today })
    setDateError('')
    setSearchParams({ dateFrom: `${new Date().getFullYear()}-01-01`, dateTo: today })
  }

  const mobileSearchContent = ({ close }) => (
    <div className="th-mobile-search-form">
      <label className="th-mobile-search-form__field">
        <span>Tên bảng kiểm</span>
        <div className="th-mobile-search-form__search">
          <SearchOutlined aria-hidden="true" />
          <input
            data-mobile-search-autofocus="true"
            value={draftFilters.q}
            onChange={event => setDraftFilters(current => ({ ...current, q: event.target.value }))}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                const valid = applyFilters()
                if (valid) close()
              }
            }}
            placeholder="Tìm tên bảng kiểm..."
            aria-label="Tìm tên bảng kiểm"
          />
        </div>
      </label>
      <div className="th-mobile-search-form__grid">
        <label className="th-mobile-search-form__field"><span>Từ ngày</span><input type="date" value={draftFilters.dateFrom} onChange={event => setDraftFilters(current => ({ ...current, dateFrom: event.target.value }))} aria-label="Từ ngày" /></label>
        <label className="th-mobile-search-form__field"><span>Đến ngày</span><input type="date" value={draftFilters.dateTo} onChange={event => setDraftFilters(current => ({ ...current, dateTo: event.target.value }))} aria-label="Đến ngày" /></label>
      </div>
      {dateError && <p className="th-mobile-search-form__error" role="alert">{dateError}</p>}
      <div className="th-mobile-search-form__actions">
        <button type="button" className="th-mobile-search-form__clear" onClick={() => { clearFilters(); close() }}>Xóa bộ lọc</button>
        <button type="button" className="th-mobile-search-form__apply" onClick={() => { const valid = applyFilters(); if (valid !== false) close() }}>Áp dụng</button>
      </div>
    </div>
  )

  const openDetail = async (submissionId) => {
    setActiveSubmissionId(submissionId)
    setDetailLoading(true)
    setDetail({})
    try {
      setDetail(apiData(await myCompetencyApi.getSkillEvaluation(submissionId), null))
    } catch (error) {
      setDetail(null)
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const openAttemptHistory = attempts => {
    const sortedAttempts = [...attempts].sort((left, right) => (
      new Date(right.evaluatedAt || 0).getTime() - new Date(left.evaluatedAt || 0).getTime()
    ))
    setDetailAttempts(sortedAttempts)
    if (sortedAttempts[0]?.submissionId != null) openDetail(sortedAttempts[0].submissionId)
  }

  const closeDetail = () => {
    setDetail(null)
    setDetailAttempts([])
    setActiveSubmissionId(null)
  }

  return (
    <AppShell
      title="Danh sách bảng kiểm đã chấm"
      className="staff-competency-list-shell"
      back={{ to: '/staff/competency', label: 'Tuân thủ quy trình, quy định' }}
      breadcrumbs={[{ label: 'Tuân thủ quy trình, quy định', link: '/staff/competency' }, { label: 'Danh sách bảng kiểm' }]}
      mobileSearch={{
        title: 'Tìm kiếm bảng kiểm',
        ariaLabel: 'Mở tìm kiếm bảng kiểm',
        activeCount: Number(Boolean(query))
          + Number(Boolean(fromDate && fromDate !== `${new Date().getFullYear()}-01-01`))
          + Number(Boolean(toDate && toDate !== today)),
        renderContent: mobileSearchContent,
      }}
    >
      <div className="sc-page">
        <section className="sc-toolbar admin-control-toolbar" aria-label="Bộ lọc tuân thủ cá nhân">
          <div className="admin-control-toolbar__main">
            <div className="admin-control-toolbar__controls">
              <div className="sc-search-input admin-control-toolbar__search"><SearchOutlined aria-hidden="true" /><input value={draftFilters.q} onChange={event => setDraftFilters(current => ({ ...current, q: event.target.value }))} onKeyDown={event => event.key === 'Enter' && applyFilters()} placeholder="Tìm tên bảng kiểm..." aria-label="Tìm tên bảng kiểm" /></div>
              <button
                type="button"
                className={`admin-control-toolbar__filter-trigger${isFilterOpen ? ' is-open' : ''}`}
                aria-controls="staff-compliance-filter-panel"
                aria-expanded={isFilterOpen}
                onClick={() => setIsFilterOpen(current => !current)}
              >
                <FilterOutlined aria-hidden="true" />
                Bộ lọc
                <span className="admin-control-toolbar__filter-count">{Number(Boolean(fromDate)) + Number(Boolean(toDate))}</span>
              </button>
            </div>
          </div>
          {isFilterOpen && (
            <div id="staff-compliance-filter-panel" className="sc-toolbar__filter-panel admin-control-toolbar__panel">
              <label className="admin-control-toolbar__field">
                <span>Từ ngày</span>
                <input type="date" value={draftFilters.dateFrom} max={draftFilters.dateTo || today} onChange={event => setDraftFilters(current => ({ ...current, dateFrom: event.target.value }))} />
              </label>
              <label className="admin-control-toolbar__field">
                <span>Đến ngày</span>
                <input type="date" value={draftFilters.dateTo} min={draftFilters.dateFrom || undefined} max={today} onChange={event => setDraftFilters(current => ({ ...current, dateTo: event.target.value }))} />
              </label>
              <div className="sc-toolbar__filter-actions">
                <button type="button" className="sc-filter__btn sc-filter__btn--secondary" onClick={clearFilters}>Xóa bộ lọc</button>
                <button type="button" className="sc-filter__btn sc-filter__btn--primary" onClick={applyFilters}>Áp dụng</button>
              </div>
              {dateError && <span className="sc-filter-error" role="alert">{dateError}</span>}
            </div>
          )}
        </section>
        <section className="sc-personal-metrics sc-personal-metrics--compact" aria-label="Tổng quan tuân thủ">
          <article className="sc-personal-metric sc-personal-metric--primary"><span className="sc-personal-metric__icon"><SafetyCertificateOutlined /></span><div><span>Tỷ lệ tuân thủ chung</span><strong>{formatNumber(totals.rate)}%</strong></div></article>
          <article className="sc-personal-metric"><span className="sc-personal-metric__icon"><CheckCircleFilled /></span><div><span>Số lượt đạt</span><strong>{totals.passed}</strong></div></article>
          <article className="sc-personal-metric"><span className="sc-personal-metric__icon"><SafetyCertificateOutlined /></span><div><span>Tổng lượt được chấm</span><strong>{totals.evaluated}</strong></div></article>
        </section>
        <div className="sc-content">
          {loading ? <LoadingState /> : !(visibleItems.length) ? <EmptyState>{query ? 'Không có bảng kiểm phù hợp.' : 'Chưa có lượt đánh giá trong khoảng thời gian này.'}</EmptyState> : (
            <div className="sc-table-wrapper"><table className="sc-table admin-table-uppercase">
              <colgroup>
                <col className="sc-table__process-col" />
                <col className="sc-table__attempt-col" />
                <col className="sc-table__rate-col" />
                <col className="sc-table__action-col" />
              </colgroup>
              <thead><tr><th>Quy trình</th><th>Số lượt đạt/tổng lượt</th><th>Tỷ lệ tuân thủ</th><th>Hành động</th></tr></thead><tbody>
              {visibleItems.map(item => <tr key={item.formId}>
                <td data-label="Quy trình"><strong className="sc-table__process-name">{item.formName}</strong></td>
                <td data-label="Đạt / Tổng"><span className="sc-table__metric">{item.passCount || 0}/{item.evaluationCount || 0}</span></td>
                <td data-label="Tỷ lệ"><strong className={`sc-table__rate${Number(item.passRate || 0) < 50 ? ' is-low' : ''}`}>{formatNumber(item.passRate || 0)}%</strong></td>
                <td data-label="Chi tiết"><div className="sc-compliance-attempts admin-table-actions">{(item.attempts || []).length > 0 && <button type="button" className="sc-view-btn admin-table-action admin-table-action--icon admin-table-action--primary" title={`Xem chi tiết ${item.evaluationCount || item.attempts.length} lượt đánh giá`} aria-label={`Xem chi tiết ${item.evaluationCount || item.attempts.length} lượt đánh giá ${item.formName}`} onClick={() => openAttemptHistory(item.attempts)}><EyeOutlined /></button>}</div></td>
              </tr>)}
            </tbody></table></div>
          )}
        </div>
      </div>
      {detail !== null ? <div className="sc-detail-backdrop" role="presentation" onMouseDown={closeDetail}><section className="sc-detail-dialog" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
        <header className="sc-detail-dialog__header"><div><span>CHI TIẾT LƯỢT ĐÁNH GIÁ</span><h3>{detail?.title || detailAttempts[0]?.formName || 'Tuân thủ quy trình'}</h3></div><button type="button" onClick={closeDetail} aria-label="Đóng"><CloseOutlined /></button></header>
        {detailLoading ? <div className="sc-detail-dialog__loading"><LoadingState label="Đang tải..." /></div> : <div className="sc-detail-dialog__body">
          {detailAttempts.length > 1 && <section className="sc-attempt-history" aria-label="Lịch sử các lượt đánh giá"><h4>Lịch sử đánh giá ({detailAttempts.length} lượt)</h4><div>{detailAttempts.map((attempt, index) => <button key={attempt.submissionId} type="button" className={attempt.submissionId === activeSubmissionId ? 'is-active' : ''} onClick={() => openDetail(attempt.submissionId)}><span>Lượt {detailAttempts.length - index}</span><strong>{attempt.evaluatedAt ? new Date(attempt.evaluatedAt).toLocaleDateString('vi-VN') : 'Chưa có ngày'}</strong><small>{attempt.passed ? 'Đạt' : 'Chưa đạt'} · {formatScore10(attempt.score)}/10</small></button>)}</div></section>}
          <div className="sc-detail-metrics"><article className="sc-personal-metric"><span className="sc-personal-metric__icon">{detail?.result === 'PASSED' ? <CheckCircleFilled /> : <WarningFilled />}</span><div><span>Kết quả</span><strong>{detail?.result === 'PASSED' ? 'Đạt' : 'Chưa đạt'}</strong></div></article><article className="sc-personal-metric"><div><span>Điểm</span><strong>{formatScore10(detail?.convertedScore)}/10</strong></div></article></div>
          <div className="sc-detail-breakdown"><h4>Câu trả lời và tiêu chí</h4>{(detail?.scoreBreakdown || []).map(item => {
            const score10 = convertToTenPointScale(item.weightedScore, detail?.maxScore)
            const maxScore10 = convertToTenPointScale(item.maxScore, detail?.maxScore)
            return <article key={item.questionKey}><div><strong>{item.code} · {item.title}</strong></div><small>Điểm (thang 10): {formatScore10(score10)} / {formatScore10(maxScore10)}</small></article>
          })}</div>
        </div>}
      </section></div> : null}
    </AppShell>
  )
}
