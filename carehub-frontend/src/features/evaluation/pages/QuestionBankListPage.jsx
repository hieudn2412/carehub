import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircleOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  SearchOutlined,
  UploadOutlined,
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
    content: 'Kỹ thuật vệ sinh tay đúng trước khi tiếp xúc người bệnh là gì?',
    category: 'Kiểm soát nhiễm khuẩn',
    difficulty: 'Dễ',
    options: ['5 bước', '6 bước', '7 bước', '8 bước'],
    correctOptionIndex: 1,
    backend: false,
  },
  {
    id: 2,
    content: 'Các bước đảm bảo an toàn khi dùng thuốc đường tĩnh mạch là gì?',
    category: 'Quy trình lâm sàng',
    difficulty: 'Khó',
    options: ['Chạm vào mọi bề mặt của găng', 'Chỉ chạm vào mặt trong của găng thứ nhất, tránh chạm mặt ngoài', 'Nhờ đồng nghiệp đeo giúp', 'Không cần đeo găng tay'],
    correctOptionIndex: 1,
    backend: false,
  },
]

const DIFFICULTIES = ['Dễ', 'Trung bình', 'Khó']

const IMPORT_MAPPING_FIELDS = [
  { key: 'stem', label: 'Câu hỏi' },
  { key: 'optionA', label: 'Phương án A' },
  { key: 'optionB', label: 'Phương án B' },
  { key: 'optionC', label: 'Phương án C' },
  { key: 'optionD', label: 'Phương án D' },
  { key: 'correctAnswer', label: 'Đáp án đúng' },
  { key: 'explanation', label: 'Giải thích' },
  { key: 'topic', label: 'Chủ đề' },
  { key: 'difficulty', label: 'Độ khó' },
  { key: 'language', label: 'Ngôn ngữ' },
  { key: 'sourceDocument', label: 'Nguồn' },
]

