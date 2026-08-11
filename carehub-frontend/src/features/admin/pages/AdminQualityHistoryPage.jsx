import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import { adminApi } from '../api/adminApi.js'
import { getChecklistDisplayCode } from '../utils/formCode.js'
import '../styles/AdminQualityHistoryPage.css'

const HISTORY_PAGE_SIZE = 12

function isoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultDates() {
  const today = new Date()
  return {
    dateFrom: `${today.getFullYear()}-01-01`,
    dateTo: isoDate(today),
  }
}

function pageData(response) {
  const data = response?.data?.data || {}
  return {
    content: Array.isArray(data.content) ? data.content : [],
    page: Number(data.page) || 0,
    totalElements: Number(data.totalElements) || 0,
    totalPages: Number(data.totalPages) || 0,
  }
}

function formatPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 'Chưa có dữ liệu'
  return `${number.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

function formatDate(value) {
  if (!value) return 'Chưa có lượt đánh giá'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(value))
}

function statusLabel(status) {
  return status === 'PUBLISHED' ? 'Đang hoạt động' : 'Đã ngừng'
}

function targetLabel(source, role) {
  if (role === 'manager' && source === 'DEPARTMENT') return 'Mục tiêu khoa'
  if (source === 'HOSPITAL') return 'Mục tiêu bệnh viện'
  if (source === 'DEPARTMENT') return 'Mục tiêu khoa'
  return 'Mặc định hệ thống'
}

function AdminQualityHistoryPage({ role = 'admin' }) {
  const navigate = useNavigate()
  const basePath = role === 'manager' ? '/manager/quality/history' : '/admin/quality/history'
  const defaults = useMemo(() => defaultDates(), [])
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedFormId = searchParams.get('formId') || ''
  const page = Math.max(Number(searchParams.get('page')) || 0, 0)
  const dateFrom = searchParams.get('dateFrom') || defaults.dateFrom
  const dateTo = searchParams.get('dateTo') || defaults.dateTo
  const keyword = searchParams.get('keyword') || ''
  const [keywordInput, setKeywordInput] = useState(keyword)
  const [history, setHistory] = useState({ content: [], page: 0, totalElements: 0, totalPages: 0 })
  const [selectedForm, setSelectedForm] = useState(null)
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const updateQuery = (changes) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      Object.entries(changes).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) next.delete(key)
        else next.set(key, String(value))
      })
      return next
    }, { replace: true })
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (keywordInput.trim() !== keyword) updateQuery({ keyword: keywordInput.trim(), page: 0 })
    }, 300)
    return () => window.clearTimeout(timer)
    // updateQuery intentionally uses current URL state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, keywordInput])

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    adminApi.getFormHistory({
      keyword: keyword || undefined,
      dateFrom,
      dateTo,
      page,
      size: HISTORY_PAGE_SIZE,
    })
      .then((response) => {
        if (!alive) return
        const next = pageData(response)
        if (next.totalPages > 0 && page >= next.totalPages) {
          updateQuery({ page: next.totalPages - 1 })
          return
        }
        setHistory(next)
      })
      .catch((requestError) => {
        if (!alive) return
        setHistory({ content: [], page: 0, totalElements: 0, totalPages: 0 })
        setError(requestError?.response?.data?.message || 'Không thể tải lịch sử đánh giá.')
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
    // updateQuery intentionally excluded to keep request dependencies stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, keyword, page, refreshKey])

  useEffect(() => {
    if (!requestedFormId) {
      setSelectedForm(null)
      setVersions([])
      return undefined
    }
    let alive = true
    setLoading(true)
    setError('')
    Promise.all([
      adminApi.getFormHistoryById(requestedFormId),
      adminApi.getFormHistoryVersions(requestedFormId, { dateFrom, dateTo }),
    ])
      .then(([formResponse, versionsResponse]) => {
        if (!alive) return
        setSelectedForm(formResponse?.data?.data || null)
        setVersions(Array.isArray(versionsResponse?.data?.data) ? versionsResponse.data.data : [])
      })
      .catch((requestError) => {
        if (!alive) return
        setSelectedForm(null)
        setVersions([])
        setError(requestError?.response?.data?.message || 'Không thể tải các phiên bản của bảng kiểm.')
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [dateFrom, dateTo, refreshKey, requestedFormId])

  const selectForm = (form) => updateQuery({ formId: form.formId })
  const clearForm = () => updateQuery({ formId: null })
  const versionQuery = new URLSearchParams({ dateFrom, dateTo }).toString()

  return (
    <AppShell
      className="admin-quality-history-page"
      back={requestedFormId ? { label: 'Quay lại', onClick: clearForm } : undefined}
      breadcrumbs={[{ label: 'Chất lượng' }, { label: 'Lịch sử đánh giá' }]}
    >
      <main className="admin-quality-history admin-quality-history--archive">
        <section className="aqh-history-heading">
          <div>
            <span>LỊCH SỬ ĐÁNH GIÁ</span>
            <h1>{requestedFormId ? selectedForm?.title || 'Bảng kiểm' : 'Danh sách bảng kiểm'}</h1>
            <p>{role === 'manager' ? 'Số liệu nhân viên thuộc khoa của bạn.' : 'Số liệu trên toàn bệnh viện.'}</p>
          </div>
          {!requestedFormId && <strong>{history.totalElements} bảng kiểm</strong>}
        </section>

        <section className="aqh-history-toolbar">
          {!requestedFormId && (
            <label className="aqh-main-search">
              <SearchOutlined />
              <input value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} placeholder="Tìm theo tên hoặc mã quy trình..." />
            </label>
          )}
          <label><span>Từ ngày</span><input type="date" value={dateFrom} max={dateTo} onChange={(event) => updateQuery({ dateFrom: event.target.value, page: 0 })} /></label>
          <label><span>Đến ngày</span><input type="date" value={dateTo} min={dateFrom} onChange={(event) => updateQuery({ dateTo: event.target.value, page: 0 })} /></label>
          <button type="button" onClick={() => updateQuery({ dateFrom: defaults.dateFrom, dateTo: defaults.dateTo, page: 0 })}><ReloadOutlined /> Năm hiện tại</button>
        </section>

        {error ? (
          <section className="aqh-error-state" role="alert"><WarningOutlined /><strong>Không thể tải dữ liệu</strong><span>{error}</span><button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Thử lại</button></section>
        ) : loading ? (
          <section className="aqh-history-skeleton" aria-label="Đang tải">{Array.from({ length: 6 }, (_, index) => <span key={index} />)}</section>
        ) : requestedFormId ? (
          versions.length === 0 ? (
            <section className="aqh-empty-state"><CheckCircleOutlined /><strong>Chưa có phiên bản đã công bố</strong></section>
          ) : (
            <section className="aqh-version-grid aqh-version-grid--metrics" aria-label="Danh sách phiên bản">
              {versions.map((version) => {
                const hasData = Number(version.total) > 0
                return (
                  <button
                    className="aqh-version-card aqh-version-card--history"
                    key={version.versionId}
                    onClick={() => navigate(`${basePath}/forms/${requestedFormId}/versions/${version.versionId}?${versionQuery}`)}
                    type="button"
                  >
                    <div className="aqh-version-card__top"><span className="aqh-version-number">Phiên bản v{version.versionNumber}</span><span className={`aqh-version-status aqh-version-status--${version.status === 'PUBLISHED' ? 'active' : 'retired'}`}>{statusLabel(version.status)}</span></div>
                    <h2>{version.title || selectedForm?.title}</h2>
                    <p>Công bố: {formatDate(version.publishedAt)}</p>
                    <div className="aqh-version-card__metrics">
                      <span><small>Lượt giám sát</small><strong>{version.total}</strong></span>
                      <span><small>Đạt / Tổng</small><strong>{version.passed}/{version.total}</strong></span>
                      <span><small>Tỷ lệ tuân thủ</small><strong>{hasData ? formatPercent(version.complianceRate) : 'Chưa có dữ liệu'}</strong></span>
                    </div>
                  </button>
                )
              })}
            </section>
          )
        ) : history.content.length === 0 ? (
          <section className="aqh-empty-state"><CheckCircleOutlined /><strong>Không có bảng kiểm phù hợp</strong><span>Hãy thay đổi từ khóa hoặc khoảng ngày.</span></section>
        ) : (
          <>
            <section className="aqh-checklist-history-grid" aria-label="Danh sách bảng kiểm">
              {history.content.map((form) => {
                const hasData = Number(form.monitoringCount) > 0
                return (
                  <button className="aqh-checklist-history-card" key={form.formId} onClick={() => selectForm(form)} type="button">
                    <span className="aqh-checklist-history-card__code">{getChecklistDisplayCode(form.code)}</span>
                    <h2>{form.title}</h2>
                    <p>{form.versionCount} phiên bản · Gần nhất: {formatDate(form.lastSubmittedAt)}</p>
                    <dl>
                      <div><dt>Lượt giám sát</dt><dd>{form.monitoringCount}</dd></div>
                      <div><dt>Đạt / Tổng</dt><dd>{form.passedCount}/{form.monitoringCount}</dd></div>
                      <div><dt>Tỷ lệ tuân thủ</dt><dd>{hasData ? formatPercent(form.complianceRate) : 'Chưa có dữ liệu'}</dd></div>
                      <div><dt>{targetLabel(form.targetSource, role)}</dt><dd>{formatPercent(form.targetPercent)}</dd></div>
                    </dl>
                  </button>
                )
              })}
            </section>
            {history.totalPages > 1 && (
              <footer className="aqh-pagination aqh-pagination--archive">
                <span>Trang {history.page + 1}/{history.totalPages}</span>
                <div className="aqh-pagination__controls">
                  <button disabled={page <= 0} onClick={() => updateQuery({ page: page - 1 })} type="button">Trước</button>
                  <button disabled={page >= history.totalPages - 1} onClick={() => updateQuery({ page: page + 1 })} type="button">Sau</button>
                </div>
              </footer>
            )}
          </>
        )}
      </main>
    </AppShell>
  )
}

export default AdminQualityHistoryPage
