import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { CheckOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { questionBankApi } from '../api/questionBankApi.js'
import { questionCategoryApi } from '../api/questionCategoryApi.js'
import { apiData, apiErrorMessage, difficultyText } from '../utils/documentQuestionUi.js'
import '../styles/QuestionFormPage.css'

const CATEGORIES = ['Kiểm soát nhiễm khuẩn', 'Quy trình lâm sàng', 'Cấp cứu', 'An toàn người bệnh']
const DIFFICULTIES = ['Dễ', 'Trung bình', 'Khó']
const ANSWER_LETTERS = ['A', 'B', 'C', 'D']

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
  const [active, setActive] = useState(true)
  const [explanation, setExplanation] = useState('')
  const [sourceDocument, setSourceDocument] = useState('')
  const [questionType, setQuestionType] = useState('single') // 'single' or 'multiple'
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [backendCategories, setBackendCategories] = useState([])
  const [impactWarning, setImpactWarning] = useState(null)
  const [loadError, setLoadError] = useState('')
  
  // Dynamic Options State
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctOptionIndices, setCorrectOptionIndices] = useState([0])

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
      try {
        const response = await questionBankApi.getQuestion(id)
        const question = apiData(response)
        if (!question) {
          throw new Error('Không nhận được dữ liệu câu hỏi từ máy chủ')
        }
        if (ignore) return

        setContent(question.stem || '')
        setCategory(question.topic || question.sourceDocument || 'Chưa phân loại')
        setDifficulty(difficultyText(question.difficulty))
        setActive(question.status === 'APPROVED')
        setExplanation(question.explanation || '')
        setSourceDocument(question.sourceDocument || '')
        setQuestionType('single')
        setOptions([question.optionA || '', question.optionB || '', question.optionC || '', question.optionD || ''])
        setCorrectOptionIndices([Math.max(0, ANSWER_LETTERS.indexOf(String(question.correctAnswer || 'A').toUpperCase()))])
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

  const handleQuestionTypeChange = (type) => {
    setQuestionType(type)
    if (type === 'single') {
      // If switching back to single choice, keep only the first checked option
      setCorrectOptionIndices((prev) => (prev.length > 0 ? [prev[0]] : [0]))
    }
  }

  const handleOptionChange = (index, value) => {
    setOptions((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const handleSelectCorrect = (index) => {
    if (questionType === 'single') {
      setCorrectOptionIndices([index])
    } else {
      setCorrectOptionIndices((prev) =>
        prev.includes(index)
          ? prev.filter((i) => i !== index)
          : [...prev, index]
      )
    }
  }

  const handleAddOption = () => {
    setOptions((prev) => (prev.length >= 4 ? prev : [...prev, '']))
  }

  const handleDeleteOption = (indexToDelete) => {
    if (options.length <= 4) {
      alert('Câu hỏi trắc nghiệm trong ngân hàng hiện cần đúng 4 phương án A-D.')
      return
    }

    setOptions((prev) => prev.filter((_, idx) => idx !== indexToDelete))

    setCorrectOptionIndices((prev) => {
      const nextIndices = prev
        .filter((idx) => idx !== indexToDelete)
        .map((idx) => (idx > indexToDelete ? idx - 1 : idx))
      
      // If we deleted all correct indices, default to the first option
      return nextIndices.length > 0 ? nextIndices : [0]
    })
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

    if (questionType !== 'single' || correctOptionIndices.length !== 1) {
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
      explanation: explanation.trim(),
      topic: category,
      difficulty: difficultyValue(difficulty),
      language: 'vi',
      sourceDocument: sourceDocument.trim(),
      status: active ? 'APPROVED' : 'DRAFT',
    }

    if (isEditMode && !active && impactWarning?.blocksArchive) {
      showToast(impactWarning.warning || 'Câu hỏi đang được dùng nên chưa thể chuyển về bản nháp.', 'warning')
      return
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
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qf-page">
              <div className="qf-container">
                {/* Header */}
                <div className="qf-header">
                  <h2 className="qf-title">
                    {isEditMode ? 'Cập nhật câu hỏi' : 'Tạo câu hỏi'}
                  </h2>
                  <p className="qf-subtitle">
                    Thêm hoặc chỉnh sửa câu hỏi trắc nghiệm trong ngân hàng
                  </p>
                </div>

                {isLoadingQuestion && (
                  <div className="qf-info-banner">Đang tải chi tiết câu hỏi...</div>
                )}
                {loadError && !isLoadingQuestion && (
                  <div className="qf-error-banner">
                    <strong>Không tải được câu hỏi</strong>
                    <p>{loadError}</p>
                    <button type="button" onClick={() => navigate('/admin/evaluation/question-bank')}>
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

                  <div className="qf-form-row">
                    <div className="qf-form-group">
                      <label>Loại câu hỏi <span className="qf-required-star">*</span></label>
                      <select
                        className="qf-input-red"
                        required
                        value={questionType}
                        onChange={(e) => handleQuestionTypeChange(e.target.value)}
                        disabled={isLoadingQuestion || isSaving || Boolean(loadError)}
                      >
                        <option value="single">Một đáp án đúng</option>
                      </select>
                    </div>

                    <div className="qf-form-group">
                      <label>Trạng thái</label>
                      <select
                        className="qf-input-red"
                        value={active.toString()}
                        onChange={(e) => setActive(e.target.value === 'true')}
                        disabled={isLoadingQuestion || isSaving || Boolean(loadError)}
                      >
                        <option value="true">Đã duyệt</option>
                        <option value="false">Bản nháp</option>
                      </select>
                    </div>
                  </div>

                  <div className="qf-form-group">
                    <label>Giải thích đáp án</label>
                    <input
                      type="text"
                      className="qf-input-red"
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      placeholder="Nhập giải thích ngắn gọn cho đáp án đúng..."
                      disabled={isLoadingQuestion || isSaving || Boolean(loadError)}
                    />
                  </div>

                  <div className="qf-form-group">
                    <label>Nguồn câu hỏi</label>
                    <input
                      type="text"
                      className="qf-input-red"
                      value={sourceDocument}
                      onChange={(e) => setSourceDocument(e.target.value)}
                      placeholder="Ví dụ: Tài liệu bệnh viện, file import, nhập thủ công..."
                      disabled={isLoadingQuestion || isSaving || Boolean(loadError)}
                    />
                  </div>

                  {/* Section Divider */}
                  <div className="qf-section-divider">
                    <span className="qf-divider-title">CÁC PHƯƠNG ÁN TRẢ LỜI</span>
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
                              type={questionType === 'single' ? 'radio' : 'checkbox'}
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
                            {options.length > 4 && (
                              <button
                                type="button"
                                className="qf-option-delete-btn"
                                onClick={() => handleDeleteOption(idx)}
                                title="Xóa phương án này"
                                disabled={isLoadingQuestion || isSaving || Boolean(loadError)}
                              >
                                <DeleteOutlined />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Add Option Button */}
                  {options.length < 4 && (
                    <button
                      type="button"
                      className="qf-btn-add-option"
                      onClick={handleAddOption}
                      disabled={isLoadingQuestion || isSaving || Boolean(loadError)}
                    >
                      <PlusOutlined /> Thêm phương án trả lời
                    </button>
                  )}

                  {/* Actions Footer */}
                  <div className="qf-form-actions">
                    <button type="submit" className="qf-btn-save" disabled={isLoadingQuestion || isSaving || Boolean(loadError)}>
                      {isSaving ? 'Đang lưu...' : 'Lưu câu hỏi'}
                    </button>
                    <button
                      type="button"
                      className="qf-btn-cancel"
                      onClick={() => navigate('/admin/evaluation/question-bank')}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default QuestionFormPage
