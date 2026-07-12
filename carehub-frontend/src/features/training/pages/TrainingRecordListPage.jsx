import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import '../styles/training.css'

const STATUS_OPTIONS = ['DRAFT', 'SUBMITTED', 'CANCELLED']

function TrainingRecordListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [pageData, setPageData] = useState(null)
  const [options, setOptions] = useState({ activityTypes: [], professionalFields: [] })
  const [optionsLoaded, setOptionsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [keywordInput, setKeywordInput] = useState(searchParams.get('keyword') ?? '')

  const filters = useMemo(() => ({
    keyword: searchParams.get('keyword') ?? '',
    dateFrom: searchParams.get('dateFrom') ?? '',
    dateTo: searchParams.get('dateTo') ?? '',
    activityTypeId: searchParams.get('activityTypeId') ?? '',
    workflowStatus: searchParams.get('workflowStatus') ?? '',
    hasEvidence: searchParams.get('hasEvidence') ?? '',
    page: Number(searchParams.get('page') ?? 0),
    size: Number(searchParams.get('size') ?? 10),
  }), [searchParams])

  // Debounce keyword before updating URL params
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      if (keywordInput) {
        next.set('keyword', keywordInput)
      } else {
        next.delete('keyword')
      }
      next.set('page', '0')
      setSearchParams(next)
    }, 300)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywordInput])

  // Load reference data (activity types, professional fields) once on mount
  useEffect(() => {
    if (!optionsLoaded) {
      trainingApi.getRecordOptions()
        .then(res => {
          setOptions(res.data.data)
          setOptionsLoaded(true)
        })
        .catch(err => console.error('Error loading record options', err))
    }
  }, [optionsLoaded])

  useEffect(() => {
    let mounted = true

    async function load() {
      setIsLoading(true)
      setErrorMessage('')
      try {
        const params = toApiParams(filters)
        const recordsResponse = await trainingApi.listRecords(params)
        if (!mounted) return
        setPageData(recordsResponse.data.data)
      } catch (error) {
        if (!mounted) return
        setErrorMessage(getApiErrorMessage(error, 'Cannot load training records'))
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    const timer = window.setTimeout(load, 0)
    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [filters])

  const updateFilter = (name, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(name, value)
    } else {
      next.delete(name)
    }
    next.set('page', '0')
    setSearchParams(next)
  }

  const goToPage = (page) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next)
  }

  return (
    <main className="training-page">
      <section className="training-header">
        <div>
          <p className="training-eyebrow">Training</p>
          <h1>Training Records</h1>
        </div>
        <div className="training-header-actions">
          <Link className="training-button training-button--primary" to="/training/records/new">
            New Record
          </Link>
          <Link className="training-button" to="/training">
            Foundation
          </Link>
        </div>
      </section>

      <section className="training-panel training-panel--wide">
        <div className="training-filters training-filters--records">
          <label>
            Keyword
            <input
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="Title, provider, employee"
              value={keywordInput}
            />
          </label>
          <label>
            From
            <input onChange={(event) => updateFilter('dateFrom', event.target.value)} type="date" value={filters.dateFrom} />
          </label>
          <label>
            To
            <input onChange={(event) => updateFilter('dateTo', event.target.value)} type="date" value={filters.dateTo} />
          </label>
          <label>
            Activity
            <select onChange={(event) => updateFilter('activityTypeId', event.target.value)} value={filters.activityTypeId}>
              <option value="">All</option>
              {options.activityTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select onChange={(event) => updateFilter('workflowStatus', event.target.value)} value={filters.workflowStatus}>
              <option value="">All</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Evidence
            <select onChange={(event) => updateFilter('hasEvidence', event.target.value)} value={filters.hasEvidence}>
              <option value="">All</option>
              <option value="true">Has evidence</option>
              <option value="false">No evidence</option>
            </select>
          </label>
        </div>

        {errorMessage ? <div className="training-message training-message--error">{errorMessage}</div> : null}
        {isLoading ? <div className="training-skeleton">Loading records...</div> : null}
        {!isLoading && !errorMessage && pageData?.content?.length === 0 ? (
          <div className="training-empty">No training records found.</div>
        ) : null}

        {!isLoading && pageData?.content?.length > 0 ? (
          <>
            <div className="training-table-wrap">
              <table className="training-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Program</th>
                    <th>Activity</th>
                    <th>Dates</th>
                    <th>Hours</th>
                    <th>Evidence</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.content.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <strong>{record.employeeCode}</strong>
                        <br />
                        {record.employeeName}
                        <br />
                        <span className="training-muted">{record.employeeDepartmentNameSnapshot ?? '-'}</span>
                      </td>
                      <td>
                        <strong>{record.title}</strong>
                        <br />
                        <span className="training-muted">{record.provider ?? '-'}</span>
                      </td>
                      <td>{record.activityTypeName}</td>
                      <td>
                        {formatDate(record.startDate)}
                        <br />
                        {formatDate(record.endDate)}
                      </td>
                      <td>
                        Declared: {record.declaredHours ?? '-'}
                      </td>
                      <td>
                        {record.evidenceCount}
                        {record.failedEvidenceCount > 0 ? <span className="training-danger"> / failed</span> : null}
                      </td>
                      <td>
                        <span className={`training-badge ${record.workflowStatus === 'SUBMITTED' ? 'is-active' : 'is-inactive'}`}>
                          {record.workflowStatus}
                        </span>
                      </td>
                      <td>{formatDateTime(record.updatedAt)}</td>
                      <td>
                        <div className="training-actions">
                          <Link to={`/training/records/${record.id}`}>View</Link>
                          {record.workflowStatus === 'DRAFT' ? (
                            <>
                              <Link to={`/training/records/${record.id}/edit`}>Edit</Link>
                              <Link to={`/training/records/${record.id}/evidence`}>Evidence</Link>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="training-pagination">
              <button
                className="training-button"
                disabled={pageData.page <= 0}
                onClick={() => goToPage(pageData.page - 1)}
                type="button"
              >
                Previous
              </button>
              <span>
                Page {pageData.page + 1} / {Math.max(pageData.totalPages, 1)}
              </span>
              <button
                className="training-button"
                disabled={pageData.page >= pageData.totalPages - 1}
                onClick={() => goToPage(pageData.page + 1)}
                type="button"
              >
                Next
              </button>
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}

function toApiParams(filters) {
  const params = {
    page: filters.page,
    size: filters.size,
    sort: 'updatedAt,desc',
  }
  for (const key of ['keyword', 'dateFrom', 'dateTo', 'activityTypeId', 'workflowStatus', 'hasEvidence']) {
    if (filters[key]) {
      params[key] = filters[key]
    }
  }
  return params
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value))
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default TrainingRecordListPage
