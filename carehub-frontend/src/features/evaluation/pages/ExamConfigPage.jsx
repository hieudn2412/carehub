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
import ExamDeliveryFlow from '../components/ExamDeliveryFlow.jsx'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/ExamPaperPages.css'

const COGNITIVE = [
  ['FOUNDATION', 'Kiến thức nền tảng'],
  ['CLINICAL_APPLICATION', 'Áp dụng lâm sàng'],
  ['CLINICAL_REASONING_ANALYSIS', 'Tư duy và phân tích lâm sàng'],
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
        showToast((check.warnings || []).join('; ') || 'Ngân hàng câu hỏi chưa đủ nguồn theo ma trận đã chọn.', 'warning')
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
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader
          back={{ to: '/admin/evaluation/exam-management', label: 'Quay lại' }}
          breadcrumbs={[{ label: 'Quản lý bài kiểm tra', link: '/admin/evaluation/exam-management' }, { label: 'Tạo ma trận & Giao đề' }]}
        />
        <div className="dashboard-root">
          <main className="dashboard-body">
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

                      {blueprint.length > 0 && (
                        <div className="exp-blueprint-list">
                          {blueprint.map((item) => {
                            const field = fields.find((v) => v.id === item.professionalFieldId)
                            const cognitiveSum = item.cognitive.reduce((sum, cell) => sum + Number(cell.percentage || 0), 0)
                            const cognitiveValid = Math.abs(cognitiveSum - 100) < 0.001

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
                                      onChange={(e) => updateField(item.professionalFieldId, 'questionCount', e.target.value)}
                                    />
                                  </label>

                                  <div className="exp-cognitive-table-wrap">
                                    <table className="exp-cognitive-table">
                                      <thead>
                                        <tr>
                                          <th>Mức nhận thức</th>
                                          <th style={{ width: '140px', textAlign: 'right' }}>Tỷ lệ (%)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {item.cognitive.map((cell) => (
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
                                                onChange={(e) => updateCognitive(item.professionalFieldId, cell.cognitiveLevel, e.target.value)}
                                              />
                                            </td>
                                          </tr>
                                        ))}
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

                      <div className="exp-form-grid">
                        <label className="exp-form-grid__wide"><span>Lọc theo khoa phòng (tùy chọn)</span></label>
                      </div>
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

                      <div className="exp-form-grid" style={{ marginTop: 16 }}>
                        <label className="exp-form-grid__wide">
                          <span>Tìm nhân viên theo mã, tên hoặc phòng ban</span>
                          <input
                            className="ch-input"
                            value={userKeyword}
                            onChange={(e) => setUserKeyword(e.target.value)}
                            placeholder="Nhập mã nhân viên, họ tên hoặc phòng ban..."
                          />
                        </label>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0' }}>
                        <span className="ch-muted">{selectedUserIds.length} đã chọn / {filteredUsers.length} hiển thị</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="exp-btn-secondary" onClick={selectAllFiltered}>Chọn tất cả</button>
                          <button type="button" className="exp-btn-secondary" onClick={deselectAllFiltered}>Bỏ tất cả</button>
                        </div>
                      </div>
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

                      <div className="exp-form-grid">
                        <label>
                          <span>Mở đề lúc (tùy chọn)</span>
                          <input type="datetime-local" className="ch-input" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} />
                        </label>

                        <label>
                          <span>Hạn nộp bài (tùy chọn)</span>
                          <input type="datetime-local" className="ch-input" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
                        </label>

                        <label>
                          <span>Số lượt làm tối đa</span>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            className="ch-input"
                            value={maxAttempts}
                            onChange={(e) => setMaxAttempts(e.target.value)}
                          />
                        </label>
                      </div>
                    </section>

                    {/* Preview / Progress Alerts */}
                    {preview && (
                      <div className={`ch-alert ${preview.valid === false ? 'ch-alert--warning' : 'ch-alert--info'}`} style={{ margin: '16px 24px' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
                          <EyeOutlined /> Đánh giá khả dụng: {preview.distributedQuestions} / {totalQuestions} câu khả dụng
                        </div>
                        {preview.warnings?.length > 0 && (
                          <ul style={{ margin: '4px 0 8px 18px', padding: 0 }}>
                            {preview.warnings.map((warning) => (
                              <li key={warning}>{warning}</li>
                            ))}
                          </ul>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                          {preview.blueprintFields?.map((field) => (
                            <span key={field.professionalFieldId} style={{ fontSize: '12.5px' }}>
                              • {field.professionalFieldName}: Yêu cầu {field.requiredQuestionCount} câu / Khả dụng {field.availableQuestionCount} câu
                            </span>
                          ))}
                        </div>
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
          </main>
        </div>
      </div>
    </div>
  )
}

