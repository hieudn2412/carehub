import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircleOutlined,
  FilterOutlined,
  LoadingOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AdminHeader from '../components/AdminHeader'
import AdminSidebar from '../components/AdminSidebar'
import { adminApi } from '../api/adminApi'
import { getChecklistDisplayCode } from '../utils/formCode.js'
import '../styles/AdminQualityHistoryPage.css'

const VERSION_OPTIONS = [
  { value: '', label: 'Tất cả phiên bản' },
  { value: 'PUBLISHED', label: 'Đang hoạt động' },
  { value: 'RETIRED', label: 'Đã retired' },
]
const HISTORY_VERSION_STATUSES = new Set(['PUBLISHED', 'RETIRED'])
const HISTORY_FORM_PAGE_SIZE = 10
const HISTORY_VERSION_PAGE_SIZE = 10

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
  const firstResponse = await fetcher({
    ...baseParams,
    page: 0,
    size: pageSize,
  })
  const firstContent = getPageContent(firstResponse)
  const totalPages = getPageTotalPages(firstResponse)

  if (totalPages <= 1) {
    return firstContent
  }

  const restResponses = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetcher({
        ...baseParams,
        page: index + 1,
        size: pageSize,
      }),
    ),
  )

  return [
    ...firstContent,
    ...restResponses.flatMap((response) => getPageContent(response)),
  ]
}

