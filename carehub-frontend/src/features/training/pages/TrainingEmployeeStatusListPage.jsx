import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import '../styles/training.css'

const TODAY = new Date().toISOString().slice(0, 10)

const DEFAULT_FILTERS = {
  keyword: '',
  departmentId: '',
  jobPositionId: '',
  professionalFieldId: '',
  complianceStatus: '',
  hasPendingReview: '',
  requirementConfigured: '',
  approvedHoursMin: '',
  approvedHoursMax: '',
  asOf: TODAY,
}

function TrainingEmployeeStatusListPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(0)
  const [result, setResult] = useState(null)
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [professionalFields, setProfessionalFields] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const rows = result?.content ?? []
  const hasFilters = useMemo(
    () => Object.entries(filters).some(([key, value]) => key !== 'asOf' && value !== ''),
    [filters],
  )

  async function fetchData() {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const [statusResponse, departmentsResponse, positionsResponse, optionsResponse] = await Promise.all([
        trainingApi.getEmployeeTrainingStatuses({
          keyword: filters.keyword || undefined,
          departmentId: filters.departmentId || undefined,
          jobPositionId: filters.jobPositionId || undefined,
          professionalFieldId: filters.professionalFieldId || undefined,
          complianceStatus: filters.complianceStatus || undefined,
          hasPendingReview: booleanOrUndefined(filters.hasPendingReview),
          requirementConfigured: booleanOrUndefined(filters.requirementConfigured),
          approvedHoursMin: filters.approvedHoursMin || undefined,
          approvedHoursMax: filters.approvedHoursMax || undefined,
          asOf: filters.asOf || undefined,
          page,
          size: 10,
          sort: 'employeeCode,asc',
        }),
        trainingApi.getDepartments(),
        trainingApi.getPositions(),
        trainingApi.getRecordOptions(),
      ])

      setResult(statusResponse.data.data)
      setDepartments(departmentsResponse.data.data ?? [])
      setPositions(positionsResponse.data.data ?? [])
      setProfessionalFields(optionsResponse.data.data?.professionalFields ?? [])
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không tải được danh sách giờ đào tạo nhân viên'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(fetchData, 0)

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

  const resetFilters = () => {
    setPage(0)
    setFilters(DEFAULT_FILTERS)
  }

  return (
    <main className="training-page">
      <section className="training-header">
        <div>
          <p className="training-eyebrow">Manager / Admin</p>
          <h1>Employee Training Hours</h1>
        </div>
      </section>

      <section className="training-grid">
        <div className="training-panel training-panel--wide">
          <div className="training-filters training-filters--employees">
            <label>
              Keyword
              <input
                onChange={(event) => updateFilter('keyword', event.target.value)}
                placeholder="Mã hoặc tên"
                value={filters.keyword}
              />
            </label>
            <label>
              Department
              <select onChange={(event) => updateFilter('departmentId', event.target.value)} value={filters.departmentId}>
                <option value="">All</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Position
              <select onChange={(event) => updateFilter('jobPositionId', event.target.value)} value={filters.jobPositionId}>
                <option value="">All</option>
                {positions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Professional field
              <select
                onChange={(event) => updateFilter('professionalFieldId', event.target.value)}
                value={filters.professionalFieldId}
              >
                <option value="">Default</option>
                {professionalFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Compliance
              <select
                onChange={(event) => updateFilter('complianceStatus', event.target.value)}
                value={filters.complianceStatus}
              >
                <option value="">All</option>
                <option value="COMPLIANT">COMPLIANT</option>
                <option value="AT_RISK">AT_RISK</option>
                <option value="NON_COMPLIANT">NON_COMPLIANT</option>
                <option value="NOT_CONFIGURED">NOT_CONFIGURED</option>
              </select>
            </label>
            <label>
              Pending
              <select
                onChange={(event) => updateFilter('hasPendingReview', event.target.value)}
                value={filters.hasPendingReview}
              >
                <option value="">All</option>
                <option value="true">Has pending</option>
                <option value="false">No pending</option>
              </select>
            </label>
            <label>
              Requirement
              <select
                onChange={(event) => updateFilter('requirementConfigured', event.target.value)}
                value={filters.requirementConfigured}
              >
                <option value="">All</option>
                <option value="true">Configured</option>
                <option value="false">Not configured</option>
              </select>
            </label>
            <label>
              Approved min
              <input
                min="0"
                onChange={(event) => updateFilter('approvedHoursMin', event.target.value)}
                step="0.01"
                type="number"
                value={filters.approvedHoursMin}
              />
            </label>
            <label>
              Approved max
              <input
                min="0"
                onChange={(event) => updateFilter('approvedHoursMax', event.target.value)}
                step="0.01"
                type="number"
                value={filters.approvedHoursMax}
              />
            </label>
            <label>
              As of
              <input onChange={(event) => updateFilter('asOf', event.target.value)} type="date" value={filters.asOf} />
            </label>
          </div>

          <div className="training-form-actions">
            <button className="training-button" disabled={!hasFilters} onClick={resetFilters} type="button">
              Reset
            </button>
          </div>
        </div>

        <div className="training-panel training-panel--wide">
          {errorMessage ? <div className="training-message training-message--error">{errorMessage}</div> : null}

          {isLoading ? (
            <div className="training-skeleton">Loading employee training hours...</div>
          ) : rows.length === 0 ? (
            <div className="training-empty">Không có nhân viên phù hợp.</div>
          ) : (
            <>
              <div className="training-table-wrap">
                <table className="training-table training-table--employee-status">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Position</th>
                      <th>Requirement</th>
                      <th>Required</th>
                      <th>Approved</th>
                      <th>Pending</th>
                      <th>Remaining</th>
                      <th>Status</th>
                      <th>Last date</th>
                      <th>Pending count</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => (
                      <tr key={item.employeeId}>
                        <td>
                          <strong>{item.employeeCode}</strong>
                          <br />
                          <span className="training-muted">{item.employeeName}</span>
                        </td>
                        <td>{item.departmentName || '-'}</td>
                        <td>{item.jobPositionName || '-'}</td>
                        <td>{item.requirementName || 'NOT CONFIGURED'}</td>
                        <td>{hours(item.requiredHours)}</td>
                        <td>{hours(item.approvedHours)}</td>
                        <td>{hours(item.pendingHours)}</td>
                        <td>{hours(item.remainingHours)}</td>
                        <td>
                          <span className={`training-badge ${statusClass(item.complianceStatus)}`}>
                            {item.complianceStatus}
                          </span>
                        </td>
                        <td>{item.lastTrainingDate || '-'}</td>
                        <td>{item.pendingReviewCount}</td>
                        <td>
                          <div className="training-actions">
                            <Link to={`/training/employees/${item.employeeId}`}>Detail</Link>
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
                  Page {result.page + 1} / {Math.max(result.totalPages, 1)}
                </span>
                <button
                  disabled={page + 1 >= result.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}

function booleanOrUndefined(value) {
  if (value === '') {
    return undefined
  }

  return value === 'true'
}

function hours(value) {
  return `${value ?? 0}h`
}

function statusClass(status) {
  if (status === 'COMPLIANT') {
    return 'is-active'
  }

  if (status === 'NOT_CONFIGURED') {
    return 'is-inactive'
  }

  return 'is-warning'
}

export default TrainingEmployeeStatusListPage
