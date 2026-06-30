import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { CheckOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { questionBankApi } from '../api/questionBankApi.js'
import { apiData, apiErrorMessage, difficultyText } from '../utils/documentQuestionUi.js'
import '../styles/QuestionFormPage.css'

const CATEGORIES = ['Kiểm soát nhiễm khuẩn', 'Quy trình lâm sàng', 'Cấp cứu', 'An toàn người bệnh']
const DIFFICULTIES = ['Dễ', 'Trung bình', 'Khó']
const ANSWER_LETTERS = ['A', 'B', 'C', 'D']

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
  const [questionType, setQuestionType] = useState('single') // 'single' or 'multiple'
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false)
  const [isBackendQuestion, setIsBackendQuestion] = useState(false)
  
  // Dynamic Options State
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctOptionIndices, setCorrectOptionIndices] = useState([0])

  const categoryOptions = useMemo(() => {
    if (category && !CATEGORIES.includes(category)) {
      return [category, ...CATEGORIES]
    }
    return CATEGORIES
  }, [category])

  // Load existing question details in edit mode
  useEffect(() => {
    if (!isEditMode) {
      setIsBackendQuestion(false)
      return undefined
    }

    let ignore = false

    async function loadQuestion() {
      setIsLoadingQuestion(true)
      try {
        const response = await questionBankApi.getQuestion(id)
        const question = apiData(response)
        if (!question) {
          throw new Error('Empty question response')
        }
        if (ignore) return

        setContent(question.stem || '')
        setCategory(question.topic || question.sourceDocument || 'Chưa phân loại')
        setDifficulty(difficultyText(question.difficulty))
        setActive(question.status === 'APPROVED')
        setExplanation(question.explanation || '')
        setQuestionType('single')
        setOptions([question.optionA || '', question.optionB || '', question.optionC || '', question.optionD || ''])
        setCorrectOptionIndices([Math.max(0, ANSWER_LETTERS.indexOf(String(question.correctAnswer || 'A').toUpperCase()))])
        setIsBackendQuestion(true)
      } catch (error) {
        if (ignore) return
        setIsBackendQuestion(false)
        const loadedLocal = loadLocalQuestion()
        if (!loadedLocal) {
          showToast(apiErrorMessage(error), 'warning')
        }
      } finally {
        if (!ignore) {
          setIsLoadingQuestion(false)
        }
      }
    }

    function loadLocalQuestion() {
      const stored = localStorage.getItem('carehub_questions')
      if (stored) {
        try {
          const list = JSON.parse(stored)
          const found = list.find((q) => q.id === Number(id))
          if (found) {
            setContent(found.content || '')
            setCategory(found.category || 'Kiểm soát nhiễm khuẩn')
            setDifficulty(found.difficulty || 'Dễ')
            setActive(found.active !== undefined ? found.active : true)
            setExplanation(found.explanation || '')
            setQuestionType(found.questionType || 'single')
            
            if (found.options && found.options.length >= 2) {
              setOptions(found.options)
            }
            
            // Backwards compatibility for single correct index
            if (found.correctOptionIndices && found.correctOptionIndices.length > 0) {
              setCorrectOptionIndices(found.correctOptionIndices)
            } else if (found.correctOptionIndex !== undefined) {
              setCorrectOptionIndices([found.correctOptionIndex])
            } else {
              setCorrectOptionIndices([0])
            }
            return true
          }
        } catch (e) {
          console.error('Error loading question details:', e)
        }
      }
      return false
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
    setOptions((prev) => [...prev, ''])
  }

  const handleDeleteOption = (indexToDelete) => {
    if (options.length <= 2) {
      alert('Câu hỏi trắc nghiệm phải có ít nhất 2 phương án trả lời!')
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

  const handleSave = (e) => {
    e.preventDefault()

    if (isBackendQuestion) {
      showToast('Chưa có API cập nhật câu hỏi backend trong phase này.', 'warning')
      return
    }
    
    if (!content.trim()) {
      alert('Vui lòng nhập nội dung câu hỏi!')
      return
    }

    if (options.some(opt => !opt.trim())) {
      alert('Vui lòng nhập đầy đủ nội dung cho tất cả các phương án trả lời!')
      return
    }

    if (correctOptionIndices.length === 0) {
      alert('Vui lòng chọn ít nhất một đáp án đúng!')
      return
    }

    const stored = localStorage.getItem('carehub_questions')
    let list = []
    if (stored) {
      try {
        list = JSON.parse(stored)
      } catch (err) {
        console.error(err)
      }
    }

    const questionData = {
      content: content.trim(),
      category,
      difficulty,
      active,
      explanation: explanation.trim(),
      questionType,
      options: options.map(o => o.trim()),
      correctOptionIndices,
    }

    if (isEditMode) {
      list = list.map((item) =>
        item.id === Number(id)
          ? {
              ...item,
              ...questionData,
            }
          : item
      )
    } else {
      const newQuestion = {
        id: Date.now(),
        ...questionData,
      }
      list = [newQuestion, ...list]
    }

    localStorage.setItem('carehub_questions', JSON.stringify(list))
    navigate('/admin/evaluation/question-bank')
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
                    {isBackendQuestion
                      ? 'Đang hiển thị câu hỏi từ backend. API cập nhật sẽ bổ sung ở phase sau.'
                      : 'Thêm hoặc chỉnh sửa câu hỏi trắc nghiệm trong ngân hàng'}
                  </p>
                </div>

                {isLoadingQuestion && (
                  <div className="qf-info-banner">Đang tải chi tiết câu hỏi...</div>
                )}

                <form onSubmit={handleSave} className="qf-form">
                  {/* Question Text */}
                  <div className="qf-form-group">
                    <label>
                      Nội dung câu hỏi (Question text) <span className="qf-required-star">*</span>
                    </label>
                    <textarea
                      className="qf-input-green"
                      rows={3}
                      required
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Nhập nội dung câu hỏi trắc nghiệm..."
                      disabled={isLoadingQuestion || isBackendQuestion}
                    />
                  </div>

                  {/* Inputs Grid */}
                  <div className="qf-form-row">
                    <div className="qf-form-group">
                      <label>
                        Danh mục (Category) <span className="qf-required-star">*</span>
                      </label>
                      <select
                        className="qf-input-red"
                        required
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        disabled={isLoadingQuestion || isBackendQuestion}
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
                        Độ khó (Difficulty) <span className="qf-required-star">*</span>
                      </label>
                      <select
                        className="qf-input-red"
                        required
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                        disabled={isLoadingQuestion || isBackendQuestion}
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
                        disabled={isLoadingQuestion || isBackendQuestion}
                      >
                        <option value="single">Một đáp án đúng (Single choice)</option>
                        <option value="multiple">Nhiều đáp án đúng (Multiple choice)</option>
                      </select>
                    </div>

                    <div className="qf-form-group">
                      <label>Trạng thái (Status)</label>
                      <select
                        className="qf-input-red"
                        value={active.toString()}
                        onChange={(e) => setActive(e.target.value === 'true')}
                        disabled={isLoadingQuestion || isBackendQuestion}
                      >
                        <option value="true">Hoạt động (Active)</option>
                        <option value="false">Ngưng hoạt động (Inactive)</option>
                      </select>
                    </div>
                  </div>

                  <div className="qf-form-group">
                    <label>Giải thích đáp án (Explanation - tùy chọn)</label>
                    <input
                      type="text"
                      className="qf-input-red"
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      placeholder="Nhập giải thích ngắn gọn cho đáp án đúng..."
                      disabled={isLoadingQuestion || isBackendQuestion}
                    />
                  </div>

                  {/* Section Divider */}
                  <div className="qf-section-divider">
                    <span className="qf-divider-title">CÁC PHƯƠNG ÁN TRẢ LỜI (ANSWER OPTIONS)</span>
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
                            if (!isBackendQuestion && !isLoadingQuestion) {
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
                              disabled={isLoadingQuestion || isBackendQuestion}
                            />
                            <span className="qf-option-letter">{getOptionLetter(idx)}</span>
                            <input
                              type="text"
                              className="qf-option-text-input"
                              placeholder={`Đáp án ${getOptionLetter(idx)}...`}
                              value={optionText}
                              onChange={(e) => handleOptionChange(idx, e.target.value)}
                              onClick={(e) => e.stopPropagation()} // Prevent selecting checkbox on text focus
                              disabled={isLoadingQuestion || isBackendQuestion}
                            />
                          </div>

                          <div className="qf-option-right" onClick={(e) => e.stopPropagation()}>
                            {isCorrect && (
                              <span className="qf-option-correct-badge">
                                <CheckOutlined /> Đúng (Correct)
                              </span>
                            )}
                            {!isBackendQuestion && options.length > 2 && (
                              <button
                                type="button"
                                className="qf-option-delete-btn"
                                onClick={() => handleDeleteOption(idx)}
                                title="Xóa phương án này"
                                disabled={isLoadingQuestion}
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
                  {!isBackendQuestion && (
                    <button
                      type="button"
                      className="qf-btn-add-option"
                      onClick={handleAddOption}
                      disabled={isLoadingQuestion}
                    >
                      <PlusOutlined /> Thêm phương án trả lời
                    </button>
                  )}

                  {/* Actions Footer */}
                  <div className="qf-form-actions">
                    <button type="submit" className="qf-btn-save" disabled={isLoadingQuestion || isBackendQuestion}>
                      {isBackendQuestion ? 'Chưa hỗ trợ lưu backend' : 'Lưu câu hỏi'}
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
