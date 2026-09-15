import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../../shared/api/apiError.js'
import AppShell from '../../../shared/components/AppShell.jsx'
import KeyboardDatePicker from '../../../shared/components/KeyboardDatePicker.jsx'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import FilterActionButtons from '../../../shared/components/FilterActionButtons.jsx'
import { currentYearDateRange, validateHistoricalDateRange } from '../../../shared/utils/dateRange.js'
import '../styles/training.css'

const STATUS_OPTIONS = ['DRAFT', 'SUBMITTED', 'CANCELLED']
const DEFAULT_RECORD_DATES = currentYearDateRange()

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
    dateFrom: searchParams.get('dateFrom') ?? DEFAULT_RECORD_DATES.fromDate,
    dateTo: searchParams.get('dateTo') ?? DEFAULT_RECORD_DATES.toDate,
    activityTypeId: searchParams.get('activityTypeId') ?? '',
    workflowStatus: searchParams.get('workflowStatus') ?? '',
    hasEvidence: searchParams.get('hasEvidence') ?? '',
    page: Number(searchParams.get('page') ?? 0),
    size: Number(searchParams.get('size') ?? 10),
  }), [searchParams])
  const [filterDraft, setFilterDraft] = useState(filters)
  const [filterError, setFilterError] = useState('')

  useEffect(() => {
    setFilterDraft(filters)
  }, [filters])

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
    setFilterError('')
    setFilterDraft((current) => ({ ...current, [name]: value }))
  }

  const goToPage = (page) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next)
  }

  const handleApplyFilters = () => {
    const validationError = validateHistoricalDateRange(filterDraft.dateFrom, filterDraft.dateTo)
    if (validationError) {
      setFilterError(validationError)
      return
    }
    setFilterError('')
    const next = new URLSearchParams()
    if (keywordInput.trim()) next.set('keyword', keywordInput.trim())
    ;['dateFrom', 'dateTo', 'activityTypeId', 'workflowStatus', 'hasEvidence'].forEach((key) => {
      if (filterDraft[key]) next.set(key, String(filterDraft[key]))
    })
    next.set('size', String(filters.size))
    next.set('page', '0')
    setSearchParams(next)
  }

  const handleClearFilters = () => {
    setKeywordInput('')
    const nextDraft = { ...filterDraft, keyword: '', dateFrom: DEFAULT_RECORD_DATES.fromDate, dateTo: DEFAULT_RECORD_DATES.toDate, activityTypeId: '', workflowStatus: '', hasEvidence: '', page: 0 }
    setFilterDraft(nextDraft)
    setFilterError('')
    setSearchParams(new URLSearchParams({ dateFrom: DEFAULT_RECORD_DATES.fromDate, dateTo: DEFAULT_RECORD_DATES.toDate }))
  }

  return (
    <AppShell title="Hồ sơ đào tạo">
    <div className="training-page">
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
            <KeyboardDatePicker allowInvalidValue max={filterDraft.dateTo || DEFAULT_RECORD_DATES.toDate} onChange={(val) => updateFilter('dateFrom', val)} value={filterDraft.dateFrom} />
          </label>
          <label>
            To
            <KeyboardDatePicker allowInvalidValue min={filterDraft.dateFrom || undefined} max={DEFAULT_RECORD_DATES.toDate} onChange={(val) => updateFilter('dateTo', val)} value={filterDraft.dateTo} />
          </label>
          <FilterSelectField
            label="Activity"
            value={filterDraft.activityTypeId}
            onChange={(value) => updateFilter('activityTypeId', value)}
            searchable
            options={[
              { value: '', label: 'All' },
              ...(options.activityTypes || []).map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
          <FilterSelectField
            label="Status"
            value={filterDraft.workflowStatus}
            onChange={(value) => updateFilter('workflowStatus', value)}
            options={[
              { value: '', label: 'All' },
              ...STATUS_OPTIONS.map((status) => ({ value: status, label: status })),
            ]}
          />
          <FilterSelectField
            label="Evidence"
            value={filterDraft.hasEvidence}
            onChange={(value) => updateFilter('hasEvidence', value)}
            options={[
              { value: '', label: 'All' },
              { value: 'true', label: 'Has evidence' },
              { value: 'false', label: 'No evidence' },
            ]}
          />
          <FilterActionButtons onApply={handleApplyFilters} onReset={handleClearFilters} />
          {filterError && <p className="applied-filter-toolbar__error" role="alert">{filterError}</p>}
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
    </div>
    </AppShell>
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
