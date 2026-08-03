import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircleFilled, CloseOutlined, EyeOutlined, SafetyCertificateOutlined, SearchOutlined, WarningFilled } from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import LoadingState from '../../../../shared/components/LoadingState.jsx'
import EmptyState from '../../../../shared/components/EmptyState.jsx'
import AdminFilterDisclosure from '../../../../shared/components/AdminFilterDisclosure.jsx'
import { myCompetencyApi } from '../../../evaluation/api/myCompetencyApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../../../evaluation/utils/documentQuestionUi.js'
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
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const today = localToday()
  const fromDate = searchParams.get('dateFrom') || `${new Date().getFullYear()}-01-01`
  const toDate = searchParams.get('dateTo') || today
  const query = (searchParams.get('q') || '').trim()
  const [draftFilters, setDraftFilters] = useState({ q: query, dateFrom: fromDate, dateTo: toDate })
  const [dateError, setDateError] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

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
    <div className="sc-mobile-search-form">
      <label>
        <span>Tên bảng kiểm</span>
        <div className="sc-search-input">
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
      <label><span>Từ ngày</span><input type="date" value={draftFilters.dateFrom} onChange={event => setDraftFilters(current => ({ ...current, dateFrom: event.target.value }))} aria-label="Từ ngày" /></label>
      <label><span>Đến ngày</span><input type="date" value={draftFilters.dateTo} onChange={event => setDraftFilters(current => ({ ...current, dateTo: event.target.value }))} aria-label="Đến ngày" /></label>
      {dateError && <span className="sc-filter-error" role="alert">{dateError}</span>}
      <div className="sc-mobile-search-actions">
        <button type="button" className="sc-filter__btn sc-filter__btn--secondary" onClick={() => { clearFilters(); close() }}>Xóa bộ lọc</button>
        <button type="button" className="sc-filter__btn sc-filter__btn--primary" onClick={() => { const valid = applyFilters(); if (valid !== false) close() }}>Áp dụng</button>
      </div>
    </div>
  )

  const openDetail = async (submissionId) => {
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

  return (
    <AppShell
      title="Danh sách bảng kiểm đã chấm"
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
            <div className="sc-search-input"><SearchOutlined aria-hidden="true" /><input value={draftFilters.q} onChange={event => setDraftFilters(current => ({ ...current, q: event.target.value }))} onKeyDown={event => event.key === 'Enter' && applyFilters()} placeholder="Tìm tên bảng kiểm..." aria-label="Tìm tên bảng kiểm" /></div>
            <AdminFilterDisclosure activeCount={Number(Boolean(fromDate)) + Number(Boolean(toDate))}>
              <label className="admin-control-toolbar__field">
                <span>Từ ngày</span>
                <input type="date" value={draftFilters.dateFrom} max={draftFilters.dateTo || today} onChange={event => setDraftFilters(current => ({ ...current, dateFrom: event.target.value }))} />
              </label>
              <label className="admin-control-toolbar__field">
                <span>Đến ngày</span>
                <input type="date" value={draftFilters.dateTo} min={draftFilters.dateFrom || undefined} max={today} onChange={event => setDraftFilters(current => ({ ...current, dateTo: event.target.value }))} />
              </label>
              {dateError && <span className="sc-filter-error" role="alert">{dateError}</span>}
            </AdminFilterDisclosure>
            <button type="button" className="sc-filter__btn sc-filter__btn--primary" onClick={applyFilters}>Áp dụng</button>
            <button type="button" className="sc-filter__btn sc-filter__btn--secondary" onClick={clearFilters}>Xóa bộ lọc</button>
            <button type="button" className="sc-filter__btn sc-filter__btn--secondary" onClick={() => navigate('/staff/checklists')}>
              Thực hiện đánh giá được giao
            </button>
          </div>
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
                <td><strong className="sc-table__process-name">{item.formName}</strong></td>
                <td><span className="sc-table__metric">{item.passCount || 0}/{item.evaluationCount || 0}</span></td>
                <td><strong className={`sc-table__rate${Number(item.passRate || 0) < 50 ? ' is-low' : ''}`}>{formatNumber(item.passRate || 0)}%</strong></td>
                <td><div className="sc-compliance-attempts admin-table-actions">{(item.attempts || []).map(attempt => <button key={attempt.submissionId} type="button" className="sc-view-btn admin-table-action admin-table-action--icon admin-table-action--primary" title={`Xem lượt đánh giá ngày ${new Date(attempt.evaluatedAt).toLocaleDateString('vi-VN')}`} aria-label={`Xem lượt đánh giá ngày ${new Date(attempt.evaluatedAt).toLocaleDateString('vi-VN')}`} onClick={() => openDetail(attempt.submissionId)}><EyeOutlined /></button>)}</div></td>
              </tr>)}
            </tbody></table></div>
          )}
        </div>
      </div>
      {detail !== null ? <div className="sc-detail-backdrop" role="presentation" onMouseDown={() => setDetail(null)}><section className="sc-detail-dialog" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
        <header className="sc-detail-dialog__header"><div><span>CHI TIẾT LƯỢT ĐÁNH GIÁ</span><h3>{detail?.title || 'Tuân thủ quy trình'}</h3></div><button type="button" onClick={() => setDetail(null)} aria-label="Đóng"><CloseOutlined /></button></header>
        {detailLoading ? <div className="sc-detail-dialog__loading"><LoadingState label="Đang tải..." /></div> : <div className="sc-detail-dialog__body">
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