function mapBackendQuestion(question) {
  return {
    id: question.id,
    content: question.stem,
    category: question.topic || question.sourceDocument || 'Chưa phân loại',
    difficulty: difficultyText(question.difficulty),
    status: question.status,
    duplicateWarning: question.duplicateWarning,
    impactWarning: question.impactWarning,
    options: [question.optionA, question.optionB, question.optionC, question.optionD],
    correctOptionIndex: ['A', 'B', 'C', 'D'].indexOf(question.correctAnswer),
    correctAnswer: question.correctAnswer,
    questionType: question.questionType,
    parentQuestionId: question.parentQuestionId,
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
  const [importFile, setImportFile] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importDuplicateMode, setImportDuplicateMode] = useState('BLOCK')
  const [importColumnMapping, setImportColumnMapping] = useState({})
  const [isExporting, setIsExporting] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('')
  const [page, setPage] = useState(0)

  const loadQuestions = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await questionBankApi.listQuestions({ status: 'ALL' })
      const backendQuestions = apiData(response, [])
        .map(mapBackendQuestion)
        .filter((question) => question.status !== 'ARCHIVED')
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
    // Initial API hydration is intentionally triggered once when the screen mounts.
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
      return matchesKeyword && matchesCategory && matchesDifficulty
    })
  }, [questions, keyword, categoryFilter, difficultyFilter])

  const pageSize = 10
  const totalElements = filteredQuestions.length
  const totalPages = Math.ceil(totalElements / pageSize) || 1
  const displayRows = filteredQuestions.slice(page * pageSize, (page + 1) * pageSize)
  const hasActiveFilters = Boolean(categoryFilter || difficultyFilter)
  const activeFilterCount = [categoryFilter, difficultyFilter].filter(Boolean).length

  async function handleDelete(item) {
    if (!item.backend) {
      setQuestions((prev) => prev.filter((question) => question.id !== item.id))
      return
    }
    let impactWarning = item.impactWarning
    try {
      const response = await questionBankApi.getQuestion(item.id)
      impactWarning = mapBackendQuestion(apiData(response)).impactWarning
    } catch (error) {
      showToast(apiErrorMessage(error), 'warning')
    }
    if (impactWarning?.blocksArchive) {
      window.alert(impactWarning.warning || 'Câu hỏi đang được dùng nên chưa thể lưu trữ.')
      return
    }
    const impactText = impactWarning?.warning ? `${impactWarning.warning}\n\n` : ''
    if (!window.confirm(`${impactText}Lưu trữ câu hỏi này? Câu hỏi sẽ không còn dùng để tạo bộ câu hỏi mới.`)) {
      return
    }

    questionBankApi.archiveQuestion(item.id)
      .then(() => {
        showToast('Đã lưu trữ câu hỏi.', 'success')
        loadQuestions()
      })
      .catch((error) => showToast(apiErrorMessage(error), 'error'))
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
      const result = apiData(response)
      const job = result
      setParaphraseTarget(null)
      showToast('Tạo phiên diễn đạt lại thành công.', 'success')
      if (job?.id) {
        navigate(`/admin/evaluation/paraphrase-jobs/${job.id}`)
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setJobQuestionId(null)
    }
  }

  async function exportQuestions() {
    setIsExporting(true)
    try {
      const response = await questionBankApi.exportQuestions({ status: 'ALL', q: keyword || undefined })
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'question-bank.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      showToast('Đã export ngân hàng câu hỏi.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsExporting(false)
    }
  }

  async function downloadImportTemplate() {
    setIsExporting(true)
    try {
      const response = await questionBankApi.downloadImportTemplate()
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'question-bank-import-template.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      showToast('Đã tải file mẫu import.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsExporting(false)
    }
  }

  async function previewImport() {
    if (!importFile) {
      showToast('Vui lòng chọn file XLSX/XLS/CSV.', 'warning')
      return
    }
    setIsImporting(true)
    try {
      const response = await questionBankApi.previewImport(importFile, cleanedImportColumnMapping())
      setImportPreview(apiData(response))
      showToast('Đã preview file import.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsImporting(false)
    }
  }

  async function commitImport() {
    const validRows = (importPreview?.rows || []).filter((row) => row.valid)
    if (validRows.length === 0) {
      showToast('Không có dòng hợp lệ để import.', 'warning')
      return
    }
    setIsImporting(true)
    try {
      const response = await questionBankApi.commitImport(validRows, importPreview?.importJobId || null, importDuplicateMode)
      const result = apiData(response)
      showToast(`Đã import ${result.createdCount || 0} câu hỏi. ${result.skippedCount || 0} dòng bỏ qua. ${result.failedCount || 0} dòng lỗi.`, result.failedCount ? 'warning' : 'success')
      setImportPreview(result)
      await loadQuestions()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsImporting(false)
    }
  }

  function closeImportModal() {
    setIsImportModalOpen(false)
    setImportFile(null)
    setImportPreview(null)
    setIsImporting(false)
    setImportDuplicateMode('BLOCK')
    setImportColumnMapping({})
  }

  function updateImportColumnMapping(field, value) {
    setImportColumnMapping((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function cleanedImportColumnMapping() {
    const entries = Object.entries(importColumnMapping).filter(([, value]) => value)
    return entries.length === 0 ? null : Object.fromEntries(entries)
  }

  function getDifficultyClass(diff) {
    if (diff === 'Dễ') return 'diff-badge--easy'
    if (diff === 'Trung bình') return 'diff-badge--medium'
    return 'diff-badge--hard'
  }

  function resetFilters() {
    setCategoryFilter('')
    setDifficultyFilter('')
    setPage(0)
  }

  function getVisiblePages() {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index)

    const visible = new Set([0, totalPages - 1, page - 1, page, page + 1])
    const sorted = Array.from(visible)
      .filter((index) => index >= 0 && index < totalPages)
      .sort((a, b) => a - b)

    return sorted.reduce((items, index, position) => {
      if (position > 0 && index - sorted[position - 1] > 1) items.push(`ellipsis-${index}`)
      items.push(index)
      return items
    }, [])
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
                  <p className="qbl-subtitle">Tìm kiếm, phân loại và quản lý nội dung câu hỏi dùng trong các bài kiểm tra.</p>
                </div>
                <button type="button" className="qbl-btn-add" onClick={() => navigate('/admin/evaluation/question-bank/new')}>
                  <PlusCircleOutlined /> Thêm câu hỏi
                </button>
              </div>

              {!apiAvailable && (
                <div className="qbl-warning">
                  Đang hiển thị dữ liệu demo vì chưa lấy được ngân hàng câu hỏi từ backend.
                </div>
              )}

              <div className="qbl-filter-bar">
                <div className="qbl-toolbar-main">
                  <div className="qbl-search-filter-group">
                    <div className="qbl-search">
                      <span className="qbl-search-icon">
                        <SearchOutlined />
                      </span>
                      <input
                        type="text"
                        className="qbl-search-input"
                        placeholder="Tìm theo nội dung câu hỏi..."
                        value={keyword}
                        onChange={(event) => {
                          setKeyword(event.target.value)
                          setPage(0)
                        }}
                      />
                    </div>

                    <details className="qbl-filter-disclosure">
                      <summary>
                        <FilterOutlined /> Bộ lọc
                        {activeFilterCount > 0 && <span className="qbl-filter-count">{activeFilterCount}</span>}
                      </summary>
                      <div className="qbl-filter-panel">
                        <select
                          className="qbl-filter-select"
                          value={categoryFilter}
                          onChange={(event) => {
                            setCategoryFilter(event.target.value)
                            setPage(0)
                          }}
                        >
                          <option value="">Tất cả danh mục</option>
                          {categories.map((category) => (
                            <option key={category} value={category}>{category}</option>
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
                          <option value="">Tất cả độ khó</option>
                          {DIFFICULTIES.map((difficulty) => (
                            <option key={difficulty} value={difficulty}>{difficulty}</option>
                          ))}
                        </select>
                        {hasActiveFilters && (
                          <button type="button" className="qbl-btn-clear" onClick={resetFilters}>Xóa bộ lọc</button>
                        )}
                      </div>
                    </details>
                  </div>

                  <div className="qbl-toolbar-actions">
                    <button className="qbl-btn-secondary" onClick={exportQuestions} disabled={isExporting}>
                      {isExporting ? <LoadingOutlined /> : <DownloadOutlined />} Xuất Excel
                    </button>
                    <button className="qbl-btn-secondary" onClick={() => setIsImportModalOpen(true)}>
                      <UploadOutlined /> Nhập dữ liệu
                    </button>
                  </div>
                </div>
              </div>

              <div className="qbl-table-card">
                <table className="qbl-table">
                  <thead>
                    <tr>
                      <th>Nội dung câu hỏi</th>
                      <th style={{ width: '220px' }}>Danh mục</th>
                      <th style={{ width: '190px', textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="3" className="qbl-empty-cell">Đang tải ngân hàng câu hỏi...</td>
                      </tr>
                    ) : displayRows.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="qbl-empty-cell">
                          <strong>Không tìm thấy câu hỏi phù hợp</strong>
                          <span>Thử đổi từ khóa hoặc xóa bớt bộ lọc.</span>
                        </td>
                      </tr>
                    ) : (
                      displayRows.map((item) => (
                        <tr key={`${item.backend ? 'api' : 'demo'}-${item.id}`}>
                          <td>
                            <button type="button" className="qbl-question-link" onClick={() => openDetailModal(item)}>
                              {item.content}
                            </button>
                            <div className="qbl-question-meta">
                              <span className={`diff-badge ${getDifficultyClass(item.difficulty)}`}>{item.difficulty}</span>
                              <span className="qbl-mini-badge">{item.questionType === 'PARAPHRASE' ? 'Diễn đạt lại' : 'Câu hỏi gốc'}</span>
                            </div>
                          </td>
                          <td className="qbl-category-cell">{item.category}</td>
                          <td>
                            <div className="qbl-actions">
                              <button
                                type="button"
                                className="qbl-action-btn qbl-action-btn--edit"
                                onClick={() => navigate(`/admin/evaluation/question-bank/${item.id}/edit`)}
                                aria-label="Chỉnh sửa câu hỏi"
                                title="Chỉnh sửa"
                              >
                                <EditOutlined />
                              </button>
                              <button
                                type="button"
                                className="qbl-action-btn"
                                onClick={() => openParaphraseModal(item)}
                                disabled={!item.backend || jobQuestionId === item.id}
                                aria-label="Tạo câu hỏi diễn đạt lại"
                                title={item.backend ? 'Tạo câu hỏi diễn đạt lại' : 'Chỉ áp dụng cho câu hỏi đã lưu'}
                              >
                                {jobQuestionId === item.id ? <LoadingOutlined /> : <CopyOutlined />}
                              </button>
                              <button
                                type="button"
                                className="qbl-action-btn qbl-action-btn--view"
                                onClick={() => openDetailModal(item)}
                                aria-label="Xem chi tiết câu hỏi"
                                title="Xem chi tiết"
                              >
                                <EyeOutlined />
                              </button>
                              <button
                                type="button"
                                className="qbl-action-btn qbl-action-btn--delete"
                                onClick={() => handleDelete(item)}
                                aria-label="Xóa câu hỏi"
                                title="Xóa câu hỏi"
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
                    {getVisiblePages().map((item) => typeof item === 'string' ? (
                      <span key={item} className="qbl-page-ellipsis">...</span>
                    ) : (
                      <button
                        key={item}
                        className={`qbl-page-btn ${page === item ? 'qbl-page-btn--active' : ''}`}
                        onClick={() => setPage(item)}
                      >
                        {item + 1}
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
      {isImportModalOpen && (
        <div className="qbl-modal-backdrop">
          <div className="qbl-modal qbl-modal--wide" role="dialog" aria-modal="true" aria-labelledby="import-question-bank-title">
            <h2 id="import-question-bank-title">Import ngân hàng câu hỏi</h2>
            <p className="qbl-modal-subtitle">File hỗ trợ XLSX/XLS/CSV với header hoặc DOCX theo mẫu cố định: Câu hỏi, A-D, Đáp án, Chủ đề và Độ khó.</p>

            <label className="qbl-field">
              <span>File import</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.docx"
                onChange={(event) => {
                  setImportFile(event.target.files?.[0] || null)
                  setImportPreview(null)
                  setImportColumnMapping({})
                }}
              />
            </label>

            <label className="qbl-field">
              <span>Khi gặp câu hỏi trùng mạnh</span>
              <select value={importDuplicateMode} onChange={(event) => setImportDuplicateMode(event.target.value)}>
                <option value="BLOCK">Báo lỗi dòng trùng</option>
                <option value="SKIP_DUPLICATES">Bỏ qua dòng trùng</option>
                <option value="IMPORT_DUPLICATES_AS_DRAFT">Lưu dòng trùng thành bản nháp</option>
              </select>
            </label>

            {(importPreview?.sourceHeaders || []).length > 0 && (
              <div className="qbl-import-preview">
                <p className="qbl-modal-subtitle">Mapping cột từ file nguồn. Chỉ cần chỉnh các cột chưa tự nhận đúng, rồi bấm Preview lại.</p>
                <div className="qbl-detail-meta-grid">
                  {IMPORT_MAPPING_FIELDS.map((field) => (
                    <label key={field.key} className="qbl-field">
                      <span>{field.label}</span>
                      <select
                        value={importColumnMapping[field.key] || ''}
                        onChange={(event) => updateImportColumnMapping(field.key, event.target.value)}
                      >
                        <option value="">Tự nhận theo header</option>
                        {(importPreview.sourceHeaders || []).map((header) => (
                          <option key={`${field.key}-${header}`} value={header}>{header}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {importPreview && (
              <>
                <div className="qbl-import-summary">
                  {importPreview.importJobId && <span>Mã import: #{importPreview.importJobId}</span>}
                  <span>Tổng dòng: {importPreview.totalRows}</span>
                  <span>Hợp lệ: {importPreview.validRows ?? importPreview.createdCount}</span>
                  {(importPreview.skippedCount ?? 0) > 0 && <span>Bỏ qua: {importPreview.skippedCount}</span>}
                  <span>Lỗi: {importPreview.invalidRows ?? importPreview.failedCount}</span>
                </div>
                <div className="qbl-import-preview">
                  <table className="qbl-table">
                    <thead>
                      <tr>
                        <th>Dòng</th>
                        <th>Câu hỏi</th>
                        <th>Đáp án đúng</th>
                        <th>Trạng thái</th>
                        <th>Kết quả</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(importPreview.rows || []).slice(0, 20).map((row) => (
                        <tr key={`${row.rowNumber}-${row.stem}`}>
                          <td>{row.rowNumber}</td>
                          <td>{row.stem}</td>
                          <td>{row.correctAnswer}</td>
                          <td>{row.status}</td>
                          <td>
                            {row.createdQuestionId ? (
                              <span className="qbl-badge qbl-badge--active">Đã lưu #{row.createdQuestionId}</span>
                            ) : row.skipped ? (
                              <span className="qbl-badge qbl-badge--inactive">Bỏ qua</span>
                            ) : row.valid ? (
                              <span className="qbl-badge qbl-badge--active">Hợp lệ</span>
                            ) : (
                              <span className="qbl-import-errors">{(row.errors || []).join(', ')}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(importPreview.rows || []).length > 20 && (
                    <p className="qbl-modal-subtitle">Chỉ hiển thị 20 dòng đầu trong preview.</p>
                  )}
                </div>
              </>
            )}

            <div className="qbl-modal-actions">
              <button type="button" className="qbl-btn-secondary" onClick={downloadImportTemplate} disabled={isExporting || isImporting}>
                {isExporting ? <LoadingOutlined /> : <DownloadOutlined />}
                <span>Tải file mẫu</span>
              </button>
              <button type="button" className="qbl-btn-secondary" onClick={closeImportModal} disabled={isImporting}>
                Đóng
              </button>
              <button type="button" className="qbl-btn-secondary" onClick={previewImport} disabled={isImporting || !importFile}>
                {isImporting ? <LoadingOutlined /> : <UploadOutlined />}
                <span>Preview</span>
              </button>
              <button type="button" className="qbl-btn-primary" onClick={commitImport} disabled={isImporting || !importPreview || (importPreview.rows || []).every((row) => !row.valid)}>
                {isImporting ? <LoadingOutlined /> : <CheckCircleOutlined />}
                <span>Commit dòng hợp lệ</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {detailQuestion && (
        <div className="qbl-modal-backdrop" onClick={closeDetailModal}>
          <div className="qbl-modal qbl-modal--wide qbl-detail-modal" role="dialog" aria-modal="true" aria-labelledby="question-detail-title" onClick={(event) => event.stopPropagation()}>
            {isDetailLoading ? (
              <div className="qbl-detail-loading">Đang tải chi tiết câu hỏi...</div>
            ) : (
              <>
                <div className="qbl-detail-header">
                  <div>
                    <span>Chi tiết câu hỏi</span>
                    <h2 id="question-detail-title">{detailQuestion.content}</h2>
                  </div>
                  <button type="button" className="qbl-detail-close" onClick={closeDetailModal} aria-label="Đóng chi tiết câu hỏi">
                    <CloseOutlined />
                  </button>
                </div>

                {detailQuestion.impactWarning?.warning && (
                  <div className="qbl-impact-warning">
                    <strong>Cảnh báo sử dụng</strong>
                    <p>{detailQuestion.impactWarning.warning}</p>
                  </div>
                )}

                <div className="qbl-detail-meta-grid">
                  <DetailMeta label="Danh mục" value={detailQuestion.category} />
                  <DetailMeta label="Độ khó" value={detailQuestion.difficulty} />
                  <DetailMeta label="Loại câu hỏi" value={detailQuestion.questionType === 'PARAPHRASE' ? 'Diễn đạt lại' : 'Câu hỏi gốc'} />
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
