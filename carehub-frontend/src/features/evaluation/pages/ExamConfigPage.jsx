import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AppstoreOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  LoadingOutlined,
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
import DateTimePicker24h from '../../../shared/components/DateTimePicker24h.jsx'
import FormSelectField from '../../../shared/components/FormSelectField.jsx'
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
  const [positions, setPositions] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [filterDepartmentIds, setFilterDepartmentIds] = useState([])
  const [departmentKeyword, setDepartmentKeyword] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [userKeyword, setUserKeyword] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState([])

  // Schedule (lịch giao đề)
  const [availableFrom, setAvailableFrom] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [maxAttempts, setMaxAttempts] = useState(1)
  const [resultVisibility, setResultVisibility] = useState('SCORE_ONLY')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitAction, setSubmitAction] = useState('')

  useEffect(() => {
    Promise.all([
      trainingApi.getRecordOptions(),
      adminApi.getDepartments(),
      adminApi.getPositions(),
      adminApi.getUsers({ status: 'ACTIVE', size: 500 }),
    ])
      .then(([optionsRes, deptRes, positionRes, usersRes]) => {
        setFields(data(optionsRes, {})?.professionalFields || [])
        setDepartments(data(deptRes, []) || [])
        setPositions(data(positionRes, []) || [])
        const usersData = data(usersRes, {})
        const users = usersData?.content || (Array.isArray(usersData) ? usersData : [])
        // Tai khoan admin khong phai doi tuong lam bai nen khong dua vao danh sach giao de.
        setAllUsers(users.filter((user) => !(user.roles || []).some((role) => role?.code === 'ADMIN')))
      })
      .catch((error) => showToast(apiErrorMessage(error), 'error'))
      .finally(() => setLoading(false))
  }, [showToast])

  // Lay tu danh muc chuc danh (/positions) chu khong suy ra tu danh sach user,
  // vi suy ra chi hien duoc nhung chuc danh dang co nguoi.
  const positionOptions = useMemo(() => {
    const names = [...new Set(positions.map((position) => position.name).filter(Boolean))]
    names.sort((a, b) => a.localeCompare(b, 'vi'))
    return [{ value: '', label: 'Tất cả chức danh' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [positions])

  const filteredDepartments = useMemo(() => {
    const keyword = departmentKeyword.trim().toLowerCase()
    if (!keyword) return departments
    return departments.filter((dept) => (
      (dept.departmentCode || '').toLowerCase().includes(keyword)
      || (dept.name || '').toLowerCase().includes(keyword)
    ))
  }, [departments, departmentKeyword])

  // Nhieu tu khoa cach nhau bang dau cach, khop bat ky tu khoa nao:
  // "tuan1 tuan2 namnv" tra ve ca ba nguoi.
  const filteredUsers = useMemo(() => {
    const tokens = userKeyword.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return allUsers.filter((user) => {
      if (filterDepartmentIds.length > 0 && !filterDepartmentIds.includes(Number(user.departmentId))) return false
      if (positionFilter && user.positionName !== positionFilter) return false
      if (tokens.length === 0) return true
      const haystack = `${user.employeeCode || ''} ${user.fullName || ''} ${user.departmentName || ''}`.toLowerCase()
      return tokens.some((token) => haystack.includes(token))
    })
  }, [allUsers, filterDepartmentIds, positionFilter, userKeyword])

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
    setSubmitAction('PREVIEW')
    try {
      setPreview(data(await examConfigApi.previewExamConfig(matrixPayload()), null))
    } catch (err) {
      showToast(apiErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
      setSubmitAction('')
    }
  }

  function buildRuleJson() {
    return JSON.stringify({ version: 1, all: [{ type: 'USER_IN', ids: selectedUserIds }] })
  }

  async function createAndAssign() {
    const error = validate()
    if (error) return showToast(error, 'warning')
    setSubmitting(true)
    setSubmitAction('CREATE')
    try {
      const check = data(await examConfigApi.previewExamConfig(matrixPayload()), null)
      if (check && check.valid === false) {
        showToast((check.warnings || []).map(formatCognitiveWarningText).join('; ') || 'Ngân hàng câu hỏi chưa đủ nguồn theo ma trận đã chọn.', 'warning')
        setPreview(check)
        return
      }

      const config = data(await examConfigApi.createExamConfig(matrixPayload('ACTIVE')), null)

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

      await examPaperApi.publishExamPaper(paper.id)
      const audience = data(await evaluationAudienceApi.create({ name: `${form.name.trim()} - Đối tượng thi`, ruleJson: buildRuleJson() }), null)
      await evaluationAudienceApi.activate(audience.id)

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
        resultVisibility,
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
      setSubmitAction('')
    }
  }

  return (
    <AppShell
      className="dashboard-layout"
      back={{ to: '/admin/evaluation/exam-management', label: 'Quay lại' }}
      title="Giao bài kiểm tra"
      breadcrumbs={[{ label: 'Quản lý bài kiểm tra', link: '/admin/evaluation/exam-management' }, { label: 'Giao bài kiểm tra' }]}
    >
      <div className="exp-page">
              <section className="exp-assignment-shell">
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
                        </div>
                      </div>

                      <div className="exp-form-grid">
                        <label className="exp-form-grid__wide">
                          <span>Tên bài kiểm tra</span>
                          <input
                            required
                            className="ch-input"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="Ví dụ: Kiểm tra quy trình điều dưỡng chuyên khoa - 08/2026"
                          />
                        </label>

                        <label>
                          <span>Tổng số câu hỏi</span>
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
                          <span>Thời gian làm bài (phút)</span>
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
                          <span>Điểm đạt chuẩn (thang 10)</span>
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
                          <h3>2. Ma trận lĩnh vực chuyên môn & mức nhận thức</h3>
                        </div>
                      </div>

                      <div className="exp-form-grid">
                        <label className="exp-form-grid__wide">
                          <span>Chọn lĩnh vực chuyên môn để thêm vào ma trận</span>
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
                        <span title="Ví dụ thiếu Kiến thức nền tảng sẽ lấy bù từ Áp dụng lâm sàng trước khi báo thiếu">
                          Tự động bù câu từ mức nhận thức gần nhất khi thiếu
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
                                    <span>Tổng tỷ lệ: <strong>{cognitiveSum}%</strong></span>
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
                          <h3>3. Đối tượng nhận đề</h3>
                        </div>
                      </div>

                      <div className="exam-flow__target-columns">
                        <div>
                          <div className="exam-flow__target-title">
                            <span>Bộ lọc</span>
                            {(filterDepartmentIds.length > 0 || positionFilter) && (
                              <button
                                type="button"
                                className="exp-btn-secondary"
                                onClick={() => { setFilterDepartmentIds([]); setPositionFilter('') }}
                              >
                                Bỏ lọc
                              </button>
                            )}
                          </div>
                          <FormSelectField
                            className="exam-flow__position-filter"
                            ariaLabel="Lọc theo chức danh"
                            value={positionFilter}
                            onChange={setPositionFilter}
                            options={positionOptions}
                            placeholder="Tất cả chức danh"
                          />
                          <input
                            className="ch-input exam-flow__employee-search"
                            value={departmentKeyword}
                            onChange={(e) => setDepartmentKeyword(e.target.value)}
                            placeholder="Tìm khoa phòng..."
                            aria-label="Tìm khoa phòng"
                          />
                          <div className="exp-target-list exp-target-list--select">
                            {filteredDepartments.map((dept) => {
                              const deptId = Number(dept.id)
                              return (
                                <label key={dept.id} className="exp-target-item exp-target-item--checkbox">
                                  <input type="checkbox" checked={filterDepartmentIds.includes(deptId)} onChange={() => toggleFilterDepartment(deptId)} />
                                  <strong>{dept.departmentCode || `PB-${dept.id}`}</strong>
                                  <span>{dept.name}</span>
                                </label>
                              )
                            })}
                            {!loading && filteredDepartments.length === 0 && <div className="exp-empty">Không có khoa phòng phù hợp.</div>}
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
                            placeholder="Tìm nhiều mã nhân viên, cách nhau bằng dấu cách. VD: tuan1 tuan2 namnv"
                            aria-label="Tìm nhân viên"
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
                          <h3>4. Lịch mở đề & lượt thi</h3>
                        </div>
                      </div>

                      <div className="exp-schedule-card">
                        <div className="exp-schedule-row">
                          <div className="exp-schedule-field">
                            <label className="exp-schedule-label">Mở đề lúc</label>
                            <DateTimePicker24h value={availableFrom} onChange={(val) => setAvailableFrom(val)} />
                          </div>

                          <div className="exp-schedule-field">
                            <label className="exp-schedule-label">Hạn nộp bài</label>
                            <DateTimePicker24h value={dueAt} onChange={(val) => setDueAt(val)} />
                          </div>

                          <div className="exp-schedule-field exp-schedule-field--compact">
                            <label className="exp-schedule-label">Số lượt thi</label>
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

                          <div className="exp-schedule-field exp-schedule-field--wide">
                            <label className="exp-schedule-label">Công bố kết quả</label>
                            <FormSelectField
                              value={resultVisibility}
                              onChange={setResultVisibility}
                              options={[
                                { value: 'SCORE_ONLY', label: 'Xem điểm ngay sau khi nộp' },
                                { value: 'SCORE_AND_ANSWERS', label: 'Xem điểm và đáp án sau khi đợt thi kết thúc' },
                                { value: 'HIDDEN_UNTIL_END', label: 'Ẩn kết quả đến khi đợt thi kết thúc' }
                              ]}
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Preview / Progress Alerts */}
                    {preview && (
                      <div className={`ch-alert ${preview.valid === false ? 'ch-alert--warning' : 'ch-alert--info'}`} style={{ margin: '16px 24px' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
                          <EyeOutlined /> Đánh giá khả dụng:{' '}
                          {(preview.blueprintFields || []).reduce((sum, field) => sum + field.requiredQuestionCount - field.shortage, 0)} / {totalQuestions} câu có thể chọn
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

                    {/* Submit Bar */}
                    <div className="exp-assignment-submit">
                      <div className="exp-actions-group">
                        <button type="button" className="exp-btn-secondary" onClick={previewBlueprint} disabled={loading || submitting}>
                          {submitting && submitAction === 'PREVIEW'
                            ? <><LoadingOutlined /> Đang kiểm tra...</>
                            : <><EyeOutlined /> Kiểm tra khả dụng</>}
                        </button>
                        <button type="submit" className="exp-btn-primary" disabled={loading || submitting}>
                          {submitting && submitAction === 'CREATE'
                            ? <><LoadingOutlined /> Đang tạo đề...</>
                            : <><SendOutlined /> Tạo đề</>}
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