async function fetchHistoryFormBatch(page, keyword = '') {
  const formsResponse = await adminApi.getForms({
    keyword: keyword || undefined,
    sort: 'updatedAt,desc',
    page,
    size: HISTORY_FORM_PAGE_SIZE,
  })
  const nextForms = getPageContent(formsResponse)
  const totalPages = getPageTotalPages(formsResponse)

  const versionsEntries = await Promise.all(
    nextForms.map(async (form) => {
      try {
        const versions = await fetchAllPages((params) => adminApi.getFormVersions(form.id, params), {
          sort: 'versionNumber,desc',
        })
        return [form.id, versions]
      } catch {
        return [form.id, form.currentPublishedVersion ? [form.currentPublishedVersion] : []]
      }
    }),
  )

  return {
    forms: nextForms,
    hasMore: page + 1 < totalPages,
    versionsByForm: Object.fromEntries(versionsEntries),
  }
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

function getSubmissionVersionId(submission) {
  return submission?.formVersionId
    ?? submission?.versionId
    ?? submission?.formVersion?.id
    ?? submission?.version?.id
    ?? null
}

function getHistoryErrorMessage(error) {
  const backendMessage = error?.response?.data?.message
  if (backendMessage) return backendMessage
  return 'Không thể tải kho lịch sử bảng kiểm. Vui lòng thử lại.'
}

function isActiveAssignment(assignment, item) {
  return assignment?.status === 'ACTIVE' && item?.status === 'ACTIVE'
}

function getAssignedManagers(assignments, versionId) {
  const managers = []

  assignments.forEach((assignment) => {
    assignment.items?.forEach((item) => {
      if (String(item.formVersionId) !== String(versionId) || !isActiveAssignment(assignment, item)) {
        return
      }

      managers.push({
        assignmentId: assignment.id,
        assignmentItemId: item.assignmentItemId,
        validFrom: assignment.validFrom,
        validUntil: assignment.validUntil,
        manager: assignment.manager,
      })
    })
  })

  return managers
}

function AdminQualityHistoryPage() {
  const navigate = useNavigate()
  const [forms, setForms] = useState([])
  const [versionsByForm, setVersionsByForm] = useState({})
  const [submissions, setSubmissions] = useState([])
  const [assignments, setAssignments] = useState([])
  const [search, setSearch] = useState('')
  const [versionFilter, setVersionFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [formPage, setFormPage] = useState(0)
  const [hasMoreForms, setHasMoreForms] = useState(false)
  const [visibleVersionCount, setVisibleVersionCount] = useState(HISTORY_VERSION_PAGE_SIZE)

  useEffect(() => {
    let alive = true
    const keyword = search.trim()

    const loadHistory = async () => {
      try {
        setLoading(true)
        setErrorMessage('')

        const [formBatch, nextSubmissions, nextAssignments] = await Promise.all([
          fetchHistoryFormBatch(0, keyword),
          fetchAllPages((params) => adminApi.getFormSubmissions(params), {
            status: 'SUBMITTED',
          }),
          fetchAllPages((params) => adminApi.getFormAssignments(params)),
        ])

        if (!alive) return

        setForms(formBatch.forms)
        setSubmissions(nextSubmissions)
        setAssignments(nextAssignments)
        setVersionsByForm(formBatch.versionsByForm)
        setFormPage(0)
        setHasMoreForms(formBatch.hasMore)
        setVisibleVersionCount(HISTORY_VERSION_PAGE_SIZE)
      } catch (error) {
        if (!alive) return
        setForms([])
        setVersionsByForm({})
        setSubmissions([])
        setAssignments([])
        setFormPage(0)
        setHasMoreForms(false)
        setVisibleVersionCount(HISTORY_VERSION_PAGE_SIZE)
        setErrorMessage(getHistoryErrorMessage(error))
      } finally {
        if (alive) setLoading(false)
      }
    }

    loadHistory()

    return () => {
      alive = false
    }
  }, [search])

  const versionCards = useMemo(() => (
    forms.flatMap((form) => (
      (versionsByForm[form.id] || [])
        .filter((version) => HISTORY_VERSION_STATUSES.has(version.status))
        .map((version) => {
        const versionSubmissions = submissions.filter((submission) =>
          String(getSubmissionVersionId(submission)) === String(version.id),
        )
        const assignedManagers = getAssignedManagers(assignments, version.id)

        return {
          ...version,
          form,
          responseCount: versionSubmissions.length,
          managerCount: assignedManagers.length,
        }
      })
    ))
  ), [assignments, forms, submissions, versionsByForm])

  const searchedVersionCards = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return versionCards

    return versionCards.filter((version) => {
      const searchableText = [
        version.form.title,
        version.form.code,
        getChecklistDisplayCode(version.form.code),
        version.form.description,
        version.title,
        version.description,
        `v${version.versionNumber}`,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(keyword)
    })
  }, [search, versionCards])

  const filteredVersionCards = useMemo(() => (
    searchedVersionCards.filter((version) => !versionFilter || version.status === versionFilter)
  ), [searchedVersionCards, versionFilter])

  const visibleVersionCards = useMemo(
    () => filteredVersionCards.slice(0, visibleVersionCount),
    [filteredVersionCards, visibleVersionCount],
  )
  const canLoadMoreVersions = visibleVersionCount < filteredVersionCards.length || hasMoreForms

  const handleLoadMore = async () => {
    if (loadingMore) return

    if (visibleVersionCount < filteredVersionCards.length) {
      setVisibleVersionCount((current) => current + HISTORY_VERSION_PAGE_SIZE)
      return
    }

    if (!hasMoreForms) return

    const nextPage = formPage + 1

    try {
      setLoadingMore(true)
      setErrorMessage('')

      const formBatch = await fetchHistoryFormBatch(nextPage, search.trim())

      setForms((previousForms) => {
        const existingIds = new Set(previousForms.map((form) => String(form.id)))
        const uniqueForms = formBatch.forms.filter((form) => !existingIds.has(String(form.id)))
        return [...previousForms, ...uniqueForms]
      })
      setVersionsByForm((previousVersions) => ({
        ...previousVersions,
        ...formBatch.versionsByForm,
      }))
      setFormPage(nextPage)
      setHasMoreForms(formBatch.hasMore)
      setVisibleVersionCount((current) => current + HISTORY_VERSION_PAGE_SIZE)
    } catch (error) {
      setErrorMessage(getHistoryErrorMessage(error))
    } finally {
      setLoadingMore(false)
    }
  }

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

        <main className="admin-quality-history admin-quality-history--archive">
          <section className="aqh-search-hero">
            <div className="aqh-search-hero__copy">
              <span>Kho lưu trữ bảng kiểm</span>
              <h1>Tìm kiếm bảng kiểm</h1>
              <p>Chỉ có thể tìm kiếm các bảng kiểm đã được công bố.</p>
            </div>
            <label className="aqh-main-search">
              <SearchOutlined />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nhập tiêu đề biểu mẫu..."
              />
            </label>
          </section>

          {errorMessage && (
            <div className="admin-quality-history__alert" role="alert">
              <WarningOutlined />
              {errorMessage}
            </div>
          )}

          {loading ? (
            <section className="aqh-empty-state">
              <LoadingOutlined />
              <span>Đang tải kho lịch sử bảng kiểm...</span>
            </section>
          ) : filteredVersionCards.length === 0 ? (
            <section className="aqh-empty-state">
              <CheckCircleOutlined />
              <strong>Không tìm thấy bảng kiểm phù hợp</strong>
              <span>Hãy thử từ khóa khác hoặc kiểm tra bảng kiểm đã được công bố chưa.</span>
            </section>
          ) : (
            <>
              <section className="aqh-version-toolbar">
                <div>
                  <strong>{visibleVersionCards.length}</strong>/{filteredVersionCards.length} phiên bản đã tải
                  {searchedVersionCards.length > 0 && (
                    <span> trong {new Set(searchedVersionCards.map((version) => version.form.id)).size} bảng kiểm</span>
                  )}
                </div>
                <label>
                  <FilterOutlined />
                  <select
                    value={versionFilter}
                    onChange={(event) => setVersionFilter(event.target.value)}
                  >
                    {VERSION_OPTIONS.map((option) => (
                      <option key={option.value || 'all'} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              <section className="aqh-version-grid" aria-label="Danh sách phiên bản bảng kiểm">
                {visibleVersionCards.map((version) => (
                  <button
                    className="aqh-version-card"
                    key={version.id}
                    onClick={() => navigate(`/admin/quality/history/forms/${version.form.id}/versions/${version.id}`)}
                    type="button"
                  >
                    <div className="aqh-version-card__top">
                      <span className="aqh-form-code">{getChecklistDisplayCode(version.form.code)}</span>
                      <span className={`aqh-version-status aqh-version-status--${getVersionStatusClass(version.status)}`}>
                        {getVersionStatusLabel(version.status)}
                      </span>
                    </div>
                    <h2>
                      {version.title || version.form.title}
                      <span>v{version.versionNumber}</span>
                    </h2>
                    <p>{version.description || version.form.description || 'Chưa có mô tả'}</p>
                    <div className="aqh-version-card__meta">
                      <span>{version.responseCount} response</span>
                      <span>{version.managerCount} manager</span>
                    </div>
                  </button>
                ))}
              </section>

              {canLoadMoreVersions && (
                <div className="aqh-load-more">
                  <button
                    disabled={loadingMore}
                    onClick={handleLoadMore}
                    type="button"
                  >
                    {loadingMore && <LoadingOutlined />}
                    {loadingMore ? 'Đang tải thêm...' : 'Xem thêm 10 phiên bản'}
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default AdminQualityHistoryPage
