import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ControlOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  SendOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import DepartmentCombobox from '../../../shared/components/DepartmentCombobox.jsx'
import AppShell from '../../../shared/components/AppShell.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examConfigApi } from '../api/examConfigApi.js'
import { examPaperApi } from '../api/examPaperApi.js'
import { examAssignmentApi } from '../api/examAssignmentApi.js'
import { evaluationAudienceApi } from '../api/evaluationAudienceApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import ExamDeliveryFlow from '../components/ExamDeliveryFlow.jsx'
import DateTimePicker24h from '../../../shared/components/DateTimePicker24h.jsx'
import { apiData, apiErrorMessage, formatCognitiveWarningText } from '../utils/documentQuestionUi.js'
import '../styles/ExamPaperPages.css'
import '../styles/ExamConfigPage.css'

const COGNITIVE = [
  ['FOUNDATION', 'Kiến thức nền tảng'],
  ['CLINICAL_APPLICATION', 'Áp dụng lâm sàng'],
  ['CLINICAL_REASONING_ANALYSIS', 'Tư duy phân tích'],
]

function emptyField(id) {
  return {
    professionalFieldId: Number(id),
    questionCount: 0,
    cognitive: COGNITIVE.map(([level, label], index) => ({
      cognitiveLevel: level,
      label,
      percentage: [30, 50, 20][index],
    })),
  }
}

