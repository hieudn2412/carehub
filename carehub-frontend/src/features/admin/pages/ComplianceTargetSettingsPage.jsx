import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircleOutlined,
  EditOutlined,
  FilterOutlined,
  LoadingOutlined,
  ReloadOutlined,
  SearchOutlined,
  SlidersOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import { apiData, apiErrorMessage } from '../../../shared/utils/apiUi.js'
import { adminApi } from '../api/adminApi.js'
import { getChecklistDisplayCode } from '../utils/formCode.js'
import { ComplianceTargetModal } from './ChecklistQualityDashboardPage.jsx'
import '../styles/ChecklistQualityDashboardPage.css'

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 350

const STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Hoạt động',
  RETIRED: 'Đã ngừng',
}

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PUBLISHED', label: 'Hoạt động' },
  { value: 'DRAFT', label: 'Bản nháp' },
  { value: 'RETIRED', label: 'Đã ngừng' },
]

function pageContent(response) {
  const data = apiData(response, {})
  return {
    content: Array.isArray(data) ? data : data?.content || data?.items || [],
    totalElements: Number(data?.totalElements) || 0,
    totalPages: Number(data?.totalPages) || 0,
    page: Number(data?.page) || 0,
  }
}

function normalizeDepartment(item) {
  return {
    id: item?.id ?? item?.departmentId,
    name: item?.name ?? item?.departmentName ?? item?.displayName,
    code: item?.departmentCode ?? item?.code,
  }
}

function formStatus(form) {
  return form?.effectiveStatus || form?.status || (form?.currentPublishedVersion ? 'PUBLISHED' : 'DRAFT')
}

function normalizeTargetConfig(response) {
  const config = apiData(response, null)
  return {
    hospitalTargetPercent: config?.hospitalTarget?.targetPercent ?? null,
    departmentTargetCount: Array.isArray(config?.departmentTargets) ? config.departmentTargets.length : 0,
  }
}

function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '80,00%'
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? `${parsed.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
    : '80,00%'
}

function modalFormFromChecklist(form) {
  return {
    formId: form.id,
    formTitle: form.title || 'Bảng kiểm chưa có tiêu đề',
    formCode: getChecklistDisplayCode(form.code) || `#${form.id}`,
    versionNumber: form.currentPublishedVersion?.versionNumber,
  }
}

