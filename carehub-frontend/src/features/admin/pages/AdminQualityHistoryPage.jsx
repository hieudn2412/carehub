import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  LoadingOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import { adminApi } from '../api/adminApi'
import { getChecklistDisplayCode } from '../utils/formCode.js'
import '../styles/AdminQualityHistoryPage.css'

const HISTORY_PAGE_SIZE = 12
const VERSION_OPTIONS = [
  { value: '', label: 'Tất cả phiên bản' },
  { value: 'PUBLISHED', label: 'Đang hoạt động' },
  { value: 'RETIRED', label: 'Đã ngừng' },
]

function getPageData(response) {
  const data = response?.data?.data || {}
  return {
    content: Array.isArray(data.content) ? data.content : [],
    page: Number(data.page) || 0,
    totalElements: Number(data.totalElements) || 0,
    totalPages: Number(data.totalPages) || 0,
  }
}

function useDebouncedValue(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timer)
  }, [delay, value])

  return debouncedValue
}

function getVersionStatusLabel(status) {
  if (status === 'PUBLISHED') return 'Đang hoạt động'
  if (status === 'RETIRED') return 'Đã ngừng'
  return 'Chưa công bố'
}

function getVersionStatusClass(status) {
  if (status === 'PUBLISHED') return 'active'
  if (status === 'RETIRED') return 'retired'
  return 'draft'
}