function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `key-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function data(response, fallback) {
  return apiData(response, fallback)
}

export default function ExamConfigPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  // Matrix (ma trận đề)
  const [fields, setFields] = useState([])
  const [form, setForm] = useState({ name: '', description: '', totalQuestions: 30, timeLimitMinutes: 45, passingScore: 7, maxRetakes: 0 })
  const [blueprint, setBlueprint] = useState([])
  const [backfillNearestCognitiveLevel, setBackfillNearestCognitiveLevel] = useState(false)
  const [preview, setPreview] = useState(null)

  // Audience (đối tượng nhận đề)
  const [departments, setDepartments] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [filterDepartmentIds, setFilterDepartmentIds] = useState([])
  const [userKeyword, setUserKeyword] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState([])

  // Schedule (lịch giao đề)
  const [availableFrom, setAvailableFrom] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [maxAttempts, setMaxAttempts] = useState(1)
  const [resultVisibility, setResultVisibility] = useState('SCORE_ONLY')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitStep, setSubmitStep] = useState('')

  useEffect(() => {
    Promise.all([trainingApi.getRecordOptions(), adminApi.getDepartments(), adminApi.getUsers({ status: 'ACTIVE', size: 500 })])
      .then(([optionsRes, deptRes, usersRes]) => {
        setFields(data(optionsRes, {})?.professionalFields || [])
        setDepartments(data(deptRes, []) || [])
        const usersData = data(usersRes, {})
        setAllUsers(usersData?.content || (Array.isArray(usersData) ? usersData : []))
      })
      .catch((error) => showToast(apiErrorMessage(error), 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  const filteredUsers = useMemo(() => {
    const keyword = userKeyword.trim().toLowerCase()
    return allUsers.filter((user) => {
      const matchesDepartment = filterDepartmentIds.length === 0 || filterDepartmentIds.includes(Number(user.departmentId))
      const matchesKeyword = !keyword
        || (user.employeeCode || '').toLowerCase().includes(keyword)
        || (user.fullName || '').toLowerCase().includes(keyword)
        || (user.departmentName || '').toLowerCase().includes(keyword)
      return matchesDepartment && matchesKeyword
    })
  }, [allUsers, filterDepartmentIds, userKeyword])

  const totalAllocated = useMemo(() => blueprint.reduce((sum, item) => sum + Number(item.questionCount || 0), 0), [blueprint])
  const totalQuestions = Number(form.totalQuestions) || 0

  function addField(id) {
    const numId = Number(id)
    if (!numId) return
    setBlueprint((current) => (current.some((item) => item.professionalFieldId === numId) ? current : [...current, emptyField(numId)]))
  }

  function removeField(id) {
    setBlueprint((current) => current.filter((item) => item.professionalFieldId !== id))
  }

  function updateField(id, key, value) {
    if (key === 'questionCount') value = Number(value) || 0
    setBlueprint((current) => current.map((item) => (item.professionalFieldId === id ? { ...item, [key]: value } : item)))
  }

  function updateCognitive(fieldId, level, value) {
    setBlueprint((current) =>
      current.map((item) =>
        item.professionalFieldId !== fieldId
          ? item
          : {
              ...item,
              cognitive: item.cognitive.map((cell) => (cell.cognitiveLevel === level ? { ...cell, percentage: Number(value) || 0 } : cell)),
            },
      ),
    )
  }

  function toggleFilterDepartment(id) {
    const numId = Number(id)
    setFilterDepartmentIds((current) => current.includes(numId) ? current.filter((x) => x !== numId) : [...current, numId])
  }

  function toggleSelectedUser(id) {
    const numId = Number(id)
    setSelectedUserIds((current) => current.includes(numId) ? current.filter((x) => x !== numId) : [...current, numId])
  }

  function selectAllFiltered() {
    const ids = filteredUsers.map((u) => Number(u.id))
    setSelectedUserIds((current) => [...new Set([...current, ...ids])])
  }

  function deselectAllFiltered() {
    const ids = new Set(filteredUsers.map((u) => Number(u.id)))
    setSelectedUserIds((current) => current.filter((id) => !ids.has(id)))
  }

  function matrixPayload(status = 'DRAFT') {
    return {
      name: form.name.trim(),
      description: form.description.trim() || null,
      totalQuestions,
      timeLimitMinutes: Number(form.timeLimitMinutes),
      passingScore: Number(form.passingScore),
      maxRetakes: Number(form.maxRetakes),
      shuffleQuestions: true,
      shuffleOptions: true,
      backfillNearestCognitiveLevel,
      questionSelectionMode: 'FIXED_PAPER',
      status,
      fieldBlueprints: blueprint.map((field, index) => ({
        professionalFieldId: field.professionalFieldId,
        questionCount: Number(field.questionCount),
        displayOrder: index,
        cognitive: field.cognitive.map((cell) => ({ cognitiveLevel: cell.cognitiveLevel, percentage: Number(cell.percentage) })),
      })),
      sourceFilters: { includedCategoryIds: [], excludedCategoryIds: [], includedDocumentIds: [], excludedDocumentIds: [] },
    }
  }

  function validate() {
    if (!form.name.trim()) return 'Vui lòng nhập tên bài kiểm tra.'
    if (!blueprint.length) return 'Vui lòng chọn ít nhất một lĩnh vực chuyên môn.'
    if (totalAllocated !== totalQuestions) return `Tổng số câu các lĩnh vực (${totalAllocated}) phải bằng tổng số câu (${totalQuestions}).`
    if (blueprint.some((field) => Math.abs(field.cognitive.reduce((sum, cell) => sum + Number(cell.percentage || 0), 0) - 100) > 0.001)) {
      return 'Tổng tỷ lệ ba mức nhận thức trong mỗi lĩnh vực phải bằng 100%.'
    }
    if (!totalQuestions || totalQuestions < 1) return 'Tổng số câu phải lớn hơn 0.'
    if (selectedUserIds.length === 0) return 'Vui lòng chọn ít nhất một nhân viên nhận đề.'
    if (availableFrom && dueAt && availableFrom >= dueAt) return 'Thời điểm mở đề phải sớm hơn hạn hoàn thành.'
    return ''
  }

  async function previewBlueprint() {
    const error = validate()
    if (error) return showToast(error, 'warning')
    setSubmitting(true)
    setSubmitStep('Đang kiểm tra khả dụng nguồn câu hỏi...')
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
    return JSON.stringify({ version: 1, all: [{ type: 'USER_IN', ids: selectedUserIds }] })
  }

  async function createAndAssign() {
    const error = validate()
    if (error) return showToast(error, 'warning')
    setSubmitting(true)
    try {
      setSubmitStep('1/5. Đang kiểm tra khả dụng nguồn câu hỏi...')
      const check = data(await examConfigApi.previewExamConfig(matrixPayload()), null)
      if (check && check.valid === false) {
        showToast((check.warnings || []).map(formatCognitiveWarningText).join('; ') || 'Ngân hàng câu hỏi chưa đủ nguồn theo ma trận đã chọn.', 'warning')
        setPreview(check)
        return
      }

      setSubmitStep('2/5. Đang tạo ma trận đề...')
      const config = data(await examConfigApi.createExamConfig(matrixPayload('ACTIVE')), null)

      setSubmitStep('3/5. Đang sinh mã đề...')
      const papers = data(
        await examPaperApi.generateExamPapers({
          examConfigId: config.id,
          namePrefix: null,
          variantCount: 1,
          randomSeed: null,
          zeroOverlap: false,
          idempotencyKey: newIdempotencyKey(),
        }),
        [],
      )
      const paper = papers[0]

      setSubmitStep('4/5. Đang phát hành mã đề & tạo nhóm nhận đề...')
      await examPaperApi.publishExamPaper(paper.id)
      const audience = data(await evaluationAudienceApi.create({ name: `${form.name.trim()} - Đối tượng thi`, ruleJson: buildRuleJson() }), null)
      await evaluationAudienceApi.activate(audience.id)

      setSubmitStep('5/5. Đang giao đề kiểm tra...')
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

      showToast('Đã tạo ma trận và giao bài kiểm tra thành công.', 'success')
      navigate('/admin/evaluation/exam-management?view=assignments')
    } catch (err) {
      showToast(apiErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
      setSubmitStep('')
    }
  }

  function handleFlowStep(step) {
    if (step === 'papers') navigate('/admin/evaluation/exam-management?view=papers')
    if (step === 'assignments') navigate('/admin/evaluation/exam-assignments/new')
  }

  return (
    <AppShell
      className="dashboard-layout"
      back={{ to: '/admin/evaluation/exam-management', label: 'Quay lại' }}
      breadcrumbs={[{ label: 'Quản lý bài kiểm tra', link: '/admin/evaluation/exam-management' }, { label: 'Tạo ma trận & Giao đề' }]}
    >
      <div className="exp-page">
              <ExamDeliveryFlow
                activeStep="matrix"
                title="Tạo ma trận & Giao đề kiểm tra"
                description="Cấu hình ma trận số câu theo lĩnh vực chuyên môn, chọn đối tượng nhận đề và giao đề tự động."
                onStepChange={handleFlowStep}
              />

              <section className="exp-assignment-shell">
                <div className="exp-assignment-toolbar">
                  <div>
                    <span className="exp-section-kicker">BƯỚC 1 · THIẾT LẬP NHACH MA TRẬN & GIAO ĐỀ</span>
                    <h2>Tạo mới & Giao đề kiểm tra</h2>
                    <p>Thiết lập thông tin chung, ma trận chuyên môn, đối tượng thi và lịch phát hành trong một quy trình duy nhất.</p>
                  </div>
                  <button type="button" className="exp-btn-secondary" onClick={() => navigate('/admin/evaluation/exam-management')}>
                    <ArrowLeftOutlined /> Quay lại danh sách
                  </button>
                </div>

                {loading ? (
                  <div className="exp-empty">Đang tải danh sách lĩnh vực chuyên môn và khoa phòng...</div>
                ) : (
                  <form
                    className="exp-assignment-form"
                    onSubmit={(event) => {
                      event.preventDefault()
                      createAndAssign()
                    }}
                  >
                    {/* Section 1 */}
                    <section className="exp-form-section">
                      <div className="exp-form-section__heading">
                        <span className="exp-form-section__number"><FileTextOutlined /></span>
                        <div>
                          <h3>1. Thông tin chung bài kiểm tra</h3>
                          <p>Nhập tên bài thi, số câu hỏi, thời gian làm bài và mức điểm đạt.</p>
                        </div>
                      </div>

                      <div className="exp-form-grid">
                        <label className="exp-form-grid__wide">
                          <span>Tên bài kiểm tra <b>*</b></span>
                          <input
                            required
                            className="ch-input"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="Ví dụ: Kiểm tra quy trình điều dưỡng chuyên khoa - 08/2026"
                          />
                        </label>

                        <label>
                          <span>Tổng số câu hỏi <b>*</b></span>
                          <input
                            required
                            type="number"
                            min="1"
                            max="200"
                            className="ch-input"
                            value={form.totalQuestions}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setForm({ ...form, totalQuestions: e.target.value })}
                          />
                        </label>

                        <label>
                          <span>Thời gian làm bài (phút) <b>*</b></span>
                          <input
                            required
                            type="number"
                            min="1"
                            max="300"
                            className="ch-input"
                            value={form.timeLimitMinutes}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setForm({ ...form, timeLimitMinutes: e.target.value })}
                          />
                        </label>

                        <label>
                          <span>Điểm đạt chuẩn (thang 10) <b>*</b></span>
                          <input
                            required
                            type="number"
                            min="0"
                            max="10"
                            step="0.5"
                            className="ch-input"
                            value={form.passingScore}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setForm({ ...form, passingScore: e.target.value })}
                          />
                        </label>
                      </div>
                    </section>

                    {/* Section 2 */}
                    <section className="exp-form-section">
                      <div className="exp-form-section__heading">
                        <span className="exp-form-section__number"><AppstoreOutlined /></span>
                        <div>
                          <h3>2. Ma trận Lĩnh vực chuyên môn & Mức nhận thức</h3>
                          <p>Chọn các lĩnh vực chuyên môn và phân bổ câu hỏi theo tỷ lệ nhận thức.</p>
                        </div>
                      </div>

                      <div className="exp-form-grid">
                        <label className="exp-form-grid__wide">
                          <span>Chọn lĩnh vực chuyên môn để thêm vào ma trận <b>*</b></span>
                          <DepartmentCombobox
                            departments={fields}
                            value=""
                            onChange={addField}
                            placeholder="Tìm kiếm và chọn lĩnh vực chuyên môn..."
                            emptyValue=""
                          />
                        </label>
                      </div>

                      <label className="exp-backfill-toggle">
                        <input
                          type="checkbox"
                          checked={backfillNearestCognitiveLevel}
                          onChange={(e) => setBackfillNearestCognitiveLevel(e.target.checked)}
                        />
                        <span>
                          Tự động bù câu từ mức nhận thức gần nhất khi thiếu
                          <small> (ví dụ thiếu Kiến thức nền tảng sẽ lấy bù từ Áp dụng lâm sàng trước khi báo thiếu)</small>
                        </span>
                      </label>

                      {blueprint.length > 0 && (
                        <div className="exp-blueprint-list">
                          {blueprint.map((item) => {
                            const field = fields.find((v) => v.id === item.professionalFieldId)
                            const cognitiveSum = item.cognitive.reduce((sum, cell) => sum + Number(cell.percentage || 0), 0)
                            const cognitiveValid = Math.abs(cognitiveSum - 100) < 0.001
                            const previewField = preview?.blueprintFields?.find((f) => f.professionalFieldId === item.professionalFieldId)

                            return (
                              <div key={item.professionalFieldId} className="exp-field-card">
                                <div className="exp-field-card__header">
                                  <div className="exp-field-card__title">
                                    <AppstoreOutlined />
                                    <strong>{field?.name || `Lĩnh vực #${item.professionalFieldId}`}</strong>
                                  </div>
                                  <button type="button" className="exp-field-card__remove" onClick={() => removeField(item.professionalFieldId)}>
                                    <DeleteOutlined /> Xóa lĩnh vực
                                  </button>
                                </div>

                                <div className="exp-field-card__body">
                                  <label className="exp-field-card__count">
                                    <span>Số câu hỏi lĩnh vực này:</span>
                                    <input
                                      type="number"
                                      min="0"
                                      className="ch-input"
                                      value={item.questionCount}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                        const raw = e.target.value
                                        const parsed = parseInt(raw, 10)
                                        const normalized = isNaN(parsed) ? 0 : Math.max(0, parsed)
                                        if (raw !== String(normalized) && raw !== '') {
                                          e.target.value = String(normalized)
                                        }
                                        updateField(item.professionalFieldId, 'questionCount', normalized)
                                      }}
                                    />
                                    {previewField && (
                                      <span className={`exp-cognitive-availability ${previewField.shortage > 0 ? 'is-short' : previewField.backfilledQuestionCount > 0 ? 'is-backfilled' : 'is-ok'}`}>
                                        Khả dụng {previewField.availableQuestionCount}/{previewField.requiredQuestionCount} câu
                                        {previewField.backfilledQuestionCount > 0 && ` · đã bù ${previewField.backfilledQuestionCount} câu`}
                                        {previewField.shortage > 0 && ` · thiếu ${previewField.shortage} câu`}
                                      </span>
                                    )}
                                  </label>

                                  <div className="exp-cognitive-table-wrap">
                                    <table className="exp-cognitive-table">
                                      <thead>
                                        <tr>
                                          <th>Mức nhận thức</th>
                                          <th style={{ width: '110px', textAlign: 'right' }}>Tỷ lệ (%)</th>
                                          <th style={{ width: '180px', textAlign: 'right' }}>Khả dụng</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {item.cognitive.map((cell) => {
                                          const previewCell = previewField?.cells?.find((c) => c.cognitiveLevel === cell.cognitiveLevel)
                                          return (
                                            <tr key={cell.cognitiveLevel}>
                                              <td>{cell.label}</td>
                                              <td style={{ textAlign: 'right' }}>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  max="100"
                                                  className="ch-input"
                                                  style={{ width: '80px', textAlign: 'center' }}
                                                  value={cell.percentage}
                                                  onFocus={(e) => e.target.select()}
                                                  onChange={(e) => {
                                                    const raw = e.target.value
                                                    const parsed = parseInt(raw, 10)
                                                    const normalized = isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed))
                                                    if (raw !== String(normalized) && raw !== '') {
                                                      e.target.value = String(normalized)
                                                    }
                                                    updateCognitive(item.professionalFieldId, cell.cognitiveLevel, normalized)
                                                  }}
                                                />
                                              </td>
                                              <td style={{ textAlign: 'right' }}>
                                                {previewCell ? (
                                                  <span className={`exp-cognitive-availability ${previewCell.shortage > 0 ? 'is-short' : previewCell.backfilledCount > 0 ? 'is-backfilled' : 'is-ok'}`}>
                                                    {previewCell.availableQuestionCount}/{previewCell.requiredQuestionCount} câu
                                                    {previewCell.backfilledCount > 0 && <><br /><small>đã bù {previewCell.backfilledCount} câu</small></>}
                                                    {previewCell.shortage > 0 && <><br /><small>thiếu {previewCell.shortage} câu</small></>}
                                                  </span>
                                                ) : (
                                                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>Chưa kiểm tra</span>
                                                )}
                                              </td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                    </table>
                                  </div>

                                  <div className={`exp-cognitive-summary ${cognitiveValid ? 'is-valid' : 'is-invalid'}`}>
                                    <span>Tổng tỷ lệ nhận thức: <strong>{cognitiveSum}%</strong></span>
                                    {!cognitiveValid && <small> (Tổng tỷ lệ phải bằng 100%)</small>}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      <div className={`exp-allocation-banner ${totalAllocated === totalQuestions ? 'is-valid' : 'is-warning'}`}>
                        {totalAllocated === totalQuestions ? (
                          <><CheckCircleOutlined /> Đã phân bổ đủ <strong>{totalAllocated} / {totalQuestions}</strong> câu hỏi cho ma trận.</>
                        ) : (
                          <><ExclamationCircleOutlined /> Đã phân bổ <strong>{totalAllocated} / {totalQuestions}</strong> câu hỏi. Hãy điều chỉnh để khớp số lượng.</>
                        )}
                      </div>
                    </section>

                    {/* Section 3 */}
                    <section className="exp-form-section">
                      <div className="exp-form-section__heading">
                        <span className="exp-form-section__number"><TeamOutlined /></span>
                        <div>
                          <h3>3. Đối tượng nhận đề (Nhóm thi)</h3>
                          <p>Lọc theo khoa phòng để thu hẹp danh sách, sau đó tick chọn từng nhân viên nhận đề.</p>
                        </div>
                      </div>

                      <div className="exam-flow__target-columns">
                        <div>
                          <div className="exam-flow__target-title"><span>Lọc theo khoa phòng (tùy chọn)</span></div>
                          <div className="exp-target-list exp-target-list--select">
                            {departments.map((dept) => {
                              const deptId = Number(dept.id)
                              return (
                                <label key={dept.id} className="exp-target-item exp-target-item--checkbox">
                                  <input type="checkbox" checked={filterDepartmentIds.includes(deptId)} onChange={() => toggleFilterDepartment(deptId)} />
                                  <strong>{dept.departmentCode || `PB-${dept.id}`}</strong>
                                  <span>{dept.name}</span>
                                </label>
                              )
                            })}
                            {!loading && departments.length === 0 && <div className="exp-empty">Chưa có khoa phòng để lọc.</div>}
                          </div>
                        </div>

                        <div>
                          <div className="exam-flow__target-title">
                            <span>{selectedUserIds.length} đã chọn / {filteredUsers.length} hiển thị</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" className="exp-btn-secondary" onClick={selectAllFiltered}>Chọn tất cả</button>
                              <button type="button" className="exp-btn-secondary" onClick={deselectAllFiltered}>Bỏ tất cả</button>
                            </div>
                          </div>
                          <input
                            className="ch-input exam-flow__employee-search"
                            value={userKeyword}
                            onChange={(e) => setUserKeyword(e.target.value)}
                            placeholder="Tìm theo mã nhân viên, họ tên hoặc phòng ban..."
                          />
                          <div className="exp-target-list exp-target-list--select">
                            {filteredUsers.map((user) => {
                              const userId = Number(user.id)
                              return (
                                <label key={user.id} className="exp-target-item exp-target-item--checkbox">
                                  <input type="checkbox" checked={selectedUserIds.includes(userId)} onChange={() => toggleSelectedUser(userId)} />
                                  <strong>{user.employeeCode}</strong>
                                  <span>{user.fullName}</span>
                                  <small>{user.departmentName || 'Chưa có phòng ban'}</small>
                                </label>
                              )
                            })}
                            {!loading && filteredUsers.length === 0 && <div className="exp-empty">Không có nhân viên phù hợp.</div>}
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Section 4 */}
                    <section className="exp-form-section">
                      <div className="exp-form-section__heading">
                        <span className="exp-form-section__number"><CalendarOutlined /></span>
                        <div>
                          <h3>4. Lịch mở đề & Lượt thi</h3>
                          <p>Thiết lập thời gian bắt đầu, hạn hoàn thành và số lần được phép làm bài.</p>
                        </div>
                      </div>

                      <div className="exp-schedule-card">
                        <div className="exp-schedule-row">
                          <div className="exp-schedule-field">
                            <label className="exp-schedule-label">Mở đề lúc (tùy chọn)</label>
                            <DateTimePicker24h value={availableFrom} onChange={(val) => setAvailableFrom(val)} />
                          </div>

                          <div className="exp-schedule-field">
                            <label className="exp-schedule-label">Hạn nộp bài (tùy chọn)</label>
                            <DateTimePicker24h value={dueAt} onChange={(val) => setDueAt(val)} />
                          </div>

                          <div className="exp-schedule-field exp-schedule-field--compact">
                            <label className="exp-schedule-label">Số lượt thi tối đa</label>
                            <div className="exp-number-stepper">
                              <input
                                type="number"
                                min="1"
                                max="10"
                                className="exp-num-input"
                                value={maxAttempts}
                                onChange={(e) => setMaxAttempts(e.target.value)}
                              />
                              <span className="exp-stepper-unit">lần</span>
                            </div>
                          </div>
                        </div>

                        <div className="exp-schedule-row exp-schedule-row--bottom">
                          <div className="exp-schedule-field exp-schedule-field--wide">
                            <label className="exp-schedule-label">Công bố kết quả</label>
                            <select className="ch-input" value={resultVisibility} onChange={(e) => setResultVisibility(e.target.value)}>
                              <option value="SCORE_ONLY">Xem điểm ngay sau khi nộp</option>
                              <option value="SCORE_AND_ANSWERS">Xem điểm và đáp án sau khi đợt thi kết thúc</option>
                              <option value="HIDDEN_UNTIL_END">Ẩn kết quả đến khi đợt thi kết thúc</option>
                            </select>
                            <small className="exp-field-hint">Áp dụng cho toàn bộ nhân viên trong đợt giao đề.</small>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Preview / Progress Alerts */}
                    {preview && (
                      <div className={`ch-alert ${preview.valid === false ? 'ch-alert--warning' : 'ch-alert--info'}`} style={{ margin: '16px 24px' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
                          <EyeOutlined /> Đánh giá khả dụng: {preview.distributedQuestions} / {totalQuestions} câu khả dụng
                        </div>
                        {preview.warnings?.length > 0 && (
                          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                            {preview.warnings.map((warning) => (
                              <li key={warning}>{formatCognitiveWarningText(warning)}</li>
                            ))}
                          </ul>
                        )}
                        {preview.warnings?.length === 0 && (
                          <small>Đủ nguồn câu hỏi theo ma trận đã cấu hình. Xem chi tiết khả dụng theo từng mức nhận thức ở bảng lĩnh vực bên trên.</small>
                        )}
                      </div>
                    )}

                    {submitting && submitStep && (
                      <div className="ch-alert ch-alert--info" style={{ margin: '16px 24px' }}>
                        <ControlOutlined /> {submitStep}
                      </div>
                    )}

                    {/* Submit Bar */}
                    <div className="exp-assignment-submit">
                      <div className="exp-assignment-submit__info">
                        <div className="exp-status-indicator">
                          <span className="exp-status-dot is-open"></span>
                          <strong>Tự động sinh mã đề & Mở đợt giao đề ngay</strong>
                        </div>
                        <span>Quy trình tự động tạo ma trận, sinh mã đề, chụp snapshot đối tượng thi và mở giao.</span>
                      </div>

                      <div className="exp-actions-group">
                        <button type="button" className="exp-btn-secondary" onClick={previewBlueprint} disabled={loading || submitting}>
                          <EyeOutlined /> Kiểm tra khả dụng
                        </button>
                        <button type="submit" className="exp-btn-primary" disabled={loading || submitting}>
                          {submitting ? 'Đang xử lý...' : <><SendOutlined /> Tạo ma trận & Giao đề ngay</>}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </section>
      </div>
    </AppShell>
  )
}
