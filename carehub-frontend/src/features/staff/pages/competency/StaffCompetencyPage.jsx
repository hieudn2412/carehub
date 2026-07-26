import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircleFilled, CloseOutlined, EyeOutlined, SafetyCertificateOutlined, WarningFilled } from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import LoadingState from '../../../../shared/components/LoadingState.jsx'
import EmptyState from '../../../../shared/components/EmptyState.jsx'
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
  const { showToast } = useToast()
  const today = localToday()
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear()}-01-01`)
  const [toDate, setToDate] = useState(today)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

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
    <AppShell breadcrumbs={[{ label: 'Tuân thủ quy trình, quy định' }]}>
      <div className="sc-page">
        <div className="sc-header">
          <div className="sc-header__title-row"><SafetyCertificateOutlined className="sc-header__icon" /><h1 className="sc-header__title">Tuân thủ quy trình, quy định</h1></div>
          <p className="sc-header__desc">Các quy trình bạn đã được đánh giá trong khoảng thời gian đã chọn</p>
          <button type="button" className="sc-filter__btn" onClick={() => navigate('/staff/checklists')}>Thực hiện đánh giá được giao</button>
        </div>
        <div className="sc-filter">
          <label className="sc-filter__label">Từ ngày</label><input type="date" className="sc-filter__input" value={fromDate} onChange={event => setFromDate(event.target.value)} />
          <label className="sc-filter__label">Đến ngày</label><input type="date" className="sc-filter__input" value={toDate} max={today} onChange={event => setToDate(event.target.value)} />
          <button type="button" className="sc-filter__btn" onClick={load}>Áp dụng</button>
        </div>
        <section className="sc-personal-overview">
          <div className="sc-personal-overview__heading"><div><span>TỶ LỆ TUÂN THỦ CHUNG</span><h3>{totals.passed}/{totals.evaluated} – {formatNumber(totals.rate)}%</h3></div></div>
          <div className="sc-personal-metrics">
            <article className="sc-personal-metric"><span className="sc-personal-metric__icon"><CheckCircleFilled /></span><div><span>Số lượt đạt</span><strong>{totals.passed}</strong></div></article>
            <article className="sc-personal-metric"><span className="sc-personal-metric__icon"><SafetyCertificateOutlined /></span><div><span>Tổng lượt được chấm</span><strong>{totals.evaluated}</strong></div></article>
          </div>
        </section>
        <div className="sc-content">
          {loading ? <LoadingState /> : !(data?.items?.length) ? <EmptyState>Chưa có lượt đánh giá trong khoảng thời gian này.</EmptyState> : (
            <div className="sc-table-wrapper"><table className="sc-table"><thead><tr><th>Quy trình</th><th>Số lượt đạt/tổng lượt</th><th>Tỷ lệ tuân thủ</th><th>Chi tiết</th></tr></thead><tbody>
              {data.items.map(item => <tr key={item.formId}>
                <td><strong>{item.formName}</strong></td><td>{item.passCount || 0}/{item.evaluationCount || 0}</td><td><strong>{formatNumber(item.passRate || 0)}%</strong></td>
                <td><div className="sc-compliance-attempts">{(item.attempts || []).map(attempt => <button key={attempt.submissionId} type="button" className="sc-view-btn" title={new Date(attempt.evaluatedAt).toLocaleDateString('vi-VN')} onClick={() => openDetail(attempt.submissionId)}><EyeOutlined /></button>)}</div></td>
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
