import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import '../styles/training.css'

const EMPTY_FORM = {
  activityTypeId: '',
  professionalFieldId: '',
  title: '',
  provider: '',
  description: '',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  durationValue: '',
  durationUnit: 'HOUR',
  durationRawText: '',
  declaredHours: '',
  version: null,
}

function TrainingRecordFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(EMPTY_FORM)
  const [record, setRecord] = useState(null)
  const [options, setOptions] = useState({ activityTypes: [], professionalFields: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const selectedActivityType = useMemo(
    () => options.activityTypes.find((item) => String(item.id) === String(form.activityTypeId)),
    [form.activityTypeId, options.activityTypes],
  )

  useEffect(() => {
    let mounted = true

    async function load() {
      setIsLoading(true)
      setErrorMessage('')
      try {
        const [optionsResponse, recordResponse] = await Promise.all([
          trainingApi.getRecordOptions(),
          isEdit ? trainingApi.getRecord(id) : Promise.resolve(null),
        ])
        if (!mounted) return

        const nextOptions = optionsResponse.data.data
        setOptions(nextOptions)

        if (recordResponse) {
          const item = recordResponse.data.data
          setRecord(item)
          setForm(fromRecord(item))
        } else {
          const firstActivityType = nextOptions.activityTypes[0]
          setForm({
            ...EMPTY_FORM,
            activityTypeId: firstActivityType?.id ? String(firstActivityType.id) : '',
            durationUnit: firstActivityType?.defaultDurationUnit ?? 'HOUR',
          })
        }
      } catch (error) {
        if (!mounted) return
        setErrorMessage(getApiErrorMessage(error, 'Cannot load training form'))
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    const timer = window.setTimeout(load, 0)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [id, isEdit])

  const updateField = (name, value) => {
    setForm((current) => {
      if (name !== 'activityTypeId') {
        return { ...current, [name]: value }
      }

      const activityType = options.activityTypes.find((item) => String(item.id) === String(value))
      return {
        ...current,
        activityTypeId: value,
        durationUnit: activityType?.defaultDurationUnit ?? current.durationUnit,
      }
    })
  }

  const saveRecord = async () => {
    setErrorMessage('')
    setSuccessMessage('')
    setIsSaving(true)
    try {
      const payload = toPayload(form)
      const response = isEdit
        ? await trainingApi.updateRecord(id, payload)
        : await trainingApi.createRecord(payload)
      const saved = response.data.data
      setRecord(saved)
      setForm(fromRecord(saved))
      setSuccessMessage(saved.duplicateWarning ? 'Saved. Duplicate warning detected.' : 'Saved.')
      if (!isEdit) {
        navigate(`/training/records/${saved.id}/edit`, { replace: true })
      }
      return saved
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Cannot save training record'))
      return null
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmitForm = async (event) => {
    event.preventDefault()
    await saveRecord()
  }

  const handleSubmitRecord = async () => {
    const saved = record ?? (await saveRecord())
    if (!saved) return

    setErrorMessage('')
    setSuccessMessage('')
    setIsSaving(true)
    try {
      const response = await trainingApi.submitRecord(saved.id, { version: saved.version })
      const submitted = response.data.data
      setRecord(submitted)
      setForm(fromRecord(submitted))
      setSuccessMessage('Submitted for review.')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Cannot submit training record'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="training-page">
      <section className="training-header">
        <div>
          <p className="training-eyebrow">Training</p>
          <h1>{isEdit ? 'Edit Training Record' : 'New Training Record'}</h1>
        </div>
        <div className="training-header-actions">
          {record ? (
            <Link className="training-button" to={`/training/records/${record.id}/evidence`}>
              Evidence
            </Link>
          ) : null}
          <Link className="training-button" to="/training">
            Back
          </Link>
        </div>
      </section>

      <section className="training-panel training-panel--form">
        {isLoading ? (
          <div className="training-skeleton">Loading form...</div>
        ) : (
          <form className="training-form" onSubmit={handleSubmitForm}>
            {errorMessage ? <div className="training-message training-message--error">{errorMessage}</div> : null}
            {successMessage ? <div className="training-message training-message--success">{successMessage}</div> : null}
            {record?.workflowStatus ? (
              <div className="training-note">
                Status: <strong>{record.workflowStatus}</strong> | Version: {record.version}
              </div>
            ) : null}

            <label>
              Activity type
              <select
                onChange={(event) => updateField('activityTypeId', event.target.value)}
                required
                value={form.activityTypeId}
              >
                <option value="">Select activity type</option>
                {options.activityTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {selectedActivityType?.requiresEvidence ? <small>Evidence is required before submit.</small> : null}
            </label>

            <label>
              Title
              <input
                maxLength={500}
                onChange={(event) => updateField('title', event.target.value)}
                required
                value={form.title}
              />
            </label>

            <div className="training-form-grid training-form-grid--compact">
              <label>
                Start date
                <input
                  onChange={(event) => updateField('startDate', event.target.value)}
                  required
                  type="date"
                  value={form.startDate}
                />
              </label>
              <label>
                End date
                <input
                  onChange={(event) => updateField('endDate', event.target.value)}
                  type="date"
                  value={form.endDate}
                />
              </label>
              <label>
                Declared hours
                <input
                  min="0.5"
                  onChange={(event) => updateField('declaredHours', event.target.value)}
                  required
                  step="0.5"
                  type="number"
                  value={form.declaredHours}
                />
              </label>
            </div>

            <div className="training-form-grid training-form-grid--compact">
              <label>
                Start time
                <input
                  onChange={(event) => updateField('startTime', event.target.value)}
                  type="time"
                  value={form.startTime}
                />
              </label>
              <label>
                End time
                <input
                  onChange={(event) => updateField('endTime', event.target.value)}
                  type="time"
                  value={form.endTime}
                />
              </label>
              <label>
                Duration unit
                <select onChange={(event) => updateField('durationUnit', event.target.value)} value={form.durationUnit}>
                  {['HOUR', 'LESSON', 'CREDIT', 'DAY', 'MONTH', 'YEAR', 'OTHER'].map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="training-form-grid training-form-grid--compact">
              <label>
                Provider
                <input
                  maxLength={255}
                  onChange={(event) => updateField('provider', event.target.value)}
                  value={form.provider}
                />
              </label>
              <label>
                Duration value
                <input
                  min="0"
                  onChange={(event) => updateField('durationValue', event.target.value)}
                  step="0.5"
                  type="number"
                  value={form.durationValue}
                />
              </label>
              <label>
                Professional field
                <select
                  onChange={(event) => updateField('professionalFieldId', event.target.value)}
                  value={form.professionalFieldId}
                >
                  <option value="">None</option>
                  {options.professionalFields.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Duration raw text
              <input
                maxLength={100}
                onChange={(event) => updateField('durationRawText', event.target.value)}
                value={form.durationRawText}
              />
            </label>

            <label>
              Description
              <textarea
                onChange={(event) => updateField('description', event.target.value)}
                rows={4}
                value={form.description}
              />
            </label>

            <div className="training-form-actions">
              <button className="training-button training-button--primary" disabled={isSaving} type="submit">
                {isSaving ? 'Saving...' : 'Save Draft'}
              </button>
              {record ? (
                <>
                  <Link className="training-button" to={`/training/records/${record.id}/evidence`}>
                    Manage Evidence
                  </Link>
                  <button className="training-button" disabled={isSaving} onClick={handleSubmitRecord} type="button">
                    Submit
                  </button>
                </>
              ) : null}
            </div>
          </form>
        )}
      </section>
    </main>
  )
}

function fromRecord(record) {
  return {
    activityTypeId: record.activityTypeId ? String(record.activityTypeId) : '',
    professionalFieldId: record.professionalFieldId ? String(record.professionalFieldId) : '',
    title: record.title ?? '',
    provider: record.provider ?? '',
    description: record.description ?? '',
    startDate: record.startDate ?? '',
    endDate: record.endDate ?? '',
    startTime: record.startTime ?? '',
    endTime: record.endTime ?? '',
    durationValue: record.durationValue ?? '',
    durationUnit: record.durationUnit ?? 'HOUR',
    durationRawText: record.durationRawText ?? '',
    declaredHours: record.declaredHours ?? '',
    version: record.version,
  }
}

function toPayload(form) {
  return {
    activityTypeId: Number(form.activityTypeId),
    professionalFieldId: form.professionalFieldId ? Number(form.professionalFieldId) : null,
    title: form.title,
    provider: form.provider || null,
    description: form.description || null,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    startTime: form.startTime || null,
    endTime: form.endTime || null,
    durationValue: form.durationValue ? Number(form.durationValue) : null,
    durationUnit: form.durationUnit,
    durationRawText: form.durationRawText || null,
    declaredHours: form.declaredHours ? Number(form.declaredHours) : null,
    version: form.version,
  }
}

export default TrainingRecordFormPage
