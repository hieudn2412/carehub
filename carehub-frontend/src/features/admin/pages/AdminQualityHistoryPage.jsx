import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircleOutlined,
  EyeOutlined,
  LoadingOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AdminHeader from '../components/AdminHeader'
import AdminSidebar from '../components/AdminSidebar'
import { adminApi } from '../api/adminApi'
import { getChecklistDisplayCode } from '../utils/formCode.js'
import '../styles/AdminQualityHistoryPage.css'

const RESULT_OPTIONS = [
  { value: '', label: 'Tất cả kết quả' },
  { value: 'PASSED', label: 'Đạt' },
  { value: 'FAILED_SCORE', label: 'Không đạt điểm' },
  { value: 'FAILED_CRITICAL', label: 'Không đạt tiêu chí trọng yếu' },
]

function getPageContent(response) {
  const data = response?.data?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  return []
}

function getPageTotal(response, fallback = 0) {
  const total = Number(response?.data?.data?.totalElements)
  return Number.isFinite(total) ? total : fallback
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
  return `${numberValue.toFixed(numberValue % 1 === 0 ? 0 : 1)}%`
}

function getHistoryErrorMessage(error) {
  const backendMessage = error?.response?.data?.message
  if (backendMessage) return backendMessage
  return 'Không thể tải lịch sử đánh giá. Vui lòng thử lại.'
}

function AdminQualityHistoryPage() {
  const navigate = useNavigate()
  const [submissions, setSubmissions] = useState([])
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [search, setSearch] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let alive = true

    adminApi.getFormSubmissions({
      page: 0,
      size: 100,
      status: 'SUBMITTED',
    })
      .then((response) => {
        if (!alive) return
        const nextSubmissions = getPageContent(response)
        setSubmissions(nextSubmissions)
        setTotalElements(getPageTotal(response, nextSubmissions.length))
      })
      .catch((error) => {
        if (!alive) return
        setErrorMessage(getHistoryErrorMessage(error))
        setSubmissions([])
        setTotalElements(0)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [refreshKey])

  const filteredSubmissions = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return submissions.filter((submission) => {
      const searchableText = [
        submission.title,
        submission.formCode,
        getChecklistDisplayCode(submission.formCode),
        submission.subject?.fullName,
        submission.subject?.employeeCode,
        submission.subject?.departmentName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch = !keyword || searchableText.includes(keyword)
      const matchesResult = !resultFilter || submission.result === resultFilter
      return matchesSearch && matchesResult
    })
  }, [resultFilter, search, submissions])

  const stats = useMemo(() => {
    const passed = submissions.filter((item) => item.result === 'PASSED').length
    const failed = submissions.filter((item) =>
      ['FAILED_SCORE', 'FAILED_CRITICAL'].includes(item.result),
    ).length
    const scoredItems = submissions
      .map((item) => Number(item.convertedScore))
      .filter((score) => Number.isFinite(score))
    const averageScore = scoredItems.length
      ? scoredItems.reduce((sum, score) => sum + score, 0) / scoredItems.length
      : null

    return {
      total: totalElements || submissions.length,
      passed,
      failed,
      averageScore,
    }
  }, [submissions, totalElements])

  return (
    <div className="dashboard-layout admin-quality-history-page">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader
          breadcrumbs={[
            { label: 'Chất lượng' },
            { label: 'Lịch sử đánh giá' },
          ]}
        />

        <main className="admin-quality-history">
          <section className="admin-quality-history__hero">
            <div>
              <span className="admin-quality-history__eyebrow">Kết quả checklist</span>
              <h1>Lịch sử đánh giá chất lượng</h1>
              <p>Theo dõi các checklist manager đã hoàn thành và gửi về cho admin.</p>
            </div>
            <button
              type="button"
              className="admin-quality-history__refresh"
              onClick={() => {
                setLoading(true)
                setErrorMessage('')
                setRefreshKey((value) => value + 1)
              }}
              disabled={loading}
            >
              {loading ? <LoadingOutlined /> : <ReloadOutlined />}
              Làm mới
            </button>
          </section>

          <section className="admin-quality-history__stats" aria-label="Tổng quan lịch sử đánh giá">
            <article className="admin-quality-history__stat">
              <span>Tổng phiếu đã nộp</span>
              <strong>{stats.total}</strong>
              <small>Phiếu manager đã gửi</small>
            </article>
            <article className="admin-quality-history__stat admin-quality-history__stat--success">
              <span>Đạt</span>
              <strong>{stats.passed}</strong>
              <small>Checklist đạt yêu cầu</small>
            </article>
            <article className="admin-quality-history__stat admin-quality-history__stat--danger">
              <span>Không đạt</span>
              <strong>{stats.failed}</strong>
              <small>Cần kiểm tra lại</small>
            </article>
            <article className="admin-quality-history__stat">
              <span>Điểm trung bình</span>
              <strong>{formatScore(stats.averageScore)}</strong>
              <small>Tính theo điểm quy đổi</small>
            </article>
          </section>

          <section className="admin-quality-history__toolbar">
            <label className="admin-quality-history__search">
              <SearchOutlined />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo checklist, mã form, nhân viên..."
              />
            </label>
            <select
              value={resultFilter}
              onChange={(event) => setResultFilter(event.target.value)}
              aria-label="Lọc theo kết quả"
            >
              {RESULT_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </section>

          {errorMessage && (
            <div className="admin-quality-history__alert" role="alert">
              <WarningOutlined />
              {errorMessage}
            </div>
          )}

          <section className="admin-quality-history__table-card">
            {loading ? (
              <div className="admin-quality-history__state">
                <LoadingOutlined />
                <span>Đang tải lịch sử đánh giá...</span>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="admin-quality-history__state">
                <CheckCircleOutlined />
                <span>Chưa có kết quả checklist phù hợp.</span>
              </div>
            ) : (
              <div className="admin-quality-history__table-wrap">
                <table className="admin-quality-history__table">
                  <thead>
                    <tr>
                      <th>Checklist</th>
                      <th>Nhân viên được đánh giá</th>
                      <th>Ngày nộp</th>
                      <th>Điểm</th>
                      <th>Kết quả</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.title || 'Chưa có tiêu đề'}</strong>
                          <span>{getChecklistDisplayCode(item.formCode)}</span>
                        </td>
                        <td>
                          <strong>{item.subject?.fullName || 'Chưa có tên'}</strong>
                          <span>{item.subject?.employeeCode || 'Chưa có mã nhân viên'}</span>
                        </td>
                        <td>{formatDateTime(item.submittedAt || item.updatedAt)}</td>
                        <td className="admin-quality-history__score">
                          {formatScore(item.convertedScore)}
                        </td>
                        <td>
                          <span className={`admin-quality-history__badge admin-quality-history__badge--${getResultClass(item.result)}`}>
                            {getResultLabel(item.result)}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-quality-history__detail-button"
                            onClick={() => navigate(`/admin/quality/history/${item.id}`)}
                          >
                            <EyeOutlined />
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

export default AdminQualityHistoryPage
