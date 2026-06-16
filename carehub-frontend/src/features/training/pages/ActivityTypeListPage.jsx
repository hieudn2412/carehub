import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import '../styles/training.css'

const DURATION_UNITS = ['HOUR', 'LESSON', 'CREDIT', 'DAY', 'MONTH', 'YEAR', 'OTHER']

const DEFAULT_FILTERS = {
  keyword: '',
  isActive: '',
  requiresEvidence: '',
  durationUnit: '',
  sort: 'sortOrder,asc',
}

function ActivityTypeListPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(0)
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const hasFilters = useMemo(
    () =>
      Boolean(
        filters.keyword ||
          filters.isActive ||
          filters.requiresEvidence ||
          filters.durationUnit ||
          filters.sort !== DEFAULT_FILTERS.sort,
      ),
    [filters],
  )

  const fetchActivityTypes = async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const response = await trainingApi.getActivityTypes({
        keyword: filters.keyword || undefined,
        isActive: filters.isActive === '' ? undefined : filters.isActive === 'true',
        requiresEvidence:
          filters.requiresEvidence === '' ? undefined : filters.requiresEvidence === 'true',
        durationUnit: filters.durationUnit || undefined,
        page,
        size: 10,
        sort: filters.sort,
      })
      setData(response.data.data)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không tải được danh sách loại đào tạo'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchActivityTypes()
    }, 0)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters])

  const updateFilter = (name, value) => {
    setPage(0)
    setFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const toggleStatus = async (activityType) => {
    const nextStatus = !activityType.active
    const label = nextStatus ? 'kích hoạt' : 'ngừng kích hoạt'
    if (!window.confirm(`Bạn muốn ${label} loại "${activityType.name}"?`)) {
      return
    }

    try {
      await trainingApi.updateActivityTypeStatus(activityType.id, {
        active: nextStatus,
        version: activityType.version,
      })
      fetchActivityTypes()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không cập nhật được trạng thái'))
    }
  }

  const rows = data?.content ?? []

  return (
    <main className="training-page">
      <section className="training-header">
        <div>
          <p className="training-eyebrow">Admin</p>
          <h1>Training Activity Types</h1>
        </div>
        <Link className="training-button training-button--primary" to="/admin/training/activity-types/new">
          Create
        </Link>
      </section>

      <section className="training-panel training-panel--wide">
        <div className="training-filters">
          <label>
            Keyword
            <input
              onChange={(event) => updateFilter('keyword', event.target.value)}
              placeholder="Code hoặc tên"
              value={filters.keyword}
            />
          </label>
          <label>
            Status
            <select
              onChange={(event) => updateFilter('isActive', event.target.value)}
              value={filters.isActive}
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <label>
            Evidence
            <select
              onChange={(event) => updateFilter('requiresEvidence', event.target.value)}
              value={filters.requiresEvidence}
            >
              <option value="">All</option>
              <option value="true">Required</option>
              <option value="false">Optional</option>
            </select>
          </label>
          <label>
            Duration unit
            <select
              onChange={(event) => updateFilter('durationUnit', event.target.value)}
              value={filters.durationUnit}
            >
              <option value="">All</option>
              {DURATION_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select onChange={(event) => updateFilter('sort', event.target.value)} value={filters.sort}>
              <option value="sortOrder,asc">Sort order</option>
              <option value="code,asc">Code A-Z</option>
              <option value="name,asc">Name A-Z</option>
              <option value="updatedAt,desc">Updated newest</option>
            </select>
          </label>
        </div>

        {errorMessage ? (
          <div className="training-message training-message--error">
            <p>{errorMessage}</p>
            <button className="training-button" onClick={fetchActivityTypes} type="button">
              Retry
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="training-skeleton">Loading activity types...</div>
        ) : rows.length === 0 ? (
          <div className="training-empty">
            {hasFilters ? 'Không có kết quả phù hợp.' : 'Chưa có loại hoạt động đào tạo.'}
          </div>
        ) : (
          <>
            <div className="training-table-wrap">
              <table className="training-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Tên loại hoạt động</th>
                    <th>Mô tả</th>
                    <th>Đơn vị</th>
                    <th>Evidence</th>
                    <th>Max giờ</th>
                    <th>Usage</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.id}>
                      <td>{item.code}</td>
                      <td>{item.name}</td>
                      <td>{shortText(item.description)}</td>
                      <td>{item.defaultDurationUnit}</td>
                      <td>{item.requiresEvidence ? 'Required' : 'Optional'}</td>
                      <td>{item.maxCreditedHoursPerRecord ?? '-'}</td>
                      <td>{item.usageCount}</td>
                      <td>
                        <span className={`training-badge ${item.active ? 'is-active' : 'is-inactive'}`}>
                          {item.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{formatDateTime(item.updatedAt)}</td>
                      <td>
                        <div className="training-actions">
                          <Link to={`/admin/training/activity-types/${item.id}`}>View</Link>
                          <Link to={`/admin/training/activity-types/${item.id}/edit`}>Edit</Link>
                          <button onClick={() => toggleStatus(item)} type="button">
                            {item.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="training-pagination">
              <button disabled={page <= 0} onClick={() => setPage((value) => value - 1)} type="button">
                Previous
              </button>
              <span>
                Page {data.page + 1} / {Math.max(data.totalPages, 1)}
              </span>
              <button
                disabled={page + 1 >= data.totalPages}
                onClick={() => setPage((value) => value + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

function shortText(value) {
  if (!value) return '-'
  return value.length > 80 ? `${value.slice(0, 80)}...` : value
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('vi-VN')
}

export default ActivityTypeListPage
