import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FilterOutlined,
  LoadingOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AdminHeader from '../components/AdminHeader'
import AdminSidebar from '../components/AdminSidebar'
import { adminApi } from '../api/adminApi'
import { getChecklistDisplayCode } from '../utils/formCode.js'
import '../styles/AdminQualityHistoryPage.css'

const RESULT_OPTIONS = [
  { value: '', label: 'Tất cả response' },
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

function getPageTotalPages(response) {
  const totalPages = Number(response?.data?.data?.totalPages)
  return Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1
}

async function fetchAllPages(fetcher, baseParams = {}) {
  const pageSize = 100
  const firstResponse = await fetcher({ ...baseParams, page: 0, size: pageSize })
  const firstContent = getPageContent(firstResponse)
  const totalPages = getPageTotalPages(firstResponse)

  if (totalPages <= 1) return firstContent

  const restResponses = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetcher({ ...baseParams, page: index + 1, size: pageSize }),
    ),
  )

  return [...firstContent, ...restResponses.flatMap(getPageContent)]
}

function getVersionStatusLabel(status) {
  if (status === 'PUBLISHED') return 'Đang hoạt động'
  if (status === 'RETIRED') return 'Đã retired'
  return 'Chưa công bố'
}

function getVersionStatusClass(status) {
  if (status === 'PUBLISHED') return 'active'
  if (status === 'RETIRED') return 'retired'
  return 'draft'
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
  if (!value) return 'Không giới hạn'

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
  const positiveValue = Math.max(numberValue, 0)
  const roundedValue = Math.abs(positiveValue) < 0.00005 ? 0 : positiveValue
  return roundedValue.toLocaleString('vi-VN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

function getSubmissionVersionId(submission) {
  return submission?.formVersionId
    ?? submission?.versionId
    ?? submission?.formVersion?.id
    ?? submission?.version?.id
    ?? null
}

function getAssignedManagers(assignments, versionId) {
  const managers = []

  assignments.forEach((assignment) => {
    assignment.items?.forEach((item) => {
      if (
        String(item.formVersionId) !== String(versionId)
        || assignment.status !== 'ACTIVE'
        || item.status !== 'ACTIVE'
      ) {
        return
      }

      managers.push({
        assignmentItemId: item.assignmentItemId,
        validFrom: assignment.validFrom,
        validUntil: assignment.validUntil,
        manager: assignment.manager,
      })
    })
  })

  return managers
}

function AdminQualityHistoryVersionPage() {
  const navigate = useNavigate()
  const { formId, versionId } = useParams()
  const [form, setForm] = useState(null)
  const [version, setVersion] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [assignments, setAssignments] = useState([])
  const [resultFilter, setResultFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let alive = true

    const loadVersionHistory = async () => {
      try {
        setLoading(true)
        setErrorMessage('')

        const [formResponse, versionResponse, nextSubmissions, nextAssignments] = await Promise.all([
          adminApi.getFormById(formId),
          adminApi.getFormVersionById(formId, versionId),
          fetchAllPages((params) => adminApi.getFormSubmissions(params), { status: 'SUBMITTED' }),
          fetchAllPages((params) => adminApi.getFormAssignments(params)),
        ])

        if (!alive) return

        setForm(formResponse.data?.data || null)
        setVersion(versionResponse.data?.data || null)
        setSubmissions(nextSubmissions)
        setAssignments(nextAssignments)
      } catch (error) {
        if (!alive) return
        setErrorMessage(error?.response?.data?.message || 'Không thể tải thông tin phiên bản bảng kiểm.')
      } finally {
        if (alive) setLoading(false)
      }
    }

    loadVersionHistory()

    return () => {
      alive = false
    }
  }, [formId, versionId])

  const versionSubmissions = useMemo(() => (
    submissions.filter((submission) => String(getSubmissionVersionId(submission)) === String(versionId))
  ), [submissions, versionId])

  const filteredSubmissions = useMemo(() => (
    versionSubmissions.filter((submission) => !resultFilter || submission.result === resultFilter)
  ), [resultFilter, versionSubmissions])

  const managers = useMemo(() => getAssignedManagers(assignments, versionId), [assignments, versionId])

  const stats = useMemo(() => {
    const passed = versionSubmissions.filter((item) => item.result === 'PASSED').length
    const failed = versionSubmissions.filter((item) =>
      ['FAILED_SCORE', 'FAILED_CRITICAL'].includes(item.result),
    ).length
    const scores = versionSubmissions
      .map((item) => Number(item.convertedScore))
      .filter((score) => Number.isFinite(score))
    const averageScore = scores.length
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null

    return {
      total: versionSubmissions.length,
      passed,
      failed,
      averageScore,
    }
  }, [versionSubmissions])

  return (
    <div className="dashboard-layout admin-quality-history-page">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader
          breadcrumbs={[
            { label: 'Chất lượng' },
            { label: 'Lịch sử đánh giá', link: '/admin/quality/history' },
            { label: 'Chi tiết phiên bản' },
          ]}
        />

        <main className="admin-quality-history admin-quality-history--version">
          <button className="admin-quality-history__back" onClick={() => navigate(`/admin/quality/history?formId=${encodeURIComponent(formId)}`)} type="button">
            <ArrowLeftOutlined />
            Quay lại danh sách version
          </button>

          {loading ? (
            <section className="aqh-empty-state">
              <LoadingOutlined />
              <span>Đang tải thông tin phiên bản...</span>
            </section>
          ) : errorMessage ? (
            <div className="admin-quality-history__alert" role="alert">
              <WarningOutlined />
              {errorMessage}
            </div>
          ) : (
            <>
              <section className="aqh-version-detail">
                <header className="aqh-version-detail__header">
                  <div>
                    <span className="aqh-form-code">{getChecklistDisplayCode(form?.code)}</span>
                    <h2>
                      {version?.title || form?.title || 'Bảng kiểm chưa có tiêu đề'}
                      <small>v{version?.versionNumber}</small>
                    </h2>
                    <p>{version?.description || form?.description || 'Chưa có mô tả'}</p>
                  </div>
                  <span className={`aqh-version-status aqh-version-status--${getVersionStatusClass(version?.status)}`}>
                    {getVersionStatusLabel(version?.status)}
                  </span>
                </header>

                <div className="aqh-summary-grid">
                  <article>
                    <span>Response</span>
                    <strong>{stats.total}</strong>
                    <small>Kết quả đã nộp</small>
                  </article>
                  <article>
                    <span>Manager được giao</span>
                    <strong>{managers.length}</strong>
                    <small>Đang hiệu lực</small>
                  </article>
                  <article>
                    <span>Đạt</span>
                    <strong>{stats.passed}</strong>
                    <small>Không đạt: {stats.failed}</small>
                  </article>
                  <article>
                    <span>Điểm trung bình</span>
                    <strong>{formatScore(stats.averageScore)}</strong>
                    <small>Điểm quy đổi</small>
                  </article>
                </div>
              </section>

              <div className="aqh-detail-columns">
                <section className="aqh-manager-panel">
                  <h3>Manager được giao</h3>
                  {managers.length === 0 ? (
                    <p>Chưa có manager đang được giao cho phiên bản này.</p>
                  ) : (
                    <div className="aqh-manager-list">
                      {managers.map((item) => (
                        <article key={item.assignmentItemId}>
                          <div>
                            <strong>{item.manager?.fullName || 'Manager chưa có tên'}</strong>
                            <span>{item.manager?.employeeCode || 'Chưa có mã'}</span>
                          </div>
                          <small>
                            <ClockCircleOutlined />
                            Hết hạn: {formatDateTime(item.validUntil)}
                          </small>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="aqh-response-panel">
                  <div className="aqh-panel-heading">
                    <h3>Response của phiên bản</h3>
                    <label>
                      <FilterOutlined />
                      <select value={resultFilter} onChange={(event) => setResultFilter(event.target.value)}>
                        {RESULT_OPTIONS.map((option) => (
                          <option key={option.value || 'all'} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {filteredSubmissions.length === 0 ? (
                    <p>Chưa có response phù hợp với bộ lọc hiện tại.</p>
                  ) : (
                    <div className="aqh-response-list">
                      {filteredSubmissions.map((item) => (
                        <article key={item.id}>
                          <div className="aqh-response-subject">
                            <strong>{item.subject?.fullName || 'Chưa có tên nhân viên'}</strong>
                            <span>{item.subject?.employeeCode || 'Chưa có mã'} · {formatDateTime(item.submittedAt || item.updatedAt)}</span>
                          </div>
                          <span className={`admin-quality-history__badge admin-quality-history__badge--${getResultClass(item.result)}`}>
                            {getResultLabel(item.result)}
                          </span>
                          <strong className="aqh-response-score">{formatScore(item.convertedScore)}</strong>
                          <button
                            className="admin-quality-history__detail-button"
                            onClick={() => navigate(`/admin/quality/history/${item.id}`)}
                            type="button"
                          >
                            <EyeOutlined />
                            Chi tiết
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default AdminQualityHistoryVersionPage
