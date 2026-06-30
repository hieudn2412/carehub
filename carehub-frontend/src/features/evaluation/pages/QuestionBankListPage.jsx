import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { questionBankApi } from '../api/questionBankApi.js'
import { apiData, apiErrorMessage, difficultyText, normalizeText } from '../utils/documentQuestionUi.js'
import '../styles/QuestionBankListPage.css'

const INITIAL_QUESTIONS = [
  {
    id: 1,
    content: 'Correct hand hygiene technique before patient contact?',
    category: 'Kiểm soát nhiễm khuẩn',
    difficulty: 'Dễ',
    active: true,
    explanation: 'Quy trình vệ sinh tay thường quy theo khuyến cáo của Bộ Y tế gồm 6 bước.',
    options: ['5 bước', '6 bước', '7 bước', '8 bước'],
    correctOptionIndex: 1,
    backend: false,
  },
  {
    id: 2,
    content: 'Steps for safe IV medication administration?',
    category: 'Quy trình lâm sàng',
    difficulty: 'Khó',
    active: false,
    explanation: 'Chỉ chạm vào mặt trong của găng khi đeo găng thứ nhất, mặt ngoài găng khi đeo găng thứ hai.',
    options: ['Chạm vào mọi bề mặt của găng', 'Chỉ chạm vào mặt trong của găng thứ nhất, tránh chạm mặt ngoài', 'Nhờ đồng nghiệp đeo giúp', 'Không cần đeo găng tay'],
    correctOptionIndex: 1,
    backend: false,
  },
]

const DIFFICULTIES = ['Dễ', 'Trung bình', 'Khó']

function mapBackendQuestion(question) {
  return {
    id: question.id,
    content: question.stem,
    category: question.topic || question.sourceDocument || 'Chưa phân loại',
    difficulty: difficultyText(question.difficulty),
    active: question.status === 'APPROVED',
    status: question.status,
    explanation: question.explanation,
    options: [question.optionA, question.optionB, question.optionC, question.optionD],
    correctOptionIndex: ['A', 'B', 'C', 'D'].indexOf(question.correctAnswer),
    correctAnswer: question.correctAnswer,
    questionType: question.questionType,
    parentQuestionId: question.parentQuestionId,
    sourceDocument: question.sourceDocument,
    language: question.language,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    backend: true,
  }
}

function QuestionBankListPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [questions, setQuestions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [apiAvailable, setApiAvailable] = useState(true)
  const [jobQuestionId, setJobQuestionId] = useState(null)
  const [detailQuestion, setDetailQuestion] = useState(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [paraphraseTarget, setParaphraseTarget] = useState(null)
  const [paraphraseForm, setParaphraseForm] = useState({ requestedCount: 3, changeStrength: 'medium' })
  const [modelStatus, setModelStatus] = useState(null)
  const [isModelStatusLoading, setIsModelStatusLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)

  const loadQuestions = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await questionBankApi.listQuestions({ status: 'APPROVED' })
      const backendQuestions = apiData(response, []).map(mapBackendQuestion)
      setQuestions(backendQuestions)
      setApiAvailable(true)
    } catch (error) {
      setQuestions(INITIAL_QUESTIONS)
      setApiAvailable(false)
      showToast(apiErrorMessage(error), 'warning')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadQuestions()
  }, [loadQuestions])

  const categories = useMemo(
    () => Array.from(new Set(questions.map((question) => question.category).filter(Boolean))),
    [questions],
  )

  const filteredQuestions = useMemo(() => {
    const normalizedKeyword = normalizeText(keyword)
    return questions.filter((question) => {
      const matchesKeyword = !normalizedKeyword || normalizeText(question.content).includes(normalizedKeyword)
      const matchesCategory = !categoryFilter || question.category === categoryFilter
      const matchesDifficulty = !difficultyFilter || question.difficulty === difficultyFilter
      const matchesStatus = !statusFilter || (statusFilter === 'true' ? question.active : !question.active)
      return matchesKeyword && matchesCategory && matchesDifficulty && matchesStatus
    })
  }, [questions, keyword, categoryFilter, difficultyFilter, statusFilter])

  const pageSize = 10
  const totalElements = filteredQuestions.length
  const totalPages = Math.ceil(totalElements / pageSize) || 1
  const displayRows = filteredQuestions.slice(page * pageSize, (page + 1) * pageSize)

  function handleDelete(item) {
    if (!item.backend) {
      setQuestions((prev) => prev.filter((question) => question.id !== item.id))
      return
    }
    showToast('Chưa có API xóa câu hỏi backend trong phase này.', 'warning')
  }

  async function openDetailModal(item) {
    setDetailQuestion(item)
    if (!item.backend) return

    setIsDetailLoading(true)
    try {
      const response = await questionBankApi.getQuestion(item.id)
      setDetailQuestion(mapBackendQuestion(apiData(response)))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsDetailLoading(false)
    }
  }

  async function openParaphraseModal(item) {
    if (!item.backend) {
      showToast('Chỉ câu hỏi từ backend mới tạo được phiên diễn đạt lại.', 'warning')
      return
    }
    setParaphraseTarget(item)
    setParaphraseForm({ requestedCount: 3, changeStrength: 'medium' })
    setIsModelStatusLoading(true)
    try {
      const response = await questionBankApi.getModelRuntimeStatus()
      setModelStatus(apiData(response))
    } catch (error) {
      setModelStatus(null)
      showToast(apiErrorMessage(error), 'warning')
    } finally {
      setIsModelStatusLoading(false)
    }
  }

  async function createParaphraseJob() {
    if (!paraphraseTarget) return
    const requestedCount = Math.min(10, Math.max(1, Number(paraphraseForm.requestedCount) || 3))
    setJobQuestionId(paraphraseTarget.id)
    try {
      const response = await questionBankApi.createParaphraseJob(paraphraseTarget.id, {
        requestedCount,
        changeStrength: paraphraseForm.changeStrength,
      })
      const job = apiData(response)
      setParaphraseTarget(null)
      showToast('Tạo phiên diễn đạt lại thành công.', 'success')
      navigate(`/admin/evaluation/paraphrase-jobs/${job.id}`)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setJobQuestionId(null)
    }
  }

  function getDifficultyClass(diff) {
    if (diff === 'Dễ') return 'diff-badge--easy'
    if (diff === 'Trung bình') return 'diff-badge--medium'
    return 'diff-badge--hard'
  }

  function formatIndex(indexOnPage) {
    const absoluteIndex = page * pageSize + indexOnPage + 1
    return String(absoluteIndex).padStart(3, '0')
  }

  function closeDetailModal() {
    setDetailQuestion(null)
    setIsDetailLoading(false)
  }

  const breadcrumbs = [{ label: 'Ngân hàng câu hỏi' }]

  return (
    <>
      <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qbl-page">
              <div className="qbl-title-card">
                <div>
                  <h1 className="qbl-title">Ngân hàng câu hỏi</h1>
                  <p className="qbl-subtitle">Quản lý câu hỏi kiểm tra, tạo biến thể diễn đạt lại và phân loại</p>
                </div>
                <button type="button" className="qbl-btn-refresh" onClick={loadQuestions} disabled={isLoading}>
                  {isLoading ? <LoadingOutlined /> : <ReloadOutlined />}
                  <span>Tải lại</span>
                </button>
              </div>

              {!apiAvailable && (
                <div className="qbl-warning">
                  Đang hiển thị dữ liệu demo vì chưa lấy được ngân hàng câu hỏi từ backend.
                </div>
              )}

              <div className="qbl-filter-bar">
                <div className="qbl-filter-left">
                  <div className="qbl-search">
                    <span className="qbl-search-icon">
                      <SearchOutlined />
                    </span>
                    <input
                      type="text"
                      className="qbl-search-input"
                      placeholder="Tìm câu hỏi..."
                      value={keyword}
                      onChange={(event) => {
                        setKeyword(event.target.value)
                        setPage(0)
                      }}
                    />
                  </div>

                  <select
                    className="qbl-filter-select"
                    value={categoryFilter}
                    onChange={(event) => {
                      setCategoryFilter(event.target.value)
                      setPage(0)
                    }}
                  >
                    <option value="">Danh mục</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>

                  <select
                    className="qbl-filter-select"
                    value={difficultyFilter}
                    onChange={(event) => {
                      setDifficultyFilter(event.target.value)
                      setPage(0)
                    }}
                  >
                    <option value="">Độ khó</option>
                    {DIFFICULTIES.map((difficulty) => (
                      <option key={difficulty} value={difficulty}>
                        {difficulty}
                      </option>
                    ))}
                  </select>

                  <select
                    className="qbl-filter-select"
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value)
                      setPage(0)
                    }}
                  >
                    <option value="">Trạng thái</option>
                    <option value="true">Hoạt động</option>
                    <option value="false">Ngưng hoạt động</option>
                  </select>
                </div>

                <button className="qbl-btn-add" onClick={() => navigate('/admin/evaluation/question-bank/new')}>
                  <PlusCircleOutlined /> Thêm câu hỏi
                </button>
              </div>

              <div className="qbl-table-card">
                <table className="qbl-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>#</th>
                      <th>Nội dung câu hỏi</th>
                      <th>Danh mục</th>
                      <th>Độ khó</th>
                      <th>Loại</th>
                      <th>Trạng thái</th>
                      <th style={{ width: '200px', textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="7" className="qbl-empty-cell">Đang tải ngân hàng câu hỏi...</td>
                      </tr>
                    ) : displayRows.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="qbl-empty-cell">Không tìm thấy câu hỏi nào.</td>
                      </tr>
                    ) : (
                      displayRows.map((item, idx) => (
                        <tr key={`${item.backend ? 'api' : 'demo'}-${item.id}`}>
                          <td style={{ color: '#64748b', fontWeight: 500 }}>{formatIndex(idx)}</td>
                          <td>
                            <button type="button" className="qbl-question-link" onClick={() => openDetailModal(item)}>
                              {item.content}
                            </button>
                          </td>
                          <td style={{ color: '#475569' }}>{item.category}</td>
                          <td>
                            <span className={`diff-badge ${getDifficultyClass(item.difficulty)}`}>{item.difficulty}</span>
                          </td>
                          <td>
                            <span className="qbl-mini-badge">{item.questionType === 'PARAPHRASE' ? 'Diễn đạt lại' : 'Gốc'}</span>
                          </td>
                          <td>
                            <span className={`qbl-badge ${item.active ? 'qbl-badge--active' : 'qbl-badge--inactive'}`}>
                              {item.active ? 'Hoạt động' : 'Ngưng'}
                            </span>
                          </td>
                          <td>
                            <div className="qbl-actions">
                              <button
                                type="button"
                                className="qbl-action-btn qbl-action-btn--view"
                                onClick={() => openDetailModal(item)}
                                title="Xem chi tiết"
                              >
                                <EyeOutlined />
                              </button>
                              <button
                                type="button"
                                className="qbl-action-btn qbl-action-btn--paraphrase"
                                onClick={() => openParaphraseModal(item)}
                                title="Diễn đạt lại"
                                disabled={!item.backend || jobQuestionId === item.id}
                              >
                                {jobQuestionId === item.id ? <LoadingOutlined /> : <CopyOutlined />}
                              </button>
                              <button
                                type="button"
                                className="qbl-action-btn qbl-action-btn--edit"
                                onClick={() => navigate(`/admin/evaluation/question-bank/${item.id}/edit`)}
                                title="Chỉnh sửa"
                              >
                                <EditOutlined />
                              </button>
                              <button
                                type="button"
                                className="qbl-action-btn qbl-action-btn--delete"
                                onClick={() => handleDelete(item)}
                                title="Xóa"
                              >
                                <DeleteOutlined />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <div className="qbl-pagination-bar">
                  <div className="qbl-pagination-info">Hiển thị {displayRows.length} trong tổng số {totalElements} kết quả</div>
                  <div className="qbl-pagination-buttons">
                    <button className="qbl-page-btn" disabled={page <= 0} onClick={() => setPage(page - 1)}>
                      &lt;
                    </button>
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        className={`qbl-page-btn ${page === idx ? 'qbl-page-btn--active' : ''}`}
                        onClick={() => setPage(idx)}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    <button className="qbl-page-btn" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
                      &gt;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      </div>
      {paraphraseTarget && (
        <div className="qbl-modal-backdrop">
          <div className="qbl-modal" role="dialog" aria-modal="true" aria-labelledby="create-paraphrase-title">
            <h2 id="create-paraphrase-title">Tạo phiên diễn đạt lại</h2>
            <p className="qbl-modal-subtitle">{paraphraseTarget.content}</p>

            <div className="qbl-model-status-grid">
              <ModelStatusCard title="DeepSeek tạo câu hỏi" status={modelStatus?.generation} isLoading={isModelStatusLoading} />
              <ModelStatusCard title="E5 duplicate" status={modelStatus?.embedding} isLoading={isModelStatusLoading} />
              <ModelStatusCard title="VietQuill paraphrase" status={modelStatus?.paraphrase} isLoading={isModelStatusLoading} />
            </div>

            <label className="qbl-field">
              <span>Số biến thể</span>
              <input
                type="number"
                min="1"
                max="10"
                value={paraphraseForm.requestedCount}
                onChange={(event) => setParaphraseForm((current) => ({ ...current, requestedCount: event.target.value }))}
              />
            </label>

            <label className="qbl-field">
              <span>Mức thay đổi</span>
              <select
                value={paraphraseForm.changeStrength}
                onChange={(event) => setParaphraseForm((current) => ({ ...current, changeStrength: event.target.value }))}
              >
                <option value="low">Nhẹ</option>
                <option value="medium">Vừa</option>
                <option value="high">Nhiều</option>
              </select>
            </label>

            <div className="qbl-modal-actions">
              <button
                type="button"
                className="qbl-btn-secondary"
                onClick={() => setParaphraseTarget(null)}
                disabled={jobQuestionId === paraphraseTarget.id}
              >
                Hủy
              </button>
              <button
                type="button"
                className="qbl-btn-primary"
                onClick={createParaphraseJob}
                disabled={jobQuestionId === paraphraseTarget.id}
              >
                {jobQuestionId === paraphraseTarget.id ? <LoadingOutlined /> : <CopyOutlined />}
                <span>Tạo phiên</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {detailQuestion && (
        <div className="qbl-modal-backdrop" onClick={closeDetailModal}>
          <div className="qbl-modal qbl-modal--wide" role="dialog" aria-modal="true" aria-labelledby="question-detail-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="question-detail-title">Chi tiết câu hỏi</h2>
            {isDetailLoading ? (
              <div className="qbl-detail-loading">Đang tải chi tiết câu hỏi...</div>
            ) : (
              <>
                <p className="qbl-modal-subtitle">{detailQuestion.content}</p>

                <div className="qbl-detail-meta-grid">
                  <DetailMeta label="Danh mục" value={detailQuestion.category} />
                  <DetailMeta label="Độ khó" value={detailQuestion.difficulty} />
                  <DetailMeta label="Loại" value={detailQuestion.questionType === 'PARAPHRASE' ? 'Diễn đạt lại' : 'Gốc'} />
                  <DetailMeta label="Trạng thái" value={detailQuestion.active ? 'Hoạt động' : 'Ngưng'} />
                  <DetailMeta label="Nguồn" value={detailQuestion.sourceDocument || 'Chưa có'} />
                  <DetailMeta label="Ngôn ngữ" value={detailQuestion.language || 'vi'} />
                </div>

                <div className="qbl-detail-section">
                  <strong>Phương án trả lời</strong>
                  <div className="qbl-detail-options">
                    {(detailQuestion.options || []).map((option, index) => {
                      const isCorrect = index === detailQuestion.correctOptionIndex
                      const letter = String.fromCharCode(65 + index)
                      return (
                        <div key={letter} className={`qbl-detail-option ${isCorrect ? 'qbl-detail-option--correct' : ''}`}>
                          <span>{letter}</span>
                          <p>{option || 'Chưa có nội dung'}</p>
                          {isCorrect && <em>Đáp án đúng</em>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="qbl-detail-section">
                  <strong>Giải thích</strong>
                  <p className="qbl-detail-text">{detailQuestion.explanation || 'Chưa có giải thích.'}</p>
                </div>

                <div className="qbl-modal-actions">
                  <button type="button" className="qbl-btn-secondary" onClick={closeDetailModal}>
                    Đóng
                  </button>
                  {detailQuestion.backend && (
                    <button
                      type="button"
                      className="qbl-btn-primary"
                      onClick={() => navigate(`/admin/evaluation/question-bank/${detailQuestion.id}/edit`)}
                    >
                      <EditOutlined />
                      <span>Mở form chỉnh sửa</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function DetailMeta({ label, value }) {
  return (
    <div className="qbl-detail-meta">
      <span>{label}</span>
      <strong>{value || '---'}</strong>
    </div>
  )
}

function ModelStatusCard({ title, status, isLoading }) {
  if (isLoading) {
    return (
      <div className="qbl-model-status-card">
        <strong>{title}</strong>
        <span>Đang kiểm tra...</span>
      </div>
    )
  }
  if (!status) {
    return (
      <div className="qbl-model-status-card qbl-model-status-card--warning">
        <strong>{title}</strong>
        <span>Chưa đọc được trạng thái</span>
      </div>
    )
  }
  return (
    <div className={`qbl-model-status-card ${status.filesPresent ? 'qbl-model-status-card--ready' : 'qbl-model-status-card--warning'}`}>
      <strong>{title}</strong>
      <span>{status.statusText}</span>
      <small>{status.provider} · {status.model}</small>
      <small>{status.modelPath}</small>
    </div>
  )
}

export default QuestionBankListPage
