import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examConfigApi } from '../api/examConfigApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/ExamPaperPages.css'

const COGNITIVE = [
  ['FOUNDATION', 'Kiến thức nền tảng'],
  ['CLINICAL_APPLICATION', 'Áp dụng lâm sàng'],
  ['CLINICAL_REASONING_ANALYSIS', 'Tư duy và phân tích lâm sàng'],
]

function emptyField(id) {
  return { professionalFieldId: Number(id), questionCount: 0, cognitive: COGNITIVE.map(([level, label], index) => ({ cognitiveLevel: level, label, percentage: [30, 50, 20][index] })) }
}

function data(response, fallback) { return apiData(response, fallback) }

export default function ExamConfigPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [fields, setFields] = useState([])
  const [form, setForm] = useState({ name: '', description: '', totalQuestions: 30, timeLimitMinutes: 45, passingScore: 7, maxRetakes: 0 })
  const [blueprint, setBlueprint] = useState([])
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    trainingApi.getRecordOptions()
      .then((response) => {
        const options = data(response, {})
        setFields(options?.professionalFields || [])
      })
      .catch((error) => showToast(apiErrorMessage(error), 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  const totalAllocated = useMemo(() => blueprint.reduce((sum, item) => sum + Number(item.questionCount || 0), 0), [blueprint])
  const totalQuestions = Number(form.totalQuestions) || 0

  function toggleField(id) {
    setBlueprint((current) => current.some((item) => item.professionalFieldId === Number(id))
      ? current.filter((item) => item.professionalFieldId !== Number(id))
      : [...current, emptyField(id)])
  }

  function updateField(id, key, value) {
    if (key === 'questionCount') {
      value = Number(value) || 0
    }
    setBlueprint((current) => current.map((item) => item.professionalFieldId === id ? { ...item, [key]: value } : item))
  }

  function updateCognitive(fieldId, level, value) {
    setBlueprint((current) => current.map((item) => item.professionalFieldId !== fieldId ? item : { ...item, cognitive: item.cognitive.map((cell) => cell.cognitiveLevel === level ? { ...cell, percentage: value } : cell) }))
  }

  function payload(status = 'DRAFT') {
    return {
      name: form.name.trim(), description: form.description.trim() || null,
      totalQuestions, timeLimitMinutes: Number(form.timeLimitMinutes), passingScore: Number(form.passingScore),
      maxRetakes: Number(form.maxRetakes), shuffleQuestions: true, shuffleOptions: true,
      questionSelectionMode: 'FIXED_PAPER', status,
      fieldBlueprints: blueprint.map((field, index) => ({
        professionalFieldId: field.professionalFieldId, questionCount: Number(field.questionCount), displayOrder: index,
        cognitive: field.cognitive.map((cell) => ({ cognitiveLevel: cell.cognitiveLevel, percentage: Number(cell.percentage) })),
      })),
      sourceFilters: { includedCategoryIds: [], excludedCategoryIds: [], includedDocumentIds: [], excludedDocumentIds: [] },
    }
  }

  function validate() {
    if (!form.name.trim()) return 'Vui lòng nhập tên cấu hình.'
    if (!blueprint.length) return 'Vui lòng chọn ít nhất một lĩnh vực.'
    if (totalAllocated !== totalQuestions) return `Tổng số câu các lĩnh vực (${totalAllocated}) phải bằng tổng số câu (${totalQuestions}).`
    if (blueprint.some((field) => Math.abs(field.cognitive.reduce((sum, cell) => sum + Number(cell.percentage || 0), 0) - 100) > 0.001)) return 'Tổng tỷ lệ ba mức nhận thức trong mỗi lĩnh vực phải bằng 100%.'
    if (!totalQuestions || totalQuestions < 1) return 'Tổng số câu phải lớn hơn 0.'
    return ''
  }

  async function previewBlueprint() {
    const error = validate(); if (error) return showToast(error, 'warning')
    setSubmitting(true)
    try { setPreview(data(await examConfigApi.previewExamConfig(payload()), null)) } catch (err) { showToast(apiErrorMessage(err), 'error') } finally { setSubmitting(false) }
  }

  async function save(status) {
    const error = validate(); if (error) return showToast(error, 'warning')
    setSubmitting(true)
    try {
      const response = data(await examConfigApi.createExamConfig(payload(status)), null)
      showToast(status === 'ACTIVE' ? 'Đã kích hoạt cấu hình đề.' : 'Đã lưu cấu hình dạng nháp.', 'success')
      if (response?.id) navigate(`/admin/evaluation/exam-management?view=papers`)
    } catch (err) { showToast(apiErrorMessage(err), 'error') } finally { setSubmitting(false) }
  }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader back={{ to: '/admin/evaluation/exam-management', label: 'Quay lại' }} breadcrumbs={[{ label: 'Quản lý cấu hình đề' }, { label: 'Tạo ma trận đề' }]} />
        <main className="dashboard-body"><form className="exp-page" onSubmit={(event) => { event.preventDefault(); save('DRAFT') }}>
          <section className="exp-title-card"><div><h1 className="exp-title">Tạo ma trận đề kiểm tra</h1><p className="exp-subtitle">Cấu hình trực tiếp từ ngân hàng câu hỏi theo lĩnh vực và mức nhận thức.</p></div></section>
          <section className="exp-management-card">
            <div className="exam-flow__section"><h2>Thông tin chung</h2><div className="exam-flow__grid">
              <label>Tên cấu hình<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Kiểm tra điều dưỡng mới tuyển dụng" /></label>
              <label>Tổng số câu<input type="number" min="1" value={form.totalQuestions} onChange={(e) => setForm({ ...form, totalQuestions: e.target.value })} /></label>
              <label>Thời gian (phút)<input type="number" min="1" value={form.timeLimitMinutes} onChange={(e) => setForm({ ...form, timeLimitMinutes: e.target.value })} /></label>
              <label>Điểm đạt<input type="number" min="0" max="10" value={form.passingScore} onChange={(e) => setForm({ ...form, passingScore: e.target.value })} /></label>
            </div></div>
            <div className="exam-flow__section"><h2>Lĩnh vực chuyên môn</h2><div className="ch-toolbar" style={{ flexWrap: 'wrap' }}>{fields.map((field) => <button type="button" key={field.id} className={`ch-btn ${blueprint.some((item) => item.professionalFieldId === field.id) ? 'ch-btn--primary' : 'ch-btn--secondary'}`} onClick={() => toggleField(field.id)}>{field.name}</button>)}</div>
              {blueprint.map((item) => { const field = fields.find((value) => value.id === item.professionalFieldId); return <div key={item.professionalFieldId} className="ch-card" style={{ marginTop: 12 }}><h3>{field?.name || `Lĩnh vực #${item.professionalFieldId}`}</h3><label>Số câu<input type="number" min="0" value={item.questionCount} onChange={(e) => updateField(item.professionalFieldId, 'questionCount', e.target.value)} /></label><table className="exp-table"><thead><tr><th>Mức nhận thức</th><th>Tỷ lệ (%)</th></tr></thead><tbody>{item.cognitive.map((cell) => <tr key={cell.cognitiveLevel}><td>{cell.label}</td><td><input type="number" min="0" max="100" value={cell.percentage} onChange={(e) => updateCognitive(item.professionalFieldId, cell.cognitiveLevel, e.target.value)} /></td></tr>)}</tbody></table><div className="ch-muted">Tổng lĩnh vực: {item.cognitive.reduce((sum, cell) => sum + Number(cell.percentage || 0), 0)}%</div></div> })}
              <p className={totalAllocated === totalQuestions ? 'ch-muted' : 'ch-alert ch-alert--warning'}>Đã phân bổ: {totalAllocated} / {totalQuestions} câu</p>
            </div>
            {preview && <div className="ch-alert ch-alert--info"><strong>Preview: {preview.distributedQuestions} / {totalQuestions} câu</strong>{preview.warnings?.length > 0 && <ul>{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}{preview.blueprintFields?.map((field) => <div key={field.professionalFieldId}>{field.professionalFieldName}: {field.requiredQuestionCount} yêu cầu / {field.availableQuestionCount} khả dụng</div>)}</div>}
            <div className="exp-title-actions"><button type="button" className="exp-btn-secondary" onClick={previewBlueprint} disabled={loading || submitting}>Xem availability</button><button type="submit" className="exp-btn-secondary" disabled={loading || submitting}>Lưu nháp</button><button type="button" className="exp-btn-primary" onClick={() => save('ACTIVE')} disabled={loading || submitting}>Kích hoạt cấu hình</button></div>
          </section>
        </form></main>
      </div>
    </div>
  )
}
