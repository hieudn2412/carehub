import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import '../styles/training.css'

const DURATION_UNITS = ['HOUR', 'LESSON', 'CREDIT', 'DAY', 'MONTH', 'YEAR', 'OTHER']

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  defaultDurationUnit: 'HOUR',
  requiresEvidence: true,
  maxCreditedHoursPerRecord: '',
  sortOrder: 0,
  active: true,
  version: null,
}

function ActivityTypeFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(EMPTY_FORM)
  const [usageCount, setUsageCount] = useState(0)
  const [isLoading, setIsLoading] = useState(isEdit)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const codeLocked = useMemo(() => isEdit && usageCount > 0, [isEdit, usageCount])

  useEffect(() => {
    if (!isEdit) return

    let mounted = true
    const timer = window.setTimeout(() => {
      setIsLoading(true)
      trainingApi
        .getActivityType(id)
        .then((response) => {
          if (!mounted) return
          const item = response.data.data
          setForm({
            code: item.code ?? '',
            name: item.name ?? '',
            description: item.description ?? '',
            defaultDurationUnit: item.defaultDurationUnit ?? 'HOUR',
            requiresEvidence: Boolean(item.requiresEvidence),
            maxCreditedHoursPerRecord: item.maxCreditedHoursPerRecord ?? '',
            sortOrder: item.sortOrder ?? 0,
            active: Boolean(item.active),
            version: item.version,
          })
          setUsageCount(item.usageCount ?? 0)
        })
        .catch((error) => {
          if (!mounted) return
          setErrorMessage(getApiErrorMessage(error, 'Không tải được loại đào tạo'))
        })
        .finally(() => {
          if (!mounted) return
          setIsLoading(false)
        })
    }, 0)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [id, isEdit])

  const updateField = (name, value) => {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setIsSaving(true)

    const payload = {
      code: form.code,
      name: form.name,
      description: form.description || null,
      defaultDurationUnit: form.defaultDurationUnit,
      requiresEvidence: form.requiresEvidence,
      maxCreditedHoursPerRecord: form.maxCreditedHoursPerRecord
        ? Number(form.maxCreditedHoursPerRecord)
        : null,
      sortOrder: Number(form.sortOrder),
      active: form.active,
      version: form.version,
    }

    try {
      const response = isEdit
        ? await trainingApi.updateActivityType(id, payload)
        : await trainingApi.createActivityType(payload)
      navigate(`/admin/training/activity-types/${response.data.data.id}`)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không lưu được loại đào tạo'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="training-page">
      <section className="training-header">
        <div>
          <p className="training-eyebrow">Admin</p>
          <h1>{isEdit ? 'Edit Activity Type' : 'Create Activity Type'}</h1>
        </div>
        <Link className="training-button" to="/admin/training/activity-types">
          Back
        </Link>
      </section>

      <section className="training-panel training-panel--form">
        {isLoading ? (
          <div className="training-skeleton">Loading form...</div>
        ) : (
          <form className="training-form" onSubmit={handleSubmit}>
            {errorMessage ? <div className="training-message training-message--error">{errorMessage}</div> : null}

            <label>
              Code
              <input
                disabled={codeLocked}
                maxLength={50}
                minLength={2}
                onChange={(event) => updateField('code', event.target.value)}
                required
                value={form.code}
              />
              {codeLocked ? <small>Type đã được dùng nên không đổi code.</small> : null}
            </label>

            <label>
              Name
              <input
                maxLength={255}
                onChange={(event) => updateField('name', event.target.value)}
                required
                value={form.name}
              />
            </label>

            <label>
              Description
              <textarea
                maxLength={2000}
                onChange={(event) => updateField('description', event.target.value)}
                rows={4}
                value={form.description}
              />
            </label>

            <div className="training-form-grid">
              <label>
                Default duration unit
                <select
                  onChange={(event) => updateField('defaultDurationUnit', event.target.value)}
                  required
                  value={form.defaultDurationUnit}
                >
                  {DURATION_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Max credited hours/record
                <input
                  min="0.01"
                  onChange={(event) => updateField('maxCreditedHoursPerRecord', event.target.value)}
                  step="0.01"
                  type="number"
                  value={form.maxCreditedHoursPerRecord}
                />
              </label>

              <label>
                Sort order
                <input
                  min="0"
                  onChange={(event) => updateField('sortOrder', event.target.value)}
                  required
                  type="number"
                  value={form.sortOrder}
                />
              </label>
            </div>

            <label className="training-check">
              <input
                checked={form.requiresEvidence}
                onChange={(event) => updateField('requiresEvidence', event.target.checked)}
                type="checkbox"
              />
              Requires evidence
            </label>

            <label className="training-check">
              <input
                checked={form.active}
                onChange={(event) => updateField('active', event.target.checked)}
                type="checkbox"
              />
              Active
            </label>

            <div className="training-form-actions">
              <button className="training-button training-button--primary" disabled={isSaving} type="submit">
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <Link className="training-button" to="/admin/training/activity-types">
                Cancel
              </Link>
            </div>
          </form>
        )}
      </section>
    </main>
  )
}

export default ActivityTypeFormPage
