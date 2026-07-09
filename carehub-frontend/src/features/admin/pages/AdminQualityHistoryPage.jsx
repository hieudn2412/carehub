import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOutlined,
  CheckCircleOutlined,
  FilterOutlined,
  FileTextOutlined,
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
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedFormId = searchParams.get('formId')
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
  const [selectedFormId, setSelectedFormId] = useState(() => requestedFormId)

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

        let nextForms = formBatch.forms
        let nextVersionsByForm = formBatch.versionsByForm

        if (requestedFormId && !nextForms.some((form) => String(form.id) === String(requestedFormId))) {
          try {
            const [formResponse, versions] = await Promise.all([
              adminApi.getFormById(requestedFormId),
              fetchAllPages((params) => adminApi.getFormVersions(requestedFormId, params), {
                sort: 'versionNumber,desc',
              }),
            ])

            if (!alive) return

            const requestedForm = formResponse.data?.data
            if (requestedForm) {
              nextForms = [requestedForm, ...nextForms]
              nextVersionsByForm = {
                ...nextVersionsByForm,
                [requestedForm.id]: versions,
              }
            }
          } catch {
            // Keep the normal history list if the deep-linked form cannot be loaded.
          }
        }

        setForms(nextForms)
        setSubmissions(nextSubmissions)
        setAssignments(nextAssignments)
        setVersionsByForm(nextVersionsByForm)
        setFormPage(0)
        setHasMoreForms(formBatch.hasMore)
        setSelectedFormId(requestedFormId || null)
      } catch (error) {
        if (!alive) return
        setForms([])
        setVersionsByForm({})
        setSubmissions([])
        setAssignments([])
        setFormPage(0)
        setHasMoreForms(false)
        setSelectedFormId(null)
        setErrorMessage(getHistoryErrorMessage(error))
      } finally {
        if (alive) setLoading(false)
      }
    }

    loadHistory()

    return () => {
      alive = false
    }
  }, [requestedFormId, search])

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

  const formFolders = useMemo(() => (
    forms.map((form) => {
      const formVersions = versionCards.filter((version) => String(version.form.id) === String(form.id))
      const publishedCount = formVersions.filter((version) => version.status === 'PUBLISHED').length

      return {
        form,
        versionCount: formVersions.length,
        publishedCount,
      }
    }).filter((folder) => folder.versionCount > 0)
  ), [forms, versionCards])

  const selectedForm = useMemo(() => (
    forms.find((form) => String(form.id) === String(selectedFormId)) || null
  ), [forms, selectedFormId])

  const selectedVersionCards = useMemo(() => (
    filteredVersionCards.filter((version) => String(version.form.id) === String(selectedFormId))
  ), [filteredVersionCards, selectedFormId])

  const handleLoadMore = async () => {
    if (loadingMore || !hasMoreForms) return

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
          {!selectedForm && (
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
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setSelectedFormId(null)
                    setSearchParams({}, { replace: true })
                  }}
                  placeholder="Nhập tiêu đề biểu mẫu..."
                />
              </label>
            </section>
          )}

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
          ) : formFolders.length === 0 ? (
            <section className="aqh-empty-state">
              <CheckCircleOutlined />
              <strong>Không tìm thấy bảng kiểm phù hợp</strong>
              <span>Hãy thử từ khóa khác hoặc kiểm tra bảng kiểm đã được công bố chưa.</span>
            </section>
          ) : selectedForm ? (
            <>
              <section className="aqh-version-backbar">
                <button
                  className="aqh-back-folder"
                  onClick={() => {
                    setSelectedFormId(null)
                    setSearchParams({}, { replace: true })
                  }}
                  type="button"
                >
                  ← Quay lại trang tìm kiếm
                </button>
              </section>

              <section className="aqh-version-toolbar">
                <div>
                  <h2>{selectedForm.title}</h2>
                  <p>{selectedVersionCards.length} phiên bản trong bảng kiểm này</p>
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
                {selectedVersionCards.map((version) => (
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
            </>
          ) : (
            <>
              <section className="aqh-version-toolbar">
                <div>
                  <strong>{formFolders.length}</strong> bảng kiểm đã tải
                  {search.trim() && <span> theo từ khóa tìm kiếm</span>}
                </div>
              </section>

              <section className="aqh-folder-grid" aria-label="Kho folder bảng kiểm">
                {formFolders.map(({ form, versionCount, publishedCount }) => (
                  <button
                    className="aqh-folder-card"
                    key={form.id}
                    onClick={() => {
                      setSelectedFormId(form.id)
                      setSearchParams({ formId: String(form.id) }, { replace: true })
                    }}
                    type="button"
                  >
                    <span className="aqh-folder-card__top">
                      <span className="aqh-folder-card__icon">
                        <FileTextOutlined />
                      </span>
                      <BookOutlined className="aqh-folder-card__bookmark" />
                    </span>
                    <strong>{form.title}</strong>
                    <span className="aqh-folder-card__divider" />
                    <span className="aqh-folder-card__meta">
                      <FileTextOutlined />
                      {versionCount} phiên bản
                    </span>
                    <span className="aqh-folder-card__status">
                      <span>✓</span>
                      {publishedCount} phiên bản đang hoạt động
                    </span>
                  </button>
                ))}
              </section>

              {hasMoreForms && (
                <div className="aqh-load-more">
                  <button
                    disabled={loadingMore}
                    onClick={handleLoadMore}
                    type="button"
                  >
                    {loadingMore && <LoadingOutlined />}
                    {loadingMore ? 'Đang tải thêm...' : 'Xem thêm 10 bảng kiểm'}
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
