import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import '../styles/training.css'

function TrainingLegacyImportPage() {
  const [options, setOptions] = useState({ activityTypes: [], professionalFields: [] })
  const [batches, setBatches] = useState([])
  const [batch, setBatch] = useState(null)
  const [file, setFile] = useState(null)
  const [form, setForm] = useState({ activityTypeId: '', professionalFieldId: '' })
  const [selectedWarningRows, setSelectedWarningRows] = useState(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const rows = useMemo(() => batch?.rows ?? [], [batch])
  const warningRows = useMemo(() => rows.filter((row) => row.validationStatus === 'WARNING'), [rows])

  useEffect(() => {
    let mounted = true

    async function load() {
      setIsLoading(true)
      setErrorMessage('')
      try {
        const [optionsResponse, batchesResponse] = await Promise.all([
          trainingApi.getRecordOptions(),
          trainingApi.listLegacyImportBatches({ page: 0, size: 5 }),
        ])
        if (!mounted) return
        const nextOptions = optionsResponse.data.data ?? {}
        const activityTypes = nextOptions.activityTypes ?? []
        setOptions({
          activityTypes,
          professionalFields: nextOptions.professionalFields ?? [],
        })
        setBatches(batchesResponse.data.data?.content ?? [])
        setForm((current) => ({
          ...current,
          activityTypeId: current.activityTypeId || String(activityTypes[0]?.id ?? ''),
        }))
      } catch (error) {
        if (mounted) {
          setErrorMessage(getApiErrorMessage(error, 'Không tải được dữ liệu import'))
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  const preview = async () => {
    if (!file || !form.activityTypeId) {
      setErrorMessage('Chọn file Excel và activity type trước khi preview')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const response = await trainingApi.previewLegacyImport({
        file,
        activityTypeId: form.activityTypeId,
        professionalFieldId: form.professionalFieldId,
      })
      setBatch(response.data.data)
      setSelectedWarningRows(new Set())
      setSuccessMessage('Preview complete')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Preview import thất bại'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const apply = async (payload) => {
    if (!batch?.id) return

    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const response = await trainingApi.applyLegacyImport(batch.id, payload)
      setBatch(response.data.data)
      setSelectedWarningRows(new Set())
      setSuccessMessage('Apply complete')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Apply import thất bại'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleWarningRow = (rowId) => {
    setSelectedWarningRows((current) => {
      const next = new Set(current)
      if (next.has(rowId)) {
        next.delete(rowId)
      } else {
        next.add(rowId)
      }
      return next
    })
  }

  return (
    <main className="training-page">
      <section className="training-header">
        <div>
          <p className="training-eyebrow">Manager / Admin</p>
          <h1>Legacy Excel Import</h1>
        </div>
        <div className="training-header-actions">
          <Link className="training-button" to="/training/records">
            Records
          </Link>
          <Link className="training-button" to="/training/employees">
            Employee Hours
          </Link>
        </div>
      </section>

      <section className="training-grid">
        <div className="training-panel training-panel--wide">
          <div className="training-form-grid training-form-grid--import">
            <label>
              Activity type
              <select
                onChange={(event) => setForm((current) => ({ ...current, activityTypeId: event.target.value }))}
                value={form.activityTypeId}
              >
                <option value="">Select</option>
                {options.activityTypes.map((activityType) => (
                  <option key={activityType.id} value={activityType.id}>
                    {activityType.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Professional field
              <select
                onChange={(event) => setForm((current) => ({ ...current, professionalFieldId: event.target.value }))}
                value={form.professionalFieldId}
              >
                <option value="">None</option>
                {options.professionalFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Excel file
              <input
                accept=".xlsx,.xls"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
          </div>

          <div className="training-form-actions">
            <button className="training-button training-button--primary" disabled={isSubmitting} onClick={preview} type="button">
              Preview
            </button>
            <button
              className="training-button"
              disabled={!batch?.id || isSubmitting}
              onClick={() => apply({ commitWarnings: false, confirmedRowIds: [] })}
              type="button"
            >
              Apply Valid
            </button>
            <button
              className="training-button"
              disabled={!batch?.id || selectedWarningRows.size === 0 || isSubmitting}
              onClick={() => apply({ confirmedRowIds: Array.from(selectedWarningRows) })}
              type="button"
            >
              Apply Selected
            </button>
            <button
              className="training-button"
              disabled={!batch?.id || warningRows.length === 0 || isSubmitting}
              onClick={() => apply({ commitWarnings: true })}
              type="button"
            >
              Apply All Warnings
            </button>
          </div>
        </div>

        <div className="training-panel training-panel--wide">
          {errorMessage ? <div className="training-message training-message--error">{errorMessage}</div> : null}
          {successMessage ? <div className="training-message training-message--success">{successMessage}</div> : null}
          {isLoading ? <div className="training-skeleton">Loading import data...</div> : null}

          {batch ? (
            <>
              <div className="training-import-summary">
                <span>Total: {batch.totalRows}</span>
                <span>Success: {batch.successRows}</span>
                <span>Warning: {batch.warningRows}</span>
                <span>Failed: {batch.failedRows}</span>
                <span>Status: {batch.status}</span>
              </div>

              <div className="training-table-wrap">
                <table className="training-table training-table--legacy-import">
                  <thead>
                    <tr>
                      <th>Confirm</th>
                      <th>Row</th>
                      <th>Status</th>
                      <th>Employee</th>
                      <th>Program</th>
                      <th>Date</th>
                      <th>Duration</th>
                      <th>Evidence</th>
                      <th>Messages</th>
                      <th>Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {row.validationStatus === 'WARNING' ? (
                            <input
                              checked={selectedWarningRows.has(row.id)}
                              onChange={() => toggleWarningRow(row.id)}
                              type="checkbox"
                            />
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{row.sourceRowNumber}</td>
                        <td>
                          <span className={`training-badge ${statusClass(row.validationStatus)}`}>
                            {row.validationStatus}
                          </span>
                        </td>
                        <td>
                          <strong>{row.normalizedData?.employeeCode || row.rawData?.employeeCode || '-'}</strong>
                          <br />
                          <span className="training-muted">{row.normalizedData?.employeeName || '-'}</span>
                        </td>
                        <td>{row.normalizedData?.title || row.rawData?.title || '-'}</td>
                        <td>{row.normalizedData?.startDate || row.rawData?.trainingDate || '-'}</td>
                        <td>
                          <strong>{row.normalizedData?.durationRawText || row.rawData?.duration || '-'}</strong>
                          <br />
                          <span className="training-muted">
                            {row.normalizedData?.durationValue ?? '-'} {row.normalizedData?.durationUnit ?? ''}
                            {' / '}
                            {row.normalizedData?.declaredHours ?? '-'}h
                          </span>
                        </td>
                        <td className="training-cell-wrap">{row.normalizedData?.legacyExternalUrl || '-'}</td>
                        <td className="training-cell-wrap">
                          {messages(row.errors, 'Error')}
                          {messages(row.warnings, 'Warn')}
                        </td>
                        <td>
                          {row.trainingRecordId ? (
                            <Link to={`/training/records/${row.trainingRecordId}`}>#{row.trainingRecordId}</Link>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="training-empty">Chưa có batch preview.</div>
          )}
        </div>

        <div className="training-panel training-panel--wide">
          <h2>Recent Batches</h2>
          {batches.length === 0 ? (
            <div className="training-empty">Chưa có batch import.</div>
          ) : (
            <div className="training-table-wrap">
              <table className="training-table training-table--compact">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>File</th>
                    <th>Status</th>
                    <th>Rows</th>
                    <th>Imported at</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.originalFilename}</td>
                      <td>{item.status}</td>
                      <td>
                        {item.successRows}/{item.warningRows}/{item.failedRows}
                      </td>
                      <td>{formatDateTime(item.importedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

function messages(items = [], label) {
  if (!items.length) return null
  return (
    <ul className="training-inline-list">
      {items.map((item) => (
        <li key={`${label}-${item}`}>
          <strong>{label}:</strong> {item}
        </li>
      ))}
    </ul>
  )
}

function statusClass(status) {
  if (status === 'VALID' || status === 'IMPORTED') {
    return 'is-active'
  }

  if (status === 'WARNING') {
    return 'is-warning'
  }

  return 'is-inactive'
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default TrainingLegacyImportPage
