import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  CloseOutlined,
  LoadingOutlined,
  SaveOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { questionBankApi } from '../api/questionBankApi.js'
import { questionSetApi } from '../api/questionSetApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/QuestionSetQuestionsPage.css'

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Dễ' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'hard', label: 'Khó' },
]

function QuestionSetQuestionsPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { showToast } = useToast()

  const [questionSet, setQuestionSet] = useState(null)
  const [questionsList, setQuestionsList] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [qKeyword, setQKeyword] = useState('')
  const [qCategory, setQCategory] = useState('')
  const [qDifficulty, setQDifficulty] = useState('')
  const [qSource, setQSource] = useState('')
  const [qType, setQType] = useState('')
  const [qPage, setQPage] = useState(0)

  const [previewCounts, setPreviewCounts] = useState({ easy: 0, medium: 0, hard: 0 })
  const [avoidSameSource, setAvoidSameSource] = useState(true)
  const [previewResult, setPreviewResult] = useState(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [showQuickCreate, setShowQuickCreate] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [questionsResponse, detailResponse] = await Promise.all([
        questionBankApi.listQuestions({ status: 'APPROVED' }),
        questionSetApi.getQuestionSet(id),
      ])
      const questions = apiData(questionsResponse, [])
      setQuestionsList(questions)
      const detail = apiData(detailResponse)
      setQuestionSet(detail)
      setSelectedIds((detail.items || []).map((item) => item.question?.id).filter(Boolean))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [id, showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const topics = useMemo(() => {
    return Array.from(new Set(questionsList.map((question) => question.topic).filter(Boolean))).sort()
  }, [questionsList])

  const sources = useMemo(() => {
    return Array.from(new Set(questionsList.map((question) => question.sourceDocument).filter(Boolean))).sort()
  }, [questionsList])

  const selectedQuestions = useMemo(() => {
    const byId = new Map(questionsList.map((question) => [question.id, question]))
    return selectedIds.map((questionId) => byId.get(questionId)).filter(Boolean)
  }, [questionsList, selectedIds])

  const filteredQuestions = useMemo(() => {
    const keyword = normalize(qKeyword)
    return questionsList.filter((question) => {
      const matchesKeyword = !keyword
        || normalize(question.stem).includes(keyword)
        || normalize(question.topic).includes(keyword)
        || normalize(question.sourceDocument).includes(keyword)
      const matchesCategory = !qCategory || question.topic === qCategory
      const matchesDifficulty = !qDifficulty || normalize(question.difficulty) === normalize(qDifficulty)
      const matchesSource = !qSource || question.sourceDocument === qSource
      const matchesType = !qType || question.questionType === qType
      return matchesKeyword && matchesCategory && matchesDifficulty && matchesSource && matchesType
    })
  }, [qCategory, qDifficulty, qKeyword, qSource, qType, questionsList])

  const pageSize = 6
  const qTotalElements = filteredQuestions.length
  const qTotalPages = Math.ceil(qTotalElements / pageSize) || 1
  const displayQuestions = filteredQuestions.slice(qPage * pageSize, (qPage + 1) * pageSize)
  const displayIds = displayQuestions.map((question) => question.id)
  const isAllDisplayChecked = displayIds.length > 0 && displayIds.every((questionId) => selectedIds.includes(questionId))
  const isActiveLocked = questionSet?.status === 'ACTIVE'

  function toggleQuestion(questionId) {
    if (isActiveLocked) return
    setSelectedIds((current) => current.includes(questionId)
      ? current.filter((idValue) => idValue !== questionId)
      : [...current, questionId])
  }

  function toggleSelectAllDisplay() {
    if (isActiveLocked) return
    if (isAllDisplayChecked) {
      setSelectedIds((current) => current.filter((questionId) => !displayIds.includes(questionId)))
      return
    }
    setSelectedIds((current) => {
      const next = [...current]
      displayIds.forEach((questionId) => {
        if (!next.includes(questionId)) {
          next.push(questionId)
        }
      })
      return next
    })
  }

  function moveSelected(questionId, direction) {
    if (isActiveLocked) return
    setSelectedIds((current) => {
      const index = current.indexOf(questionId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current
      }
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  async function handleSave() {
    if (isActiveLocked) {
      showToast('Bộ câu hỏi đang hoạt động đã được khóa snapshot. Hãy tạo bản nháp chỉnh sửa.', 'warning')
      return
    }
    setIsSaving(true)
    try {
      await questionSetApi.updateQuestionSet(id, {
        name: questionSet.name,
        category: questionSet.category || null,
        status: questionSet.status,
        description: questionSet.description || null,
        questionIds: selectedIds,
      })
      showToast('Lưu danh sách câu hỏi thành công.', 'success')
      navigate('/admin/evaluation/question-sets')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  async function previewQuickCreate() {
    setIsPreviewing(true)
    try {
      const response = await questionSetApi.previewQuestionSet({
        category: null,
        difficultyDistribution: Object.fromEntries(
          Object.entries(previewCounts).map(([key, value]) => [key, Number(value) || 0])
        ),
        excludeQuestionIds: selectedIds,
        avoidSameSourceDocument: avoidSameSource,
        randomSeed: null,
      })
      setPreviewResult(apiData(response))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsPreviewing(false)
    }
  }

  function applyPreview() {
    if (isActiveLocked) return
    const questionIds = previewResult?.questionIds || []
    if (!questionIds.length) {
      showToast('Không có câu hỏi xem trước để áp dụng.', 'warning')
      return
    }
    setSelectedIds((current) => {
      const next = [...current]
      questionIds.forEach((questionId) => {
        if (!next.includes(questionId)) {
          next.push(questionId)
        }
      })
      return next
    })
    setPreviewResult(null)
    setShowQuickCreate(false)
    showToast('Đã thêm câu hỏi xem trước vào bộ.', 'success')
  }

  function openQuickCreate() {
    setPreviewResult(null)
    setShowQuickCreate(true)
  }

  const breadcrumbs = [
    { label: 'Bộ câu hỏi', path: '/admin/evaluation/question-sets' },
    { label: questionSet?.name || 'Chọn câu hỏi' },
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qsq-page">
              <div className="qsq-container">
                <div className="qsq-header">
                  <button type="button" className="qsq-btn-cancel" onClick={() => navigate('/admin/evaluation/question-sets')}>
                    <ArrowLeftOutlined /> Quay lại
                  </button>
                  <div>
                    <h2 className="qsq-title">Chọn câu hỏi cho bộ</h2>
                    <p className="qsq-subtitle">Thêm, sắp xếp và quản lý câu hỏi trong bộ</p>
                  </div>
                </div>

                {isLoading ? (
                  <section className="qsq-loading">Đang tải dữ liệu...</section>
                ) : questionSet ? (
                  <>
                    <div className="qsq-info-card">
                      <div className="qsq-info-row">
                        <div className="qsq-info-item">
                          <span className="qsq-info-label">Tên bộ</span>
                          <span className="qsq-info-value">{questionSet.name}</span>
                        </div>
                        <div className="qsq-info-item">
                          <span className="qsq-info-label">Danh mục</span>
                          <span className="qsq-info-value">{questionSet.category || '---'}</span>
                        </div>
                        <div className="qsq-info-item">
                          <span className="qsq-info-label">Trạng thái</span>
                          <span className={`qsq-status-badge ${questionSet.status === 'ACTIVE' ? 'qsq-status-badge--active' : 'qsq-status-badge--draft'}`}>
                            {questionSet.statusText || questionSet.status}
                          </span>
                        </div>
                        <div className="qsq-info-item">
                          <span className="qsq-count-badge">{selectedIds.length} câu hỏi đã chọn</span>
                        </div>
                      </div>
                    </div>

                    {isActiveLocked && (
                      <div className="qsq-lock-banner">
                        <strong>⚠️ Bộ câu hỏi đang hoạt động</strong>
                        <span>Không thể thay đổi câu hỏi. Hãy tạo bản nháp chỉnh sửa từ trang chi tiết.</span>
                      </div>
                    )}

                    <div className="qsq-filter-bar">
                      <div className="qsq-search">
                        <span className="qsq-search-icon"><SearchOutlined /></span>
                        <input
                          type="text"
                          className="qsq-search-input"
                          placeholder="Tìm câu hỏi..."
                          value={qKeyword}
                          onChange={(event) => { setQKeyword(event.target.value); setQPage(0) }}
                        />
                      </div>
                      <select className="qsq-filter-select" value={qCategory} onChange={(event) => { setQCategory(event.target.value); setQPage(0) }}>
                        <option value="">Danh mục</option>
                        {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
                      </select>
                      <select className="qsq-filter-select" value={qDifficulty} onChange={(event) => { setQDifficulty(event.target.value); setQPage(0) }}>
                        <option value="">Độ khó</option>
                        {DIFFICULTY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      <select className="qsq-filter-select" value={qSource} onChange={(event) => { setQSource(event.target.value); setQPage(0) }}>
                        <option value="">Nguồn</option>
                        {sources.map((source) => <option key={source} value={source}>{source}</option>)}
                      </select>
                      <select className="qsq-filter-select" value={qType} onChange={(event) => { setQType(event.target.value); setQPage(0) }}>
                        <option value="">Loại</option>
                        <option value="ORIGINAL">Gốc</option>
                        <option value="PARAPHRASE">Diễn đạt lại</option>
                      </select>
                      <div className="qsq-filter-actions">
                        <button type="button" className="qsq-btn-quick" onClick={openQuickCreate} disabled={isActiveLocked}>
                          <ThunderboltOutlined /> Tạo nhanh
                        </button>
                        <button type="button" className="qsq-btn-save" onClick={handleSave} disabled={isSaving || isActiveLocked}>
                          {isSaving ? <LoadingOutlined /> : <SaveOutlined />}
                          Lưu
                        </button>
                      </div>
                    </div>

                    <div className="qsq-table-card">
                      <table className="qsq-table">
                        <thead>
                          <tr>
                            <th style={{ width: '50px', textAlign: 'center' }}>
                              <input type="checkbox" checked={isAllDisplayChecked} onChange={toggleSelectAllDisplay} disabled={isActiveLocked} />
                            </th>
                            <th>Nội dung câu hỏi</th>
                            <th>Danh mục</th>
                            <th>Độ khó</th>
                            <th>Nguồn</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayQuestions.length === 0 ? (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 0' }}>
                                Không tìm thấy câu hỏi nào.
                              </td>
                            </tr>
                          ) : (
                            displayQuestions.map((question) => (
                              <tr key={question.id} onClick={() => toggleQuestion(question.id)} style={{ cursor: isActiveLocked ? 'default' : 'pointer' }}>
                                <td style={{ textAlign: 'center' }} onClick={(event) => event.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(question.id)}
                                    onChange={() => toggleQuestion(question.id)}
                                    disabled={isActiveLocked}
                                  />
                                </td>
                                <td style={{ fontWeight: 500, color: '#1e293b' }}>{question.stem}</td>
                                <td style={{ color: '#475569' }}>{question.topic || '---'}</td>
                                <td>
                                  <span className={`qsq-diff-badge ${getDifficultyClass(question.difficulty)}`}>
                                    {difficultyText(question.difficulty)}
                                  </span>
                                </td>
                                <td style={{ color: '#64748b' }}>{question.sourceDocument || question.questionType || '---'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>

                      <div className="qsq-pagination-bar">
                        <div className="qsq-pagination-info">
                          Hiển thị {displayQuestions.length}/{qTotalElements} kết quả ({selectedIds.length} đã chọn)
                        </div>
                        <div className="qsq-pagination-buttons">
                          <button type="button" className="qsq-page-btn" disabled={qPage <= 0} onClick={() => setQPage(qPage - 1)}>&lt;</button>
                          {(() => {
                            const maxVisible = 5
                            const half = Math.floor(maxVisible / 2)
                            let start = Math.max(0, qPage - half)
                            const end = Math.min(qTotalPages, start + maxVisible)
                            if (end - start < maxVisible) start = Math.max(0, end - maxVisible)
                            const buttons = []
                            if (start > 0) {
                              buttons.push(<button key={0} className={`qsq-page-btn ${qPage === 0 ? 'qsq-page-btn--active' : ''}`} onClick={() => setQPage(0)}>1</button>)
                              if (start > 1) buttons.push(<span key="se" className="qsq-page-btn qsq-page-btn--dots">&hellip;</span>)
                            }
                            for (let i = start; i < end; i++) {
                              buttons.push(<button key={i} className={`qsq-page-btn ${qPage === i ? 'qsq-page-btn--active' : ''}`} onClick={() => setQPage(i)}>{i + 1}</button>)
                            }
                            if (end < qTotalPages) {
                              if (end < qTotalPages - 1) buttons.push(<span key="ee" className="qsq-page-btn qsq-page-btn--dots">&hellip;</span>)
                              buttons.push(<button key={qTotalPages - 1} className={`qsq-page-btn ${qPage === qTotalPages - 1 ? 'qsq-page-btn--active' : ''}`} onClick={() => setQPage(qTotalPages - 1)}>{qTotalPages}</button>)
                            }
                            return buttons
                          })()}
                          <button type="button" className="qsq-page-btn" disabled={qPage + 1 >= qTotalPages} onClick={() => setQPage(qPage + 1)}>&gt;</button>
                        </div>
                      </div>
                    </div>

                    <div className="qsq-selected-card">
                      <h3>Câu đã chọn ({selectedQuestions.length})</h3>
                      {selectedQuestions.length === 0 ? (
                        <p className="qsq-empty-text">Chưa có câu hỏi nào trong bộ.</p>
                      ) : (
                        selectedQuestions.map((question, index) => (
                          <div className="qsq-selected-row" key={question.id}>
                            <span>{index + 1}</span>
                            <strong>{question.stem}</strong>
                            <div>
                              <button type="button" onClick={() => moveSelected(question.id, -1)} disabled={index === 0 || isActiveLocked} title="Đưa lên">
                                <ArrowUpOutlined />
                              </button>
                              <button type="button" onClick={() => moveSelected(question.id, 1)} disabled={index === selectedQuestions.length - 1 || isActiveLocked} title="Đưa xuống">
                                <ArrowDownOutlined />
                              </button>
                              <button type="button" onClick={() => toggleQuestion(question.id)} title="Bỏ khỏi bộ" disabled={isActiveLocked}>
                                <CloseOutlined />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <section className="qsq-loading">Không tìm thấy bộ câu hỏi.</section>
                )}
              </div>
            </div>

            {showQuickCreate && (
              <div className="qsq-modal-backdrop" onClick={() => setShowQuickCreate(false)}>
                <div className="qsq-modal" onClick={(event) => event.stopPropagation()}>
                  <div className="qsq-modal-header">
                    <h2 className="qsq-modal-title">Tạo nhanh theo cấu hình</h2>
                    <button className="qsq-modal-close" onClick={() => setShowQuickCreate(false)}>✕</button>
                  </div>
                  <div className="qsq-modal-body">
                    <div className="qsq-modal-row">
                      {DIFFICULTY_OPTIONS.map((option) => (
                        <div className="qsq-modal-group" key={option.value}>
                          <label>{option.label}</label>
                          <input
                            type="number"
                            min="0"
                            className="qsq-input-green"
                            value={previewCounts[option.value]}
                            onChange={(event) => setPreviewCounts((current) => ({
                              ...current,
                              [option.value]: event.target.value,
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="qsq-modal-group">
                      <label>Tránh cùng nguồn tài liệu</label>
                      <select className="qsq-input-red" value={String(avoidSameSource)} onChange={(event) => setAvoidSameSource(event.target.value === 'true')}>
                        <option value="true">Có</option>
                        <option value="false">Không</option>
                      </select>
                    </div>
                    {previewResult && (
                      <div className="qsq-preview-box">
                        <strong>{previewResult.questionIds?.length || 0} câu hỏi gợi ý</strong>
                        {(previewResult.warnings || []).map((warning) => <p key={warning}>{warning}</p>)}
                        {(previewResult.shortage || []).map((item) => (
                          <p key={item.difficulty}>Thiếu {difficultyText(item.difficulty)}: cần {item.requested}, có {item.available}</p>
                        ))}
                      </div>
                    )}
                    <div className="qsq-modal-actions">
                      <button type="button" className="qsq-btn-save" onClick={previewQuickCreate} disabled={isPreviewing}>
                        {isPreviewing ? <LoadingOutlined /> : <SearchOutlined />}
                        Xem trước
                      </button>
                      <button type="button" className="qsq-btn-cancel" onClick={applyPreview} disabled={!previewResult?.questionIds?.length}>
                        Áp dụng
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

function getDifficultyClass(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'easy' || value === 'Dễ') return 'qsq-diff-badge--easy'
  if (normalized === 'medium' || value === 'Trung bình') return 'qsq-diff-badge--medium'
  return 'qsq-diff-badge--hard'
}

function difficultyText(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'easy') return 'Dễ'
  if (normalized === 'medium') return 'Trung bình'
  if (normalized === 'hard') return 'Khó'
  return value || '---'
}

function normalize(value) {
  return String(value || '').toLowerCase().trim()
}

export default QuestionSetQuestionsPage