function formatDate(value) {
  if (!value) return 'Chưa có ngày công bố'
  return new Intl.DateTimeFormat('vi-VN', {
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

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || fallback
}

function AdminQualityHistoryPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedFormId = searchParams.get('formId')
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebouncedValue(keyword.trim(), 300)
  const [page, setPage] = useState(0)
  const [historyData, setHistoryData] = useState({ content: [], page: 0, totalElements: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedForm, setSelectedForm] = useState(null)
  const [versions, setVersions] = useState([])
  const [versionFilter, setVersionFilter] = useState('')
  const [versionsLoading, setVersionsLoading] = useState(Boolean(requestedFormId))
  const [versionsError, setVersionsError] = useState('')

  useEffect(() => {
    let alive = true

    adminApi.getFormHistory({
      keyword: debouncedKeyword || undefined,
      page,
      size: HISTORY_PAGE_SIZE,
    })
      .then((response) => {
        if (!alive) return
        const nextData = getPageData(response)
        if (nextData.totalPages > 0 && page >= nextData.totalPages) {
          setPage(nextData.totalPages - 1)
          return
        }
        setHistoryData(nextData)
        setErrorMessage('')
      })
      .catch((error) => {
        if (!alive) return
        setHistoryData({ content: [], page: 0, totalElements: 0, totalPages: 0 })
        setErrorMessage(getErrorMessage(error, 'Không thể tải kho lịch sử quy trình.'))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [debouncedKeyword, page, refreshKey])

  useEffect(() => {
    if (!requestedFormId) {
      return undefined
    }

    let alive = true
    const formInPage = historyData.content.find((item) => String(item.formId) === String(requestedFormId))

    Promise.all([
      formInPage
        ? Promise.resolve({ data: { data: formInPage } })
        : adminApi.getFormHistoryById(requestedFormId),
      adminApi.getFormHistoryVersions(requestedFormId),
    ])
      .then(([formResponse, versionsResponse]) => {
        if (!alive) return
        const formData = formResponse?.data?.data || null
        setSelectedForm(formData?.formId ? formData : {
          formId: formData?.id,
          code: formData?.code,
          title: formData?.title,
        })
        setVersions(Array.isArray(versionsResponse?.data?.data) ? versionsResponse.data.data : [])
        setVersionsError('')
      })
      .catch((error) => {
        if (!alive) return
        setSelectedForm(null)
        setVersions([])
        setVersionsError(getErrorMessage(error, 'Không thể tải các phiên bản của quy trình.'))
      })
      .finally(() => {
        if (alive) setVersionsLoading(false)
      })

    return () => {
      alive = false
    }
  }, [historyData.content, requestedFormId, refreshKey])

  const filteredVersions = useMemo(() => (
    versions.filter((version) => !versionFilter || version.status === versionFilter)
  ), [versionFilter, versions])

  const selectForm = (form) => {
    setVersionFilter('')
    setVersionsLoading(true)
    setSearchParams({ formId: String(form.formId) })
  }

  const clearSelectedForm = () => {
    setSelectedForm(null)
    setVersions([])
    setVersionFilter('')
    setSearchParams({})
  }

  return (
    <AppShell
      className="admin-quality-history-page"
      back={requestedFormId ? { label: 'Quay lại', onClick: clearSelectedForm } : undefined}
      breadcrumbs={[
        { label: 'Chất lượng' },
        { label: 'Lịch sử đánh giá' },
      ]}
    >
        <div className="admin-quality-history admin-quality-history--archive">
          {!requestedFormId && (
            <section className="aqh-search-hero">
              <div className="aqh-search-hero__copy">
                <span>Kho lưu trữ quy trình</span>
                <h1>Lịch sử đánh giá</h1>
                <p>Tìm quy trình đã công bố để xem các phiên bản và kết quả đánh giá.</p>
              </div>
              <label className="aqh-main-search">
                <SearchOutlined />
                <input
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value)
                    setPage(0)
                    setLoading(true)
                  }}
                  placeholder="Tìm theo tên hoặc mã quy trình..."
                />
              </label>
            </section>
          )}

          {!requestedFormId && errorMessage && (
            <section className="aqh-error-state" role="alert">
              <WarningOutlined />
              <strong>Không thể tải lịch sử đánh giá</strong>
              <span>{errorMessage}</span>
              <button onClick={() => { setLoading(true); setErrorMessage(''); setRefreshKey((value) => value + 1) }} type="button">
                <ReloadOutlined /> Thử lại
              </button>
            </section>
          )}

          {!requestedFormId && loading ? (
            <section className="aqh-empty-state">
              <LoadingOutlined spin />
              <span>Đang tải kho lịch sử quy trình...</span>
            </section>
          ) : !requestedFormId && !errorMessage && historyData.content.length === 0 ? (
            <section className="aqh-empty-state">
              <CheckCircleOutlined />
              <strong>Không tìm thấy quy trình phù hợp</strong>
              <span>Hãy thử từ khóa khác hoặc kiểm tra quy trình đã được công bố.</span>
            </section>
          ) : !requestedFormId ? (
            <>
              <section className="aqh-version-toolbar">
                <div>
                  <strong>{historyData.totalElements}</strong> quy trình có lịch sử đánh giá
                </div>
              </section>

              <section className="aqh-folder-grid" aria-label="Danh sách quy trình">
                {historyData.content.map((form) => (
                  <button
                    className="aqh-folder-card"
                    key={form.formId}
                    onClick={() => selectForm(form)}
                    type="button"
                  >
                    <span className="aqh-folder-card__top">
                      <span className="aqh-folder-card__icon"><FileTextOutlined /></span>
                      <BookOutlined className="aqh-folder-card__bookmark" />
                    </span>
                    <span className="aqh-folder-card__code">{getChecklistDisplayCode(form.code)}</span>
                    <strong>{form.title}</strong>
                    <span className="aqh-folder-card__divider" />
                    <span className="aqh-folder-card__stats">
                      <span><FileTextOutlined /> {form.versionCount} phiên bản</span>
                      <span>{form.submissionCount} lượt đánh giá</span>
                    </span>
                  </button>
                ))}
              </section>

              {historyData.totalPages > 1 && (
                <footer className="aqh-pagination aqh-pagination--archive">
                  <span>Trang {historyData.page + 1}/{historyData.totalPages}</span>
                  <div className="aqh-pagination__controls">
                    <button disabled={page <= 0} onClick={() => { setLoading(true); setPage((value) => value - 1) }} type="button">Trước</button>
                    <button
                      disabled={page >= historyData.totalPages - 1}
                      onClick={() => { setLoading(true); setPage((value) => value + 1) }}
                      type="button"
                    >Sau</button>
                  </div>
                </footer>
              )}
            </>
          ) : versionsLoading ? (
            <section className="aqh-empty-state"><LoadingOutlined spin /><span>Đang tải các phiên bản...</span></section>
          ) : versionsError ? (
            <section className="aqh-error-state" role="alert">
              <WarningOutlined />
              <strong>Không thể tải phiên bản</strong>
              <span>{versionsError}</span>
              <button onClick={() => { setVersionsLoading(true); setVersionsError(''); setRefreshKey((value) => value + 1) }} type="button"><ReloadOutlined /> Thử lại</button>
            </section>
          ) : (
            <>
              <section className="aqh-version-toolbar aqh-version-toolbar--selected">
                <div>
                  <span className="aqh-form-code">{getChecklistDisplayCode(selectedForm?.code)}</span>
                  <h2>{selectedForm?.title || 'Quy trình'}</h2>
                  <p>{versions.length} phiên bản có lịch sử</p>
                </div>
                <label>
                  <span className="sr-only">Lọc trạng thái phiên bản</span>
                  <select value={versionFilter} onChange={(event) => setVersionFilter(event.target.value)}>
                    {VERSION_OPTIONS.map((option) => (
                      <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </section>

              {filteredVersions.length === 0 ? (
                <section className="aqh-empty-state"><span>Không có phiên bản phù hợp với bộ lọc.</span></section>
              ) : (
                <section className="aqh-version-grid" aria-label="Danh sách phiên bản quy trình">
                  {filteredVersions.map((version) => (
                    <button
                      className="aqh-version-card aqh-version-card--history"
                      key={version.versionId}
                      onClick={() => navigate(`/admin/quality/history/forms/${formIdOrFallback(selectedForm, requestedFormId)}/versions/${version.versionId}`)}
                      type="button"
                    >
                      <div className="aqh-version-card__top">
                        <span className="aqh-version-number">Phiên bản v{version.versionNumber}</span>
                        <span className={`aqh-version-status aqh-version-status--${getVersionStatusClass(version.status)}`}>
                          {getVersionStatusLabel(version.status)}
                        </span>
                      </div>
                      <h2>{version.title || selectedForm?.title}</h2>
                      <p>Công bố: {formatDate(version.publishedAt)}</p>
                      <div className="aqh-version-card__metrics">
                        <span><small>Tổng lượt</small><strong>{version.total}</strong></span>
                        <span><small>Đạt</small><strong>{version.passed}</strong></span>
                        <span><small>Chưa đạt</small><strong>{version.failed}</strong></span>
                        <span><small>Điểm TB</small><strong>{formatScore(version.averageConvertedScore)}</strong></span>
                      </div>
                    </button>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
    </AppShell>
  )
}

function formIdOrFallback(form, fallback) {
  return form?.formId || form?.id || fallback
}

export default AdminQualityHistoryPage
