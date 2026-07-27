import { useState, useEffect, useCallback } from 'react'
import { SaveOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/TestConfigPage.css'
import '../styles/EvaluationDashboardPage.css'

const DEFAULT_LEVELS = [
  { competencyLevel: 'NOT_COMPETENT', label: 'Chưa đạt', colorHex: '#ef4444', sortOrder: 1 },
  { competencyLevel: 'BEGINNER', label: 'Sơ cấp', colorHex: '#f59e0b', sortOrder: 2 },
  { competencyLevel: 'BASIC', label: 'Cơ bản', colorHex: '#3b82f6', sortOrder: 3 },
  { competencyLevel: 'PROFICIENT', label: 'Thành thạo', colorHex: '#10b981', sortOrder: 4 },
  { competencyLevel: 'ADVANCED', label: 'Chuyên sâu', colorHex: '#8b5cf6', sortOrder: 5 },
]

function CompetencyThresholdPage() {
  const { showToast } = useToast()
  const [thresholds, setThresholds] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const loadThresholds = useCallback(async () => {
    setLoading(true)
    try {
      const response = await competencyApi.getThresholds()
      const data = apiData(response, [])
      if (data.length === 0) {
        setThresholds(DEFAULT_LEVELS.map((l, i) => ({
          ...l,
          minScore: i === 0 ? 0 : (i === 1 ? 4 : i === 2 ? 6 : i === 3 ? 7.5 : 9),
          maxScore: i === 0 ? 3.99 : i === 1 ? 5.99 : i === 2 ? 7.49 : i === 3 ? 8.99 : 10,
        })))
      } else {
        setThresholds(data.map(t => ({
          competencyLevel: t.competencyLevel,
          minScore: t.minScore,
          maxScore: t.maxScore,
          label: t.label,
          colorHex: t.colorHex || DEFAULT_LEVELS.find(d => d.competencyLevel === t.competencyLevel)?.colorHex || '#6b7280',
          sortOrder: t.sortOrder,
        })))
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    // Hydrate thresholds from the API when the page mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadThresholds()
  }, [loadThresholds])

  const sortedThresholds = [...thresholds].sort((a, b) => a.sortOrder - b.sortOrder)

  const validationErrors = sortedThresholds.reduce((errors, threshold, index) => {
    const min = Number(threshold.minScore)
    const max = Number(threshold.maxScore)
    const previous = sortedThresholds[index - 1]
    const previousMax = previous ? Number(previous.maxScore) : null
    const rowErrors = []
    if (!Number.isFinite(min) || !Number.isFinite(max)) rowErrors.push('Điểm phải là số hợp lệ.')
    if ((Number.isFinite(min) && (min < 0 || min > 10)) || (Number.isFinite(max) && (max < 0 || max > 10))) rowErrors.push('Điểm phải nằm trong khoảng 0–10.')
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) rowErrors.push('Điểm tối thiểu không được lớn hơn điểm tối đa.')
    if (index === 0 && min !== 0) rowErrors.push('Mức đầu tiên phải bắt đầu từ 0.')
    if (index === sortedThresholds.length - 1 && max !== 10) rowErrors.push('Mức cuối cùng phải kết thúc ở 10.')
    if (previousMax !== null && Number.isFinite(min) && Math.abs(min - (previousMax + 0.01)) > 0.001) rowErrors.push('Khoảng điểm phải liền nhau, không chồng lấn hoặc bỏ trống.')
    if (rowErrors.length) errors[threshold.competencyLevel] = rowErrors.join(' ')
    return errors
  }, {})
  const hasValidationErrors = Object.keys(validationErrors).length > 0

  const updateThreshold = (level, field, value) => {
    setThresholds(prev => prev.map(t =>
      t.competencyLevel === level ? { ...t, [field]: value } : t
    ))
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (hasValidationErrors) {
      showToast('Vui lòng kiểm tra lại các khoảng điểm trước khi lưu.', 'warning')
      return
    }
    setSaving(true)
    try {
      const payload = {
        categoryId: null,
        thresholds: thresholds.map(t => ({
          competencyLevel: t.competencyLevel,
          minScore: Number(t.minScore),
          maxScore: Number(t.maxScore),
          label: t.label,
          colorHex: t.colorHex,
          sortOrder: t.sortOrder,
        })),
      }
      await competencyApi.updateThresholds(payload)
      showToast('Cập nhật ngưỡng phân loại thành công!', 'success')
      setHasChanges(false)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  const breadcrumbs = [{ label: 'Đánh giá' }, { label: 'Ngưỡng phân loại năng lực' }]

  const levelColors = {
    NOT_COMPETENT: '#ef4444',
    BEGINNER: '#f59e0b',
    BASIC: '#3b82f6',
    PROFICIENT: '#10b981',
    ADVANCED: '#8b5cf6',
  }

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <div className="evd-page">
        <section className="evd-title-card">
          <div>
            <h1>Ngưỡng phân loại năng lực</h1>
            <p>Cấu hình điểm số tối thiểu/tối đa cho từng mức năng lực (thang điểm 0–10)</p>
          </div>
          <div className="evd-title-actions">
            <button type="button" className="evd-btn" onClick={loadThresholds} disabled={loading}>
              <ReloadOutlined /> Tải lại
            </button>
            <button type="button" className="evd-btn evd-btn--primary" onClick={handleSave} disabled={saving || !hasChanges || hasValidationErrors}>
              <SaveOutlined /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </section>

        {loading ? (
          <section className="evd-panel evd-empty">Đang tải cấu hình...</section>
        ) : (
          <section className="evd-panel">
            <div className="evd-table-scroll">
              <table className="evd-table admin-table-uppercase">
                <thead>
                  <tr>
                    <th>Mức năng lực</th>
                    <th>Nhãn hiển thị</th>
                    <th>Điểm tối thiểu (0–10)</th>
                    <th>Điểm tối đa (0–10)</th>
                    <th>Màu sắc</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedThresholds.map((t) => (
                    <tr key={t.competencyLevel} className={validationErrors[t.competencyLevel] ? 'evd-threshold-row--invalid' : ''}>
                      <td>
                        <span className="evd-level-badge" style={{ '--level-color': t.colorHex || levelColors[t.competencyLevel] }}>
                          {t.label || t.competencyLevel}
                        </span>
                      </td>
                      <td>
                        <input
                          value={t.label}
                          onChange={e => updateThreshold(t.competencyLevel, 'label', e.target.value)}
                          className="evd-threshold-input evd-threshold-input--label"
                          aria-label={`Nhãn hiển thị cho ${t.label || t.competencyLevel}`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="10"
                          value={t.minScore}
                          onChange={e => updateThreshold(t.competencyLevel, 'minScore', e.target.value)}
                          className="evd-threshold-input"
                          aria-label={`Điểm tối thiểu cho ${t.label || t.competencyLevel}`}
                          aria-invalid={Boolean(validationErrors[t.competencyLevel])}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="10"
                          value={t.maxScore}
                          onChange={e => updateThreshold(t.competencyLevel, 'maxScore', e.target.value)}
                          className="evd-threshold-input"
                          aria-label={`Điểm tối đa cho ${t.label || t.competencyLevel}`}
                          aria-invalid={Boolean(validationErrors[t.competencyLevel])}
                        />
                      </td>
                      <td>
                        <input
                          type="color"
                          value={t.colorHex || levelColors[t.competencyLevel]}
                          onChange={e => updateThreshold(t.competencyLevel, 'colorHex', e.target.value)}
                          className="evd-color-input"
                          aria-label={`Màu cho ${t.label || t.competencyLevel}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {thresholds.length > 0 && (
              <div className="evd-threshold-legend">
                {sortedThresholds.map(t => (
                  <span key={t.competencyLevel} className="evd-threshold-legend__item" style={{ '--level-color': t.colorHex || levelColors[t.competencyLevel] }}>
                    {t.label} ({t.minScore} - {t.maxScore} điểm)
                  </span>
                ))}
              </div>
            )}

            {hasValidationErrors && (
              <div className="evd-validation-summary" role="alert">
                <WarningOutlined /> <span>{Object.values(validationErrors).join(' ')}</span>
              </div>
            )}

            {hasChanges && (
              <div className="evd-unsaved-notice">
                <WarningOutlined /> Bạn chưa lưu thay đổi. Nhấn "Lưu thay đổi" để áp dụng.
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  )
}

export default CompetencyThresholdPage