function ComplianceTargetSettingsPage() {
  const [departments, setDepartments] = useState([])
  const [forms, setForms] = useState([])
  const [targetsByFormId, setTargetsByFormId] = useState({})
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [targetLoading, setTargetLoading] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [targetModalForm, setTargetModalForm] = useState(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [keyword])

  useEffect(() => {
    setPage(0)
  }, [debouncedKeyword, statusFilter])

  useEffect(() => {
    let active = true
    adminApi.getDepartments()
      .then((response) => {
        if (!active) return
        setDepartments(pageContent(response).content.map(normalizeDepartment).filter((item) => item.id && item.name))
      })
      .catch((requestError) => {
        if (active) setError(apiErrorMessage(requestError))
      })
    return () => { active = false }
  }, [reloadKey])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    adminApi.getForms({
      page,
      size: PAGE_SIZE,
      sort: 'updatedAt,desc',
      keyword: debouncedKeyword || undefined,
      status: statusFilter || undefined,
    }).then((response) => {
      if (!active) return
      const nextPage = pageContent(response)
      setForms(nextPage.content)
      setTotalElements(nextPage.totalElements)
      setTotalPages(nextPage.totalPages)
    }).catch((requestError) => {
      if (!active) return
      setForms([])
      setTotalElements(0)
      setTotalPages(0)
      setError(apiErrorMessage(requestError))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [debouncedKeyword, page, reloadKey, statusFilter])

  useEffect(() => {
    if (!forms.length) {
      setTargetsByFormId({})
      return undefined
    }
    let active = true
    setTargetLoading(true)
    Promise.allSettled(forms.map((form) => adminApi.getComplianceTargets(form.id)))
      .then((results) => {
        if (!active) return
        const nextTargets = {}
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            nextTargets[forms[index].id] = normalizeTargetConfig(result.value)
          }
        })
        setTargetsByFormId(nextTargets)
      })
      .finally(() => {
        if (active) setTargetLoading(false)
      })
    return () => { active = false }
  }, [forms])

  const resultFrom = totalElements === 0 ? 0 : page * PAGE_SIZE + 1
  const resultTo = Math.min((page + 1) * PAGE_SIZE, totalElements)
  const hasFilters = debouncedKeyword.length > 0 || Boolean(statusFilter)
  const activeFilterCount = [statusFilter].filter(Boolean).length

  const breadcrumbs = useMemo(() => [
    { label: 'Giám sát tuân thủ' },
    { label: 'Cài đặt mục tiêu tuân thủ' },
  ], [])

  function retry() {
    setReloadKey((value) => value + 1)
  }

  function handleSaved() {
    setTargetModalForm(null)
    retry()
  }

  function clearFilters() {
    setKeyword('')
    setDebouncedKeyword('')
    setStatusFilter('')
    setPage(0)
  }

  return (
    <AppShell title="Cài đặt mục tiêu tuân thủ" breadcrumbs={breadcrumbs}>
      <div className="checklist-target-settings">
        <section className="checklist-target-settings__toolbar admin-control-toolbar" aria-label="Tìm kiếm bảng kiểm">
          <div className="checklist-target-settings__toolbar-main admin-control-toolbar__main">
            <div className="checklist-target-settings__search-filter-group admin-control-toolbar__controls">
              <label className="checklist-target-settings__search admin-control-toolbar__search">
                <SearchOutlined />
                <input
                  aria-label="Tìm theo tên hoặc mã bảng kiểm"
                  type="search"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Tìm theo tên hoặc mã bảng kiểm..."
                />
              </label>
              <button
                type="button"
                className={`checklist-target-settings__filter-trigger admin-control-toolbar__filter-trigger${isFilterOpen ? ' is-open' : ''}`}
                aria-expanded={isFilterOpen}
                aria-controls="compliance-target-filter-panel"
                onClick={() => setIsFilterOpen((value) => !value)}
              >
                <FilterOutlined /> Bộ lọc
                {activeFilterCount > 0 && <span className="admin-control-toolbar__filter-count">{activeFilterCount}</span>}
              </button>
            </div>
            <div className="checklist-target-settings__toolbar-actions">
              <span>{totalElements} bảng kiểm</span>
              <button
                type="button"
                className="checklist-target-settings__refresh"
                onClick={retry}
                disabled={loading || targetLoading}
                title="Làm mới dữ liệu"
                aria-label="Làm mới dữ liệu"
              >
                {loading || targetLoading ? <LoadingOutlined spin /> : <ReloadOutlined />}
              </button>
            </div>
          </div>

          {isFilterOpen && (
            <div className="checklist-target-settings__filter-panel admin-control-toolbar__panel" id="compliance-target-filter-panel">
              <label className="admin-control-toolbar__field">
                <span>Trạng thái</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="checklist-target-settings__clear-filters"
                onClick={clearFilters}
                disabled={!hasFilters}
              >
                Xóa bộ lọc
              </button>
            </div>
          )}
        </section>

        {error && <div className="checklist-quality-alert"><span>{error}</span><button type="button" onClick={retry}>Thử lại</button></div>}

        <section className="checklist-target-settings__table-card" aria-busy={loading || targetLoading}>
          <table className="checklist-target-settings__table admin-table-uppercase">
            <thead>
              <tr>
                <th className="checklist-target-settings__col-form">Bảng kiểm</th>
                <th className="checklist-target-settings__col-version">Phiên bản</th>
                <th className="checklist-target-settings__col-status">Trạng thái</th>
                <th className="checklist-target-settings__col-hospital">Mục tiêu bệnh viện</th>
                <th className="checklist-target-settings__col-department">Mục tiêu khoa/phòng</th>
                <th className="checklist-target-settings__col-actions">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="checklist-target-settings__empty"><LoadingOutlined spin /> Đang tải danh sách bảng kiểm...</td></tr>
              ) : forms.length === 0 ? (
                <tr><td colSpan="6" className="checklist-target-settings__empty">
                  <strong>{hasFilters ? 'Không tìm thấy bảng kiểm phù hợp' : 'Chưa có bảng kiểm'}</strong>
                  <span>{hasFilters ? 'Hãy đổi từ khóa hoặc bộ lọc.' : 'Tạo bảng kiểm trước khi cấu hình mục tiêu tuân thủ.'}</span>
                </td></tr>
              ) : forms.map((form) => {
                const status = formStatus(form)
                const target = targetsByFormId[form.id]
                return (
                  <tr key={form.id}>
                    <td>
                      <div className="checklist-target-settings__name">
                        <strong>{form.title || 'Bảng kiểm chưa có tiêu đề'}</strong>
                        <span>{getChecklistDisplayCode(form.code) || `#${form.id}`}</span>
                      </div>
                    </td>
                    <td>{form.currentPublishedVersion ? <span className="checklist-target-settings__version">v{form.currentPublishedVersion.versionNumber}</span> : <span className="checklist-target-settings__muted">Chưa công bố</span>}</td>
                    <td><span className={`checklist-target-settings__status checklist-target-settings__status--${String(status).toLowerCase()}`}>{STATUS_LABELS[status] || status}</span></td>
                    <td>
                      <div className="checklist-target-settings__metric">
                        <CheckCircleOutlined />
                        <strong>{targetLoading && !target ? '...' : formatPercent(target?.hospitalTargetPercent)}</strong>
                      </div>
                    </td>
                    <td>
                      <div className="checklist-target-settings__metric">
                        <SlidersOutlined />
                        <span>{targetLoading && !target ? 'Đang tải...' : `${target?.departmentTargetCount || 0} khoa có mục tiêu riêng`}</span>
                      </div>
                    </td>
                    <td>
                      <div className="admin-table-actions checklist-target-settings__actions">
                        <button
                          type="button"
                          className="admin-table-action admin-table-action--success"
                          title="Cấu hình điểm mục tiêu"
                          onClick={() => setTargetModalForm(modalFormFromChecklist(form))}
                        >
                          <EditOutlined /> <span>Cấu hình mục tiêu</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        {!loading && totalElements > 0 && (
          <footer className="checklist-target-settings__pagination">
            <span>Hiển thị <strong>{resultFrom}–{resultTo}</strong> / <strong>{totalElements}</strong> bảng kiểm</span>
            <div>
              <button type="button" disabled={page <= 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Trước</button>
              <strong>{page + 1}/{Math.max(totalPages, 1)}</strong>
              <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)}>Sau</button>
            </div>
          </footer>
        )}
      </div>

      {targetModalForm && (
        <ComplianceTargetModal
          form={targetModalForm}
          isAdmin
          departments={departments}
          currentDepartmentId={null}
          onClose={() => setTargetModalForm(null)}
          onSaved={handleSaved}
        />
      )}
    </AppShell>
  )
}

export default ComplianceTargetSettingsPage
