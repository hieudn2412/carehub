import { useEffect, useState } from 'react'
import { trainingApi } from '../api/trainingApi.js'
import '../styles/training.css'

const FALLBACK_FOUNDATION = {
  module: 'Training Records Management',
  phase: 'phase_01_database_domain_security',
  enabledFoundations: [
    'database_migrations',
    'domain_entities',
    'repositories',
    'dto_mappers',
    'access_policy',
    'record_state_machine',
    'compliance_calculator',
  ],
  openBusinessDecisions: [
    'duration_conversion_rules',
    'credit_conversion_rules',
    'edit_count_policy',
    'approved_record_reopen_policy',
    'at_risk_formula',
  ],
}

function TrainingFoundationPage() {
  const [foundation, setFoundation] = useState(FALLBACK_FOUNDATION)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let mounted = true

    trainingApi
      .getFoundation()
      .then((response) => {
        if (!mounted) return
        setFoundation(response.data.data)
        setStatus('ready')
      })
      .catch(() => {
        if (!mounted) return
        setStatus('offline')
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <main className="training-page">
      <section className="training-header">
        <div>
          <p className="training-eyebrow">CareHub</p>
          <h1>{foundation.module}</h1>
        </div>
        <span className={`training-status training-status--${status}`}>
          {status === 'ready' ? 'API ready' : status === 'loading' ? 'Loading' : 'Local draft'}
        </span>
      </section>

      <section className="training-grid">
        <article className="training-panel">
          <h2>Foundation</h2>
          <p>{foundation.phase}</p>
          <ul>
            {foundation.enabledFoundations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="training-panel">
          <h2>Open Decisions</h2>
          <ul>
            {foundation.openBusinessDecisions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  )
}

export default TrainingFoundationPage
