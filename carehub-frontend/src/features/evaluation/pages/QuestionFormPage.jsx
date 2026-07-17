import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { ArrowLeftOutlined, CheckOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { questionBankApi } from '../api/questionBankApi.js'
import { questionCategoryApi } from '../api/questionCategoryApi.js'
import { apiData, apiErrorMessage, difficultyText } from '../utils/documentQuestionUi.js'
import '../styles/QuestionFormPage.css'

const CATEGORIES = ['Kiểm soát nhiễm khuẩn', 'Quy trình lâm sàng', 'Cấp cứu', 'An toàn người bệnh']
const DIFFICULTIES = ['Dễ', 'Trung bình', 'Khó']
const ANSWER_LETTERS = ['A', 'B', 'C', 'D']
const EMPTY_OPTIONS = ['', '', '', '']

function formSnapshot({ content, category, difficulty, options, correctOptionIndices }) {
  return JSON.stringify({ content, category, difficulty, options, correctOptionIndices })
}

function difficultyValue(label) {
  if (label === 'Dễ') return 'EASY'
  if (label === 'Khó') return 'HARD'
  return 'MEDIUM'
}

function QuestionFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { showToast } = useToast()
  const isEditMode = Boolean(id)

  // Form State
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('Kiểm soát nhiễm khuẩn')
  const [difficulty, setDifficulty] = useState('Dễ')
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [backendCategories, setBackendCategories] = useState([])
  const [impactWarning, setImpactWarning] = useState(null)
  const [loadError, setLoadError] = useState('')
  
  // Dynamic Options State
  const [options, setOptions] = useState(EMPTY_OPTIONS)
  const [correctOptionIndices, setCorrectOptionIndices] = useState([0])
  const [baselineSnapshot, setBaselineSnapshot] = useState(() => isEditMode ? null : formSnapshot({
    content: '',
    category: 'Kiểm soát nhiễm khuẩn',
    difficulty: 'Dễ',
    options: EMPTY_OPTIONS,
    correctOptionIndices: [0],
  }))
  const [pendingDestination, setPendingDestination] = useState(null)

  const currentSnapshot = useMemo(() => formSnapshot({
    content,
    category,
    difficulty,
    options,
    correctOptionIndices,
  }), [category, content, correctOptionIndices, difficulty, options])
  const hasUnsavedChanges = baselineSnapshot !== null && currentSnapshot !== baselineSnapshot

  const categoryOptions = useMemo(() => {
    const names = backendCategories.length > 0 ? backendCategories.map((item) => item.name) : CATEGORIES
    if (category && !names.includes(category)) {
      return [category, ...names]
    }
    return names
  }, [backendCategories, category])

  useEffect(() => {
    let ignore = false

    async function loadCategories() {
      try {
        const response = await questionCategoryApi.listCategories({ status: 'ACTIVE' })
        if (!ignore) {
          setBackendCategories(apiData(response, []))
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
        const loadedCategory = question.topic || question.sourceDocument || 'Chưa phân loại'
        const loadedDifficulty = difficultyText(question.difficulty)
        const loadedOptions = [question.optionA || '', question.optionB || '', question.optionC || '', question.optionD || '']
        const loadedCorrectIndices = [Math.max(0, ANSWER_LETTERS.indexOf(String(question.correctAnswer || 'A').toUpperCase()))]

        setContent(loadedContent)
        setCategory(loadedCategory)
        setDifficulty(loadedDifficulty)
        setOptions(loadedOptions)
        setCorrectOptionIndices(loadedCorrectIndices)
        setBaselineSnapshot(formSnapshot({
          content: loadedContent,
          category: loadedCategory,
          difficulty: loadedDifficulty,
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
      topic: category,
      difficulty: difficultyValue(difficulty),
      language: 'vi',
      sourceDocument: null,
      status: 'APPROVED',
    }

    if (isEditMode && impactWarning?.warning && !window.confirm(`${impactWarning.warning}\n\nTiếp tục cập nhật nội dung câu hỏi?`)) {
      return
    }

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
    <div className="dashboard-layout" onClickCapture={handleNavigationCapture}>
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qf-page">
              <div className="qf-container">
                {/* Header */}
                <div className="qf-header">
                  <button type="button" className="qf-back-btn" onClick={() => requestLeave()}>
                    <ArrowLeftOutlined /> Quay lại ngân hàng câu hỏi
                  </button>
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
                        Danh mục <span className="qf-required-star">*</span>
                      </label>
                      <select
                        className="qf-input-red"
                        required
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        disabled={isLoadingQuestion || isSaving || Boolean(loadError)}
                      >
                        {categoryOptions.map((cat, idx) => (
                          <option key={idx} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="qf-form-group">
                      <label>
                        Độ khó <span className="qf-required-star">*</span>
                      </label>
                      <select
                        className="qf-input-red"
                        required
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                        disabled={isLoadingQuestion || isSaving || Boolean(loadError)}
                      >
                        {DIFFICULTIES.map((diff, idx) => (
                          <option key={idx} value={diff}>
                            {diff}
                          </option>
                        ))}
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
          </main>
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
    </div>
  )
}

export default QuestionFormPage
