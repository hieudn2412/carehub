import { useEffect, useMemo, useState } from 'react'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import '../styles/training.css'

const TODAY = new Date().toISOString().slice(0, 10)

const EMPTY_FORM = {
  code: '',
  name: '',
  requiredHours: 120,
  cycleYears: 5,
  jobPositionId: '',
  departmentId: '',
  professionalFieldId: '',
  warningThresholdHours: '',
  effectiveFrom: TODAY,
  effectiveTo: '',
  active: true,
  version: null,
}

const DEFAULT_FILTERS = {
  keyword: '',
  active: '',
  departmentId: '',
  jobPositionId: '',
  professionalFieldId: '',
  effectiveOn: '',
}

function TrainingRequirementPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [requirements, setRequirements] = useState(null)
  const [departments, setDepartments] = useState([])
  const [positions, setPositions] = useState([])
  const [professionalFields, setProfessionalFields] = useState([])
  const [page, setPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const rows = requirements?.content ?? []
  const hasFilters = useMemo(
    () => Object.values(filters).some((value) => value !== ''),
    [filters],
  )

  const fetchData = async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const [requirementsResponse, departmentsResponse, positionsResponse, optionsResponse] = await Promise.all([
        trainingApi.getRequirements({
          keyword: filters.keyword || undefined,
          active: filters.active === '' ? undefined : filters.active === 'true',
          departmentId: filters.departmentId || undefined,
          jobPositionId: filters.jobPositionId || undefined,
          professionalFieldId: filters.professionalFieldId || undefined,
          effectiveOn: filters.effectiveOn || undefined,
          page,
          size: 10,
          sort: 'updatedAt,desc',
        }),
        trainingApi.getDepartments(),
        trainingApi.getPositions(),
        trainingApi.getRecordOptions(),
      ])

      setRequirements(requirementsResponse.data.data)
      setDepartments(departmentsResponse.data.data ?? [])
      setPositions(positionsResponse.data.data ?? [])
      setProfessionalFields(optionsResponse.data.data?.professionalFields ?? [])
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không tải được cấu hình requirement'))
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

  const updateForm = (name, value) => {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setMessage('')
  }

  const editRequirement = (item) => {
    setEditingId(item.id)
    setMessage('')
    setForm({
      code: item.code ?? '',
      name: item.name ?? '',
      requiredHours: item.requiredHours ?? 120,
      cycleYears: item.cycleYears ?? 5,
      jobPositionId: item.jobPositionId ?? '',
      departmentId: item.departmentId ?? '',
      professionalFieldId: item.professionalFieldId ?? '',
      warningThresholdHours: item.warningThresholdHours ?? '',
      effectiveFrom: item.effectiveFrom ?? TODAY,
      effectiveTo: item.effectiveTo ?? '',
      active: Boolean(item.active),
      version: item.version,
    })
  }

  const saveRequirement = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setErrorMessage('')
    setMessage('')

    const payload = {
      code: form.code,
      name: form.name,
      requiredHours: Number(form.requiredHours),
      cycleYears: Number(form.cycleYears),
      jobPositionId: numberOrNull(form.jobPositionId),
      departmentId: numberOrNull(form.departmentId),
      professionalFieldId: numberOrNull(form.professionalFieldId),
      warningThresholdHours: form.warningThresholdHours === '' ? null : Number(form.warningThresholdHours),
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
      active: form.active,
      version: form.version,
    }

    try {
      if (editingId) {
        await trainingApi.updateRequirement(editingId, payload)
        setMessage('Đã cập nhật requirement.')
      } else {
        await trainingApi.createRequirement(payload)
        setMessage('Đã tạo requirement.')
      }
      resetForm()
      fetchData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không lưu được requirement'))
    } finally {
      setIsSaving(false)
    }
  }

  const toggleStatus = async (item) => {
    const nextStatus = !item.active
    const label = nextStatus ? 'kích hoạt' : 'ngừng kích hoạt'
    if (!window.confirm(`Bạn muốn ${label} requirement "${item.name}"?`)) {
      return
    }

    try {
      await trainingApi.updateRequirementStatus(item.id, {
        active: nextStatus,
        version: item.version,
      })
      fetchData()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không cập nhật được trạng thái'))
    }
  }

  return (
    <main className="training-page">
      <section className="training-header">
        <div>
          <p className="training-eyebrow">Admin</p>
          <h1>Training Requirements</h1>
        </div>
      </section>

      <section className="training-grid">
        <div className="training-panel training-panel--wide">
          <div className="training-filters training-filters--requirements">
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
              <select onChange={(event) => updateFilter('active', event.target.value)} value={filters.active}>
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
            <label>
              Department
              <select
                onChange={(event) => updateFilter('departmentId', event.target.value)}
                value={filters.departmentId}
              >
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
              <select
                onChange={(event) => updateFilter('jobPositionId', event.target.value)}
                value={filters.jobPositionId}
              >
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
                <option value="">All</option>
                {professionalFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Effective on
              <input
                onChange={(event) => updateFilter('effectiveOn', event.target.value)}
                type="date"
                value={filters.effectiveOn}
              />
            </label>
          </div>

          {errorMessage ? <div className="training-message training-message--error">{errorMessage}</div> : null}
          {message ? <div className="training-message training-message--success">{message}</div> : null}

          {isLoading ? (
            <div className="training-skeleton">Loading requirements...</div>
          ) : rows.length === 0 ? (
            <div className="training-empty">
              {hasFilters ? 'Không có requirement phù hợp.' : 'Chưa có requirement.'}
            </div>
          ) : (
            <>
              <div className="training-table-wrap">
                <table className="training-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Required</th>
                      <th>Cycle</th>
                      <th>Scope</th>
                      <th>Effective</th>
                      <th>Warning</th>
                      <th>Employees</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => (
                      <tr key={item.id}>
                        <td>{item.code}</td>
                        <td>{item.name}</td>
                        <td>{item.requiredHours}</td>
                        <td>{item.cycleYears} năm</td>
                        <td>{scopeText(item)}</td>
                        <td>
                          {item.effectiveFrom}
                          <br />
                          <span className="training-muted">{item.effectiveTo || 'No end'}</span>
                        </td>
                        <td>{item.warningThresholdHours ?? '-'}</td>
                        <td>{item.applicableEmployeeCount}</td>
                        <td>
                          <span className={`training-badge ${item.active ? 'is-active' : 'is-inactive'}`}>
                            {item.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="training-actions">
                            <button onClick={() => editRequirement(item)} type="button">
                              Edit
                            </button>
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
                  Page {requirements.page + 1} / {Math.max(requirements.totalPages, 1)}
                </span>
                <button
                  disabled={page + 1 >= requirements.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>

        <div className="training-panel training-panel--wide">
          <h2>{editingId ? 'Edit requirement' : 'Create requirement'}</h2>
          <form className="training-form" onSubmit={saveRequirement}>
            <div className="training-form-grid training-form-grid--requirements">
              <label>
                Code
                <input
                  maxLength={50}
                  onChange={(event) => updateForm('code', event.target.value)}
                  required
                  value={form.code}
                />
              </label>
              <label>
                Name
                <input
                  maxLength={255}
                  onChange={(event) => updateForm('name', event.target.value)}
                  required
                  value={form.name}
                />
              </label>
              <label>
                Required hours
                <input
                  max="500"
                  min="0"
                  onChange={(event) => updateForm('requiredHours', event.target.value)}
                  required
                  step="0.01"
                  type="number"
                  value={form.requiredHours}
                />
              </label>
              <label>
                Cycle years
                <input
                  min="1"
                  onChange={(event) => updateForm('cycleYears', event.target.value)}
                  required
                  type="number"
                  value={form.cycleYears}
                />
              </label>
              <label>
                Warning threshold
                <input
                  min="0"
                  onChange={(event) => updateForm('warningThresholdHours', event.target.value)}
                  step="0.01"
                  type="number"
                  value={form.warningThresholdHours}
                />
              </label>
              <label>
                Department
                <select onChange={(event) => updateForm('departmentId', event.target.value)} value={form.departmentId}>
                  <option value="">Global</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Position
                <select
                  onChange={(event) => updateForm('jobPositionId', event.target.value)}
                  value={form.jobPositionId}
                >
                  <option value="">Any</option>
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
                  onChange={(event) => updateForm('professionalFieldId', event.target.value)}
                  value={form.professionalFieldId}
                >
                  <option value="">Any</option>
                  {professionalFields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Effective from
                <input
                  onChange={(event) => updateForm('effectiveFrom', event.target.value)}
                  required
                  type="date"
                  value={form.effectiveFrom}
                />
              </label>
              <label>
                Effective to
                <input
                  onChange={(event) => updateForm('effectiveTo', event.target.value)}
                  type="date"
                  value={form.effectiveTo}
                />
              </label>
            </div>

            <label className="training-check">
              <input
                checked={form.active}
                onChange={(event) => updateForm('active', event.target.checked)}
                type="checkbox"
              />
              Active
            </label>

            <div className="training-form-actions">
              <button className="training-button training-button--primary" disabled={isSaving} type="submit">
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button className="training-button" onClick={resetForm} type="button">
                Reset
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}

function scopeText(item) {
  return [
    item.departmentName || 'All departments',
    item.jobPositionName || 'All positions',
    item.professionalFieldName || 'All fields',
  ].join(' / ')
}

function numberOrNull(value) {
  return value === '' || value === null || value === undefined ? null : Number(value)
}

export default TrainingRequirementPage
