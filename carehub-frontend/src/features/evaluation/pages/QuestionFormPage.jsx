import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../../shared/components/AppShell.jsx'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import ConfirmModal from '../../../shared/components/ConfirmModal.jsx'
import { CheckOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { questionBankApi } from '../api/questionBankApi.js'
import { questionCategoryApi } from '../api/questionCategoryApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import { apiData, apiErrorMessage, COGNITIVE_LEVELS } from '../utils/documentQuestionUi.js'
import '../styles/QuestionFormPage.css'

const ANSWER_LETTERS = ['A', 'B', 'C', 'D']
const EMPTY_OPTIONS = ['', '', '', '']

function formSnapshot({ content, category, categoryId, professionalFieldId, cognitiveLevel, options, correctOptionIndices }) {
  return JSON.stringify({ content, category, categoryId, professionalFieldId, cognitiveLevel, options, correctOptionIndices })
}

function QuestionFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { showToast } = useToast()
  const isEditMode = Boolean(id)

  // Form State
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('Kiểm soát nhiễm khuẩn')
  const [categoryId, setCategoryId] = useState('')
  const [professionalFieldId, setProfessionalFieldId] = useState('')
  const [professionalFields, setProfessionalFields] = useState([])
  const [cognitiveLevel, setCognitiveLevel] = useState('')
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [backendCategories, setBackendCategories] = useState([])
  const [impactWarning, setImpactWarning] = useState(null)
  const [loadError, setLoadError] = useState('')

  const professionalFieldOptions = useMemo(() => [
    ...professionalFields.map((field) => ({
      value: String(field.id),
      label: field.name,
      searchText: field.code ? `${field.code} ${field.name}` : field.name,
    })),
  ], [professionalFields])

  const categoryOptions = useMemo(() => [
    ...backendCategories.map((item) => ({
      value: String(item.id),
      label: item.name,
      searchText: item.code ? `${item.code} ${item.name}` : item.name,
    })),
  ], [backendCategories])

  // Dynamic Options State
  const [options, setOptions] = useState(EMPTY_OPTIONS)
  const [correctOptionIndices, setCorrectOptionIndices] = useState([0])
  const [baselineSnapshot, setBaselineSnapshot] = useState(() => isEditMode ? null : formSnapshot({
    content: '',
    category: 'Kiểm soát nhiễm khuẩn',
    categoryId: '',
    professionalFieldId: '',
    cognitiveLevel: '',
    options: EMPTY_OPTIONS,
    correctOptionIndices: [0],
  }))
  const [pendingDestination, setPendingDestination] = useState(null)
  const [pendingSavePayload, setPendingSavePayload] = useState(null)

  const currentSnapshot = useMemo(() => formSnapshot({
    content,
    category,
    categoryId,
    professionalFieldId,
    cognitiveLevel,
    options,
    correctOptionIndices,
  }), [category, categoryId, content, cognitiveLevel, correctOptionIndices, options, professionalFieldId])
  const hasUnsavedChanges = baselineSnapshot !== null && currentSnapshot !== baselineSnapshot

  useEffect(() => {
    let ignore = false

    async function loadCategories() {
      try {
        const [response, optionsResponse] = await Promise.all([
          questionCategoryApi.listCategories({
            status: 'ACTIVE',
          }),
          trainingApi.getRecordOptions(),
        ])
        if (!ignore) {
          setBackendCategories(apiData(response, []))
          setProfessionalFields(apiData(optionsResponse, {}).professionalFields || [])
        }
      } catch (error) {
        if (!ignore) {
          showToast(apiErrorMessage(error), 'warning')
        }
      }
    }

    loadCategories()

    return () => {
      ignore = true
    }
  }, [showToast])

  // Load existing question details in edit mode
  useEffect(() => {
    if (!isEditMode) {
      return undefined
    }

    let ignore = false

    async function loadQuestion() {
      setIsLoadingQuestion(true)
      setLoadError('')
      setBaselineSnapshot(null)
      try {
        const response = await questionBankApi.getQuestion(id)
        const question = apiData(response)
        if (!question) {
          throw new Error('Không nhận được dữ liệu câu hỏi từ máy chủ')
        }
        if (ignore) return

        const loadedContent = question.stem || ''
        const loadedCategory = question.categoryName || question.sourceDocument || 'Chưa phân loại'
        const loadedOptions = [question.optionA || '', question.optionB || '', question.optionC || '', question.optionD || '']
        const loadedCorrectIndices = [Math.max(0, ANSWER_LETTERS.indexOf(String(question.correctAnswer || 'A').toUpperCase()))]

        setContent(loadedContent)
        setCategory(loadedCategory)
        setCategoryId(question.categoryId ? String(question.categoryId) : '')
        setProfessionalFieldId(question.professionalFieldId ? String(question.professionalFieldId) : '')
        setCognitiveLevel(question.cognitiveLevel || '')
        setOptions(loadedOptions)
        setCorrectOptionIndices(loadedCorrectIndices)
        setBaselineSnapshot(formSnapshot({
          content: loadedContent,
          category: loadedCategory,
          categoryId: question.categoryId ? String(question.categoryId) : '',
          professionalFieldId: question.professionalFieldId ? String(question.professionalFieldId) : '',
          cognitiveLevel: question.cognitiveLevel || '',
          options: loadedOptions,
          correctOptionIndices: loadedCorrectIndices,
        }))
        setImpactWarning(question.impactWarning || null)
      } catch (error) {
        if (ignore) return
        const message = error?.message === 'Không nhận được dữ liệu câu hỏi từ máy chủ'
          ? error.message
          : apiErrorMessage(error)
        setLoadError(message)
        showToast(message, 'warning')
      } finally {
        if (!ignore) {
          setIsLoadingQuestion(false)
        }
      }
    }

    loadQuestion()

    return () => {
      ignore = true
    }
  }, [id, isEditMode, showToast])

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined

    const warnBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [hasUnsavedChanges])

  const requestLeave = (destination = '/admin/evaluation/question-bank') => {
    if (hasUnsavedChanges && !isSaving) {
      setPendingDestination(destination)
      return
    }
    navigate(destination)
  }

  const handleNavigationCapture = (event) => {
    if (!hasUnsavedChanges || isSaving || event.defaultPrevented) return
    const anchor = event.target.closest('a[href]')
    if (!anchor) return

    const targetUrl = new URL(anchor.href, window.location.href)
    if (targetUrl.origin !== window.location.origin) return

    event.preventDefault()
    event.stopPropagation()
    setPendingDestination(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`)
  }

  const confirmLeave = () => {
    const destination = pendingDestination
    setPendingDestination(null)
    if (destination) navigate(destination)
  }

  const handleOptionChange = (index, value) => {
    setOptions((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleSelectCorrect = (index) => {
    setCorrectOptionIndices([index])
  }

  const handleSave = async (e) => {
    e.preventDefault()

    if (!content.trim()) {
      showToast('Vui lòng nhập nội dung câu hỏi.', 'warning')
      return
    }

    if (!professionalFieldId || !categoryId) {
      showToast('Vui lòng chọn lĩnh vực chuyên môn và danh mục kiến thức.', 'warning')
      return
    }

    if (!cognitiveLevel) {
      showToast('Vui lòng phân loại mức độ nhận thức cho câu hỏi.', 'warning')
      return
    }

    if (options.length !== 4 || options.some(opt => !opt.trim())) {
      showToast('Vui lòng nhập đủ 4 phương án trả lời A-D.', 'warning')
      return
    }

    if (correctOptionIndices.length !== 1) {
      showToast('Ngân hàng câu hỏi hiện hỗ trợ một đáp án đúng cho mỗi câu.', 'warning')
      return
    }

    const payload = {
      stem: content.trim(),
      optionA: options[0].trim(),
      optionB: options[1].trim(),
      optionC: options[2].trim(),
      optionD: options[3].trim(),
      correctAnswer: ANSWER_LETTERS[correctOptionIndices[0]],
      explanation: null,
      categoryId: categoryId ? Number(categoryId) : null,
      professionalFieldId: professionalFieldId ? Number(professionalFieldId) : null,
      cognitiveLevel,
      language: 'vi',
      sourceDocument: null,
      status: 'APPROVED',
    }

    if (isEditMode && impactWarning?.warning) {
      setPendingSavePayload(payload)
      return
    }

    await persistQuestion(payload)
  }

  async function persistQuestion(payload) {
    setIsSaving(true)
    try {
      const response = isEditMode
        ? await questionBankApi.updateQuestion(id, payload)
        : await questionBankApi.createQuestion(payload)
      const saved = apiData(response)
      if (saved?.duplicateWarning) {
        showToast('Đã lưu câu hỏi, nhưng có cảnh báo gần trùng. Nên kiểm tra lại trong ngân hàng.', 'warning')
      } else if (saved?.impactWarning?.warning) {
        showToast('Đã lưu câu hỏi. Câu hỏi này đang được dùng trong bộ câu hỏi hoặc bộ đề.', 'warning')
      } else {
        showToast(isEditMode ? 'Đã cập nhật câu hỏi.' : 'Đã tạo câu hỏi.', 'success')
      }
      navigate('/admin/evaluation/question-bank')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const getOptionLetter = (idx) => String.fromCharCode(65 + idx)

  const breadcrumbs = [
    { label: 'Ngân hàng câu hỏi', path: '/admin/evaluation/question-bank' },
    { label: isEditMode ? 'Chỉnh sửa' : 'Tạo mới' },
  ]

  return (
    // Giữ onClickCapture bao trọn Sidebar/Header để chặn điều hướng khi còn thay đổi chưa lưu.
    <div onClickCapture={handleNavigationCapture}>
      <AppShell back={{ onClick: () => requestLeave(), label: 'Quay lại' }} breadcrumbs={breadcrumbs}>
        <div className="qf-page">
          <div className="qf-container">
            {/* Header */}
            <div className="qf-header">
              <div>
                <h2 className="qf-title">
                  {isEditMode ? 'Cập nhật câu hỏi' : 'Tạo câu hỏi'}
                </h2>
                <p className="qf-subtitle">
                  {isEditMode ? 'Điều chỉnh nội dung và đáp án của câu hỏi.' : 'Soạn câu hỏi trắc nghiệm với một đáp án đúng.'}
                </p>
              </div>
            </div>

            {isLoadingQuestion && (
              <div className="qf-info-banner">Đang tải chi tiết câu hỏi...</div>
            )}
            {loadError && !isLoadingQuestion && (
              <div className="qf-error-banner">
                <strong>Không tải được câu hỏi</strong>
                <p>{loadError}</p>
                <button type="button" onClick={() => requestLeave()}>
                  Quay lại ngân hàng câu hỏi
                </button>
              </div>
            )}
            {impactWarning?.warning && !isLoadingQuestion && (
              <div className="qf-impact-banner">
                <strong>Cảnh báo sử dụng</strong>
                <p>{impactWarning.warning}</p>
              </div>
            )}

            <form onSubmit={handleSave} className="qf-form">
              {/* Question Text */}
              <div className="qf-form-group">
                <label>
                  Nội dung câu hỏi <span className="qf-required-star">*</span>
                </label>
                <textarea
                  className="qf-input-green"
                  rows={3}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Nhập nội dung câu hỏi trắc nghiệm..."
                  disabled={isLoadingQuestion || isSaving || Boolean(loadError)}
                />
                <small className="qf-field-hint">Viết ngắn gọn, rõ nghĩa và tránh đưa gợi ý đáp án vào câu hỏi.</small>
              </div>

              {/* Inputs Grid */}
              <div className="qf-form-row">
                <div className="qf-form-group">
                  <label>
                    Lĩnh vực chuyên môn <span className="qf-required-star">*</span>
                  </label>
                  <SearchableSelect
                    value={professionalFieldId}
                    options={professionalFieldOptions}
                    onChange={(val) => setProfessionalFieldId(val)}
                    placeholder="Chọn lĩnh vực chuyên môn..."
                    searchPlaceholder="Tìm lĩnh vực chuyên môn..."
                    disabled={isLoadingQuestion || isSaving || Boolean(loadError)}
                    ariaLabel="Lĩnh vực chuyên môn"
                  />
                </div>
                <div className="qf-form-group">
                  <label>
                    Danh mục <span className="qf-required-star">*</span>
                  </label>
                  <SearchableSelect
                    value={categoryId}
                    options={categoryOptions}
                    onChange={(val) => {
                      setCategoryId(val)
                      const selected = backendCategories.find((item) => String(item.id) === String(val))
                      setCategory(selected?.name || '')
                    }}
                    placeholder="Chọn danh mục kiến thức..."
                    searchPlaceholder="Tìm danh mục kiến thức..."
                    disabled={isLoadingQuestion || isSaving || Boolean(loadError)}
                    ariaLabel="Danh mục kiến thức"
                  />
                </div>

                <div className="qf-form-group">
                  <label>
                    Mức độ nhận thức <span className="qf-required-star">*</span>
                  </label>
                  <select
                    className="qf-input-red"
                    required
                    value={cognitiveLevel}
                    onChange={(e) => setCognitiveLevel(e.target.value)}
                    disabled={isLoadingQuestion || isSaving || Boolean(loadError)}
                  >
                    <option value="">Chọn mức độ nhận thức</option>
                    {COGNITIVE_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Section Divider */}
              <div className="qf-section-divider">
                <div>
                  <span className="qf-divider-title">Các phương án trả lời</span>
                  <p>Nhập đủ bốn phương án và chọn một đáp án đúng.</p>
                </div>
              </div>

              {/* Options List */}
              <div className="qf-options-list">
                {options.map((optionText, idx) => {
                  const isCorrect = correctOptionIndices.includes(idx)
                  return (
                    <div
                      key={idx}
                      className={`qf-option-card ${isCorrect ? 'qf-option-card--correct' : ''}`}
                      onClick={() => {
                        if (!isSaving && !isLoadingQuestion && !loadError) {
                          handleSelectCorrect(idx)
                        }
                      }}
                    >
                      <div className="qf-option-left">
                        <input
                          type="radio"
                          name="correctAnswer"
                          checked={isCorrect}
                          onChange={() => handleSelectCorrect(idx)}
                          className="qf-option-control"
                          onClick={(e) => e.stopPropagation()} // Prevent double triggers
                          disabled={isLoadingQuestion || isSaving || Boolean(loadError)}
                        />
                        <span className="qf-option-letter">{getOptionLetter(idx)}</span>
                        <input
                          type="text"
                          className="qf-option-text-input"
                          placeholder={`Đáp án ${getOptionLetter(idx)}...`}
                          value={optionText}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          onClick={(e) => e.stopPropagation()} // Prevent selecting checkbox on text focus
                          disabled={isLoadingQuestion || isSaving || Boolean(loadError)}
                        />
                      </div>

                      <div className="qf-option-right" onClick={(e) => e.stopPropagation()}>
                        {isCorrect && (
                          <span className="qf-option-correct-badge">
                            <CheckOutlined /> Đúng
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Actions Footer */}
              <div className="qf-form-actions">
                <button
                  type="button"
                  className="qf-btn-cancel"
                  onClick={() => requestLeave()}
                >
                  Hủy
                </button>
                <button type="submit" className="qf-btn-save" disabled={isLoadingQuestion || isSaving || Boolean(loadError)}>
                  {isSaving ? 'Đang lưu...' : (isEditMode ? 'Lưu thay đổi' : 'Tạo câu hỏi')}
                </button>
              </div>
            </form>
          </div>
        </div>
        {pendingDestination && (
          <div className="qf-leave-backdrop" role="presentation" onMouseDown={() => setPendingDestination(null)}>
            <section
              className="qf-leave-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="qf-leave-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <span className="qf-leave-dialog__icon" aria-hidden="true"><ExclamationCircleOutlined /></span>
              <div>
                <h3 id="qf-leave-title">Rời trang mà không lưu?</h3>
                <p>Các thay đổi bạn đang chỉnh sửa sẽ bị mất.</p>
              </div>
              <div className="qf-leave-dialog__actions">
                <button type="button" className="qf-btn-cancel" onClick={() => setPendingDestination(null)}>
                  Tiếp tục chỉnh sửa
                </button>
                <button type="button" className="qf-btn-leave" onClick={confirmLeave}>
                  Rời trang, không lưu
                </button>
              </div>
            </section>
          </div>
        )}
        <ConfirmModal
          isOpen={Boolean(pendingSavePayload)}
          title="Câu hỏi đang được sử dụng"
          message={impactWarning?.warning ? `${impactWarning.warning}\n\nTiếp tục cập nhật nội dung câu hỏi? Thay đổi có thể ảnh hưởng đến các bộ đang sử dụng câu hỏi này.` : ''}
          confirmText="Tiếp tục cập nhật"
          danger
          onCancel={() => setPendingSavePayload(null)}
          onConfirm={async () => {
            const payload = pendingSavePayload
            setPendingSavePayload(null)
            if (payload) await persistQuestion(payload)
          }}
        />
      </AppShell>
    </div>
  )
}

export default QuestionFormPage
