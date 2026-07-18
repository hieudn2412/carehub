import { useState, useEffect, useCallback } from 'react'
import { SaveOutlined, ReloadOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/TestConfigPage.css'

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
          minScore: i === 0 ? 0 : (i === 1 ? 40 : i === 2 ? 60 : i === 3 ? 75 : 90),
          maxScore: i === 0 ? 39.99 : i === 1 ? 59.99 : i === 2 ? 74.99 : i === 3 ? 89.99 : 100,
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

  useEffect(() => { loadThresholds() }, [loadThresholds])

  const updateThreshold = (level, field, value) => {
    setThresholds(prev => prev.map(t =>
      t.competencyLevel === level ? { ...t, [field]: value } : t
    ))
    setHasChanges(true)
  }

  const handleSave = async () => {
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
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="evd-page">
              <section className="evd-title-card">
                <div>
                  <h1>Ngưỡng phân loại năng lực</h1>
                  <p>Cấu hình điểm số tối thiểu/tối đa cho từng mức năng lực</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="evd-btn" onClick={loadThresholds} disabled={loading}>
                    <ReloadOutlined /> Tải lại
                  </button>
                  <button type="button" className="evd-btn evd-btn--primary" onClick={handleSave} disabled={saving || !hasChanges} style={{ minWidth: 140 }}>
                    <SaveOutlined /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </section>

              {loading ? (
                <section className="evd-panel evd-empty">Đang tải cấu hình...</section>
              ) : (
                <section className="evd-panel">
                  <div style={{ overflowX: 'auto' }}>
                    <table className="evd-table">
                      <thead>
                        <tr>
                          <th>Mức năng lực</th>
                          <th>Nhãn hiển thị</th>
                          <th>Điểm tối thiểu</th>
                          <th>Điểm tối đa</th>
                          <th>Màu sắc</th>
                        </tr>
                      </thead>
                      <tbody>
                        {thresholds.sort((a, b) => a.sortOrder - b.sortOrder).map((t) => (
                          <tr key={t.competencyLevel}>
                            <td>
                              <span style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                borderRadius: 20,
                                background: (t.colorHex || levelColors[t.competencyLevel]) + '20',
                                color: t.colorHex || levelColors[t.competencyLevel],
                                fontWeight: 600,
                                fontSize: 13,
                              }}>
                                {t.label || t.competencyLevel}
                              </span>
                            </td>
                            <td>
                              <input
                                value={t.label}
                                onChange={e => updateThreshold(t.competencyLevel, 'label', e.target.value)}
                                style={{
                                  width: 120,
                                  padding: '6px 10px',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 6,
                                  fontSize: 13,
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={t.minScore}
                                onChange={e => updateThreshold(t.competencyLevel, 'minScore', e.target.value)}
                                style={{
                                  width: 90,
                                  padding: '6px 10px',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 6,
                                  fontSize: 13,
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={t.maxScore}
                                onChange={e => updateThreshold(t.competencyLevel, 'maxScore', e.target.value)}
                                style={{
                                  width: 90,
                                  padding: '6px 10px',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 6,
                                  fontSize: 13,
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="color"
                                value={t.colorHex || levelColors[t.competencyLevel]}
                                onChange={e => updateThreshold(t.competencyLevel, 'colorHex', e.target.value)}
                                style={{
                                  width: 40,
                                  height: 32,
                                  padding: 2,
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  background: 'none',
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {thresholds.length > 0 && (
                    <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {thresholds.sort((a, b) => a.sortOrder - b.sortOrder).map(t => (
                        <span key={t.competencyLevel} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '6px 14px', borderRadius: 20,
                          background: (t.colorHex || levelColors[t.competencyLevel]) + '15',
                          color: t.colorHex || levelColors[t.competencyLevel],
                          fontWeight: 600, fontSize: 13,
                        }}>
                          {t.label} ({t.minScore}% - {t.maxScore}%)
                        </span>
                      ))}
                    </div>
                  )}

                  {hasChanges && (
                    <div className="evd-panel" style={{ marginTop: 16, padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#92400e' }}>
                      <WarningOutlined /> Bạn chưa lưu thay đổi. Nhấn "Lưu thay đổi" để áp dụng.
                    </div>
                  )}
                </section>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default CompetencyThresholdPage
