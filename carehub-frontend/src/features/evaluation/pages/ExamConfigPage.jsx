import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import DepartmentCombobox from '../../admin/components/DepartmentCombobox.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examConfigApi } from '../api/examConfigApi.js'
import { examPaperApi } from '../api/examPaperApi.js'
import { examAssignmentApi } from '../api/examAssignmentApi.js'
import { evaluationAudienceApi } from '../api/evaluationAudienceApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
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

function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `key-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function data(response, fallback) { return apiData(response, fallback) }

export default function ExamConfigPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  // Matrix (ma trận đề)
  const [fields, setFields] = useState([])
  const [form, setForm] = useState({ name: '', description: '', totalQuestions: 30, timeLimitMinutes: 45, passingScore: 7, maxRetakes: 0 })
  const [blueprint, setBlueprint] = useState([])
  const [preview, setPreview] = useState(null)

  // Audience (đối tượng nhận đề)
  const [audienceMode, setAudienceMode] = useState('DEPARTMENT')
  const [departments, setDepartments] = useState([])
  const [selectedDepartments, setSelectedDepartments] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [userSearchResults, setUserSearchResults] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])

  // Schedule (lịch giao đề)
  const [availableFrom, setAvailableFrom] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [maxAttempts, setMaxAttempts] = useState(1)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitStep, setSubmitStep] = useState('')

  useEffect(() => {
    Promise.all([trainingApi.getRecordOptions(), adminApi.getDepartments()])
      .then(([optionsRes, deptRes]) => {
        setFields(data(optionsRes, {})?.professionalFields || [])
        setDepartments(data(deptRes, []) || [])
      })
      .catch((error) => showToast(apiErrorMessage(error), 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  useEffect(() => {
    if (audienceMode !== 'USER' || !userSearch.trim()) { setUserSearchResults([]); return undefined }
    const timer = setTimeout(async () => {
      try {
        const res = await adminApi.getUsers({ search: userSearch, size: 10 })
        setUserSearchResults(data(res, {})?.content || data(res, []) || [])
      } catch (error) {
        showToast(apiErrorMessage(error), 'error')
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [userSearch, audienceMode, showToast])

  const totalAllocated = useMemo(() => blueprint.reduce((sum, item) => sum + Number(item.questionCount || 0), 0), [blueprint])
  const totalQuestions = Number(form.totalQuestions) || 0

  function addField(id) {
    const numId = Number(id)
    setBlueprint((current) => current.some((item) => item.professionalFieldId === numId) ? current : [...current, emptyField(numId)])
  }

  function removeField(id) {
    setBlueprint((current) => current.filter((item) => item.professionalFieldId !== id))
  }

  function updateField(id, key, value) {
    if (key === 'questionCount') value = Number(value) || 0
    setBlueprint((current) => current.map((item) => item.professionalFieldId === id ? { ...item, [key]: value } : item))
  }

  function updateCognitive(fieldId, level, value) {
    setBlueprint((current) => current.map((item) => item.professionalFieldId !== fieldId ? item : { ...item, cognitive: item.cognitive.map((cell) => cell.cognitiveLevel === level ? { ...cell, percentage: value } : cell) }))
  }

  function addDepartment(deptId) {
    const dept = departments.find((d) => String(d.id) === String(deptId))
    if (dept && !selectedDepartments.some((d) => d.id === dept.id)) setSelectedDepartments([...selectedDepartments, dept])
  }
  function removeDepartment(deptId) { setSelectedDepartments(selectedDepartments.filter((d) => d.id !== deptId)) }
  function addUser(user) {
    if (!selectedUsers.some((u) => u.id === user.id)) setSelectedUsers([...selectedUsers, user])
    setUserSearch('')
    setUserSearchResults([])
  }
  function removeUser(userId) { setSelectedUsers(selectedUsers.filter((u) => u.id !== userId)) }

  function matrixPayload(status = 'DRAFT') {
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
    if (!form.name.trim()) return 'Vui lòng nhập tên bài kiểm tra.'
    if (!blueprint.length) return 'Vui lòng chọn ít nhất một lĩnh vực.'
    if (totalAllocated !== totalQuestions) return `Tổng số câu các lĩnh vực (${totalAllocated}) phải bằng tổng số câu (${totalQuestions}).`
    if (blueprint.some((field) => Math.abs(field.cognitive.reduce((sum, cell) => sum + Number(cell.percentage || 0), 0) - 100) > 0.001)) return 'Tổng tỷ lệ ba mức nhận thức trong mỗi lĩnh vực phải bằng 100%.'
    if (!totalQuestions || totalQuestions < 1) return 'Tổng số câu phải lớn hơn 0.'
    if (audienceMode === 'DEPARTMENT' && selectedDepartments.length === 0) return 'Vui lòng chọn ít nhất một khoa phòng.'
    if (audienceMode === 'USER' && selectedUsers.length === 0) return 'Vui lòng chọn ít nhất một nhân viên.'
    if (availableFrom && dueAt && availableFrom >= dueAt) return 'Thời điểm mở đề phải sớm hơn hạn hoàn thành.'
    return ''
  }

  async function previewBlueprint() {
    const error = validate()
    if (error) return showToast(error, 'warning')
    setSubmitting(true)
    setSubmitStep('Đang kiểm tra nguồn câu hỏi...')
    try {
      setPreview(data(await examConfigApi.previewExamConfig(matrixPayload()), null))
    } catch (err) {
      showToast(apiErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
      setSubmitStep('')
    }
  }

  function buildRuleJson() {
    if (audienceMode === 'DEPARTMENT') {
      return JSON.stringify({ version: 1, all: [{ type: 'DEPARTMENT_IN', ids: selectedDepartments.map((d) => d.id) }] })
    }
    return JSON.stringify({ version: 1, all: [{ type: 'USER_IN', ids: selectedUsers.map((u) => u.id) }] })
  }

  async function createAndAssign() {
    const error = validate()
    if (error) return showToast(error, 'warning')
    setSubmitting(true)
    try {
      setSubmitStep('Đang kiểm tra nguồn câu hỏi...')
      const check = data(await examConfigApi.previewExamConfig(matrixPayload()), null)
      if (check && check.valid === false) {
        showToast((check.warnings || []).join('; ') || 'Ngân hàng câu hỏi chưa đủ nguồn theo ma trận đã chọn.', 'warning')
        setPreview(check)
        return
      }

      setSubmitStep('Đang tạo ma trận đề...')
      const config = data(await examConfigApi.createExamConfig(matrixPayload('ACTIVE')), null)

      setSubmitStep('Đang sinh mã đề...')
      const papers = data(await examPaperApi.generateExamPapers({
        examConfigId: config.id, namePrefix: null, variantCount: 1, randomSeed: null, zeroOverlap: false,
        idempotencyKey: newIdempotencyKey(),
      }), [])
      const paper = papers[0]

      setSubmitStep('Đang phát hành đề...')
      await examPaperApi.publishExamPaper(paper.id)

      setSubmitStep('Đang tạo đối tượng nhận đề...')
      const audience = data(await evaluationAudienceApi.create({ name: `${form.name.trim()} - Đối tượng thi`, ruleJson: buildRuleJson() }), null)
      await evaluationAudienceApi.activate(audience.id)

      setSubmitStep('Đang giao đề...')
      await examAssignmentApi.createAssignment({
        name: form.name.trim(),
        description: form.description.trim() || null,
        examPaperId: paper.id,
        audienceId: audience.id,
        availableFrom: availableFrom || null,
        dueAt: dueAt || null,
        maxAttempts: Number(maxAttempts),
        shuffleQuestions: true,
        shuffleOptions: true,
        resultVisibility: 'SCORE_ONLY',
        status: 'OPEN',
        variantPolicy: 'FIXED_PAPER',
        retakeVariantPolicy: 'KEEP_VARIANT',
        idempotencyKey: newIdempotencyKey(),
      })

      showToast('Đã tạo và giao bài kiểm tra thành công.', 'success')
      navigate('/admin/evaluation/exam-management?view=assignments')
    } catch (err) {
      showToast(apiErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
      setSubmitStep('')
    }
  }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader back={{ to: '/admin/evaluation/exam-management', label: 'Quay lại' }} breadcrumbs={[{ label: 'Quản lý bài kiểm tra' }, { label: 'Tạo bài kiểm tra mới' }]} />
        <main className="dashboard-body"><form className="exp-page" onSubmit={(event) => { event.preventDefault(); createAndAssign() }}>
          <section className="exp-title-card"><div><h1 className="exp-title">Tạo và giao bài kiểm tra</h1><p className="exp-subtitle">Một trang duy nhất: cấu hình ma trận đề, chọn đối tượng nhận và giao đề ngay.</p></div></section>

          <section className="exp-management-card">
            <div className="exam-flow__section"><h2>1. Thông tin chung</h2><div className="ch-form-grid">
              <div className="ch-field"><label>Tên bài kiểm tra</label><input className="ch-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Kiểm tra điều dưỡng mới tuyển dụng" /></div>
              <div className="ch-field"><label>Tổng số câu</label><input className="ch-input" type="number" min="1" value={form.totalQuestions} onChange={(e) => setForm({ ...form, totalQuestions: e.target.value })} /></div>
              <div className="ch-field"><label>Thời gian (phút)</label><input className="ch-input" type="number" min="1" value={form.timeLimitMinutes} onChange={(e) => setForm({ ...form, timeLimitMinutes: e.target.value })} /></div>
              <div className="ch-field"><label>Điểm đạt</label><input className="ch-input" type="number" min="0" max="10" value={form.passingScore} onChange={(e) => setForm({ ...form, passingScore: e.target.value })} /></div>
            </div></div>

            <div className="exam-flow__section"><h2>2. Lĩnh vực chuyên môn và số câu</h2>
              <div className="ch-field">
                <label>Chọn lĩnh vực chuyên môn</label>
                <DepartmentCombobox departments={fields} value="" onChange={addField} placeholder="Tìm và chọn lĩnh vực chuyên môn" emptyValue="" />
              </div>
              {blueprint.length > 0 && (
                <div style={{ marginTop: 4, marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {blueprint.map((item) => { const field = fields.find((value) => value.id === item.professionalFieldId); return (
                    <span key={item.professionalFieldId} className="ch-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 4 }}>
                      {field?.name || `Lĩnh vực #${item.professionalFieldId}`}
                      <button type="button" onClick={() => removeField(item.professionalFieldId)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                    </span>
                  ) })}
                </div>
              )}
              {blueprint.map((item) => { const field = fields.find((value) => value.id === item.professionalFieldId); return <div key={item.professionalFieldId} className="ch-card" style={{ marginTop: 12 }}><h3>{field?.name || `Lĩnh vực #${item.professionalFieldId}`}</h3><div className="ch-field" style={{ maxWidth: 200 }}><label>Số câu</label><input className="ch-input" type="number" min="0" value={item.questionCount} onChange={(e) => updateField(item.professionalFieldId, 'questionCount', e.target.value)} /></div><table className="exp-table"><thead><tr><th>Mức nhận thức</th><th>Tỷ lệ (%)</th></tr></thead><tbody>{item.cognitive.map((cell) => <tr key={cell.cognitiveLevel}><td>{cell.label}</td><td><input className="ch-input" type="number" min="0" max="100" value={cell.percentage} onChange={(e) => updateCognitive(item.professionalFieldId, cell.cognitiveLevel, e.target.value)} /></td></tr>)}</tbody></table><div className="ch-muted">Tổng lĩnh vực: {item.cognitive.reduce((sum, cell) => sum + Number(cell.percentage || 0), 0)}%</div></div> })}
              <p className={totalAllocated === totalQuestions ? 'ch-muted' : 'ch-alert ch-alert--warning'}>Đã phân bổ: {totalAllocated} / {totalQuestions} câu</p>
            </div>

            <div className="exam-flow__section"><h2>3. Đối tượng nhận đề</h2>
              <div className="ch-toolbar" style={{ marginBottom: 12 }}>
                <button type="button" className={`ch-btn ${audienceMode === 'DEPARTMENT' ? 'ch-btn--primary' : 'ch-btn--secondary'}`} onClick={() => setAudienceMode('DEPARTMENT')}>Theo khoa phòng</button>
                <button type="button" className={`ch-btn ${audienceMode === 'USER' ? 'ch-btn--primary' : 'ch-btn--secondary'}`} onClick={() => setAudienceMode('USER')}>Theo mã nhân viên</button>
              </div>
              {audienceMode === 'DEPARTMENT' && (
                <div>
                  <DepartmentCombobox departments={departments} value="" onChange={addDepartment} placeholder="Tìm và chọn khoa phòng" emptyValue="" />
                  {selectedDepartments.length > 0 && <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedDepartments.map((dept) => <span key={dept.id} className="ch-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 4 }}>{dept.name}<button type="button" onClick={() => removeDepartment(dept.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>×</button></span>)}
                  </div>}
                </div>
              )}
              {audienceMode === 'USER' && (
                <div>
                  <input className="ch-input" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Nhập mã hoặc tên nhân viên" style={{ maxWidth: 400 }} />
                  {userSearchResults.length > 0 && <div style={{ marginTop: 8, border: '1px solid #d9d9d9', borderRadius: 4, maxWidth: 400 }}>
                    {userSearchResults.filter((u) => !selectedUsers.some((su) => su.id === u.id)).map((user) => <div key={user.id} onClick={() => addUser(user)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}>{user.employeeCode || `USR-${user.id}`} — {user.fullName || user.username}</div>)}
                  </div>}
                  {selectedUsers.length > 0 && <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedUsers.map((user) => <span key={user.id} className="ch-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>{user.employeeCode || `USR-${user.id}`}<button type="button" onClick={() => removeUser(user.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>×</button></span>)}
                  </div>}
                </div>
              )}
            </div>

            <div className="exam-flow__section"><h2>4. Lịch giao đề</h2><div className="ch-form-grid ch-form-grid--3">
              <div className="ch-field"><label>Mở đề lúc</label><input className="ch-input" type="datetime-local" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} /></div>
              <div className="ch-field"><label>Hạn hoàn thành</label><input className="ch-input" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
              <div className="ch-field"><label>Số lượt làm tối đa</label><input className="ch-input" type="number" min="1" max="10" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} /></div>
            </div></div>

            {preview && <div className="ch-alert ch-alert--info"><strong>Preview: {preview.distributedQuestions} / {totalQuestions} câu</strong>{preview.warnings?.length > 0 && <ul>{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}{preview.blueprintFields?.map((field) => <div key={field.professionalFieldId}>{field.professionalFieldName}: {field.requiredQuestionCount} yêu cầu / {field.availableQuestionCount} khả dụng</div>)}</div>}
            {submitting && submitStep && <div className="ch-alert ch-alert--info">{submitStep}</div>}

            <div className="exp-title-actions">
              <button type="button" className="exp-btn-secondary" onClick={previewBlueprint} disabled={loading || submitting}>Xem availability</button>
              <button type="submit" className="exp-btn-primary" disabled={loading || submitting}>{submitting ? 'Đang xử lý...' : 'Tạo và giao đề'}</button>
            </div>
          </section>
        </form></main>
      </div>
    </div>
  )
}
