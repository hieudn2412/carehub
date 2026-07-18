import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  LoadingOutlined,
  StopOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
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
    active: true,
    explanation: 'Quy trình vệ sinh tay thường quy theo khuyến cáo của Bộ Y tế gồm 6 bước.',
    options: ['5 bước', '6 bước', '7 bước', '8 bước'],
    correctOptionIndex: 1,
    backend: false,
  },
  {
    id: 2,
    content: 'Các bước đảm bảo an toàn khi dùng thuốc đường tĩnh mạch là gì?',
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
  { key: 'status', label: 'Trạng thái' },
]

function mapBackendQuestion(question) {
  return {
    id: question.id,
    content: question.stem,
    category: question.topic || question.sourceDocument || 'Chưa phân loại',
    difficulty: difficultyText(question.difficulty),
    active: question.status === 'APPROVED',
    status: question.status,
    statusText: question.statusText,
    duplicateWarning: question.duplicateWarning,
    impactWarning: question.impactWarning,
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
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([])
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
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)

  const loadQuestions = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await questionBankApi.listQuestions({ status: 'ALL' })
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
      const matchesStatus = !statusFilter || question.status === statusFilter
      return matchesKeyword && matchesCategory && matchesDifficulty && matchesStatus
    })
  }, [questions, keyword, categoryFilter, difficultyFilter, statusFilter])

  const pageSize = 10
  const totalElements = filteredQuestions.length
  const totalPages = Math.ceil(totalElements / pageSize) || 1
  const displayRows = filteredQuestions.slice(page * pageSize, (page + 1) * pageSize)
  const selectedApprovedQuestionIds = questions
    .filter((question) => selectedQuestionIds.includes(question.id))
    .filter((question) => question.backend && question.status === 'APPROVED')
    .map((question) => question.id)

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

  function handleStatusAction(item) {
    if (!item.backend) {
      showToast('Dữ liệu demo không thể đổi trạng thái.', 'warning')
      return
    }
    if (item.status === 'APPROVED') {
      questionBankApi.getQuestion(item.id)
        .then((response) => {
          const detail = mapBackendQuestion(apiData(response))
          if (detail.impactWarning?.blocksArchive) {
            window.alert(detail.impactWarning.warning || 'Câu hỏi đang được dùng nên chưa thể chuyển về bản nháp.')
            return
          }
          return questionBankApi.deactivateQuestion(item.id)
        })
        .then((response) => {
          if (!response) return
          showToast('Đã chuyển câu hỏi về bản nháp.', 'success')
          loadQuestions()
        })
        .catch((error) => showToast(apiErrorMessage(error), 'error'))
      return
    }
    const request = item.status === 'APPROVED'
      ? questionBankApi.deactivateQuestion(item.id)
      : questionBankApi.approveQuestion(item.id)
    request
      .then(() => {
        showToast(item.status === 'APPROVED' ? 'Đã chuyển câu hỏi về bản nháp.' : 'Đã duyệt câu hỏi.', 'success')
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

  async function openBatchParaphraseModal() {
    if (selectedApprovedQuestionIds.length === 0) {
      showToast('Vui lòng chọn ít nhất một câu hỏi đã duyệt để tạo biến thể.', 'warning')
      return
    }
    setParaphraseTarget({
      id: 'batch',
      batch: true,
      content: `Tạo biến thể cho ${selectedApprovedQuestionIds.length} câu hỏi đã duyệt`,
      questionIds: selectedApprovedQuestionIds,
    })
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
      const response = paraphraseTarget.batch
        ? await questionBankApi.createBatchParaphraseJobs({
          questionIds: paraphraseTarget.questionIds,
          requestedCount,
          changeStrength: paraphraseForm.changeStrength,
        })
        : await questionBankApi.createParaphraseJob(paraphraseTarget.id, {
          requestedCount,
          changeStrength: paraphraseForm.changeStrength,
        })
      const result = apiData(response)
      const job = paraphraseTarget.batch ? result.jobs?.[0] : result
      setParaphraseTarget(null)
      setSelectedQuestionIds([])
      if (paraphraseTarget.batch) {
        showToast(`Đã tạo ${result.succeededCount || 0} phiên diễn đạt lại. ${result.failedCount || 0} lỗi.`, result.failedCount ? 'warning' : 'success')
      } else {
        showToast('Tạo phiên diễn đạt lại thành công.', 'success')
      }
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
      const response = await questionBankApi.exportQuestions({ status: statusFilter || 'ALL', q: keyword || undefined })
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = 'ngan-hang-cau-hoi.xlsx'
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
      link.download = 'mau-nhap-cau-hoi.xlsx'
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

  function toggleQuestionSelection(questionId) {
    setSelectedQuestionIds((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId]
    )
  }

  function togglePageSelection() {
    const pageIds = displayRows
      .filter((question) => question.backend && question.status === 'APPROVED')
      .map((question) => question.id)
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedQuestionIds.includes(id))
    setSelectedQuestionIds((current) => {
      if (allSelected) {
        return current.filter((id) => !pageIds.includes(id))
      }
      return Array.from(new Set([...current, ...pageIds]))
    })
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
                    <option value="APPROVED">Đã duyệt</option>
                    <option value="DRAFT">Bản nháp</option>
                    <option value="REJECTED">Đã từ chối</option>
                    <option value="ARCHIVED">Đã lưu trữ</option>
                  </select>
                </div>

                <div className="qbl-toolbar-actions">
                  <button className="qbl-btn-secondary" onClick={exportQuestions} disabled={isExporting}>
                    {isExporting ? <LoadingOutlined /> : <DownloadOutlined />} Xuất Excel
                  </button>
                  <button className="qbl-btn-secondary" onClick={() => setIsImportModalOpen(true)}>
                    <UploadOutlined /> Nhập
                  </button>
                  <button className="qbl-btn-secondary" onClick={openBatchParaphraseModal} disabled={selectedApprovedQuestionIds.length === 0}>
                    <CopyOutlined /> Tạo biến thể
                  </button>
                  <button className="qbl-btn-add" onClick={() => navigate('/admin/evaluation/question-bank/new')}>
                    <PlusCircleOutlined /> Thêm câu hỏi
                  </button>
                </div>
              </div>

              {selectedQuestionIds.length > 0 && (
                <div className="qbl-batch-bar">
                  <span>{selectedApprovedQuestionIds.length} câu đã duyệt được chọn</span>
                  <button type="button" className="qbl-btn-secondary" onClick={() => setSelectedQuestionIds([])}>
                    Bỏ chọn
                  </button>
                </div>
              )}

              <div className="qbl-table-card">
                <table className="qbl-table">
                  <thead>
                    <tr>
                      <th style={{ width: '44px' }}>
                        <input
                          type="checkbox"
                          checked={displayRows.some((item) => item.backend && item.status === 'APPROVED') && displayRows.filter((item) => item.backend && item.status === 'APPROVED').every((item) => selectedQuestionIds.includes(item.id))}
                          onChange={togglePageSelection}
                        />
                      </th>
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
                        <td colSpan="8" className="qbl-empty-cell">Đang tải ngân hàng câu hỏi...</td>
                      </tr>
                    ) : displayRows.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="qbl-empty-cell">Không tìm thấy câu hỏi nào.</td>
                      </tr>
                    ) : (
                      displayRows.map((item, idx) => (
                        <tr key={`${item.backend ? 'api' : 'demo'}-${item.id}`}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedQuestionIds.includes(item.id)}
                              onChange={() => toggleQuestionSelection(item.id)}
                              disabled={!item.backend || item.status !== 'APPROVED'}
                            />
                          </td>
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
                              {item.statusText || (item.active ? 'Đã duyệt' : 'Bản nháp')}
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
                              {item.status !== 'ARCHIVED' && (
                                <button
                                  type="button"
                                  className="qbl-action-btn qbl-action-btn--view"
                                  onClick={() => handleStatusAction(item)}
                                  title={item.status === 'APPROVED' ? 'Chuyển về bản nháp' : 'Duyệt câu hỏi'}
                                >
                                  {item.status === 'APPROVED' ? <StopOutlined /> : <CheckCircleOutlined />}
                                </button>
                              )}
                              <button
                                type="button"
                                className="qbl-action-btn qbl-action-btn--delete"
                                onClick={() => handleDelete(item)}
                                title="Xóa"
                                disabled={item.status === 'ARCHIVED'}
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
                    {(() => {
                      const maxVisible = 5
                      const half = Math.floor(maxVisible / 2)
                      let start = Math.max(0, page - half)
                      const end = Math.min(totalPages, start + maxVisible)
                      if (end - start < maxVisible) start = Math.max(0, end - maxVisible)
                      const buttons = []
                      if (start > 0) {
                        buttons.push(<button key={0} className={`qbl-page-btn ${page === 0 ? 'qbl-page-btn--active' : ''}`} onClick={() => setPage(0)}>1</button>)
                        if (start > 1) buttons.push(<span key="se" className="qbl-page-ellipsis">&hellip;</span>)
                      }
                      for (let i = start; i < end; i++) {
                        buttons.push(<button key={i} className={`qbl-page-btn ${page === i ? 'qbl-page-btn--active' : ''}`} onClick={() => setPage(i)}>{i + 1}</button>)
                      }
                      if (end < totalPages) {
                        if (end < totalPages - 1) buttons.push(<span key="ee" className="qbl-page-ellipsis">&hellip;</span>)
                        buttons.push(<button key={totalPages - 1} className={`qbl-page-btn ${page === totalPages - 1 ? 'qbl-page-btn--active' : ''}`} onClick={() => setPage(totalPages - 1)}>{totalPages}</button>)
                      }
                      return buttons
                    })()}
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
            <h2 id="import-question-bank-title">Nhập ngân hàng câu hỏi</h2>
            <p className="qbl-modal-subtitle">File hỗ trợ XLSX/XLS/CSV với header hoặc DOCX theo mẫu cố định: Câu hỏi, A-D, Đáp án, Giải thích, Chủ đề, Độ khó, Nguồn, Trạng thái</p>

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
                <p className="qbl-modal-subtitle">Ánh xạ cột từ file nguồn. Chỉ cần chỉnh các cột chưa tự nhận đúng, rồi bấm Xem trước lại.</p>
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
                <span>Xem trước</span>
              </button>
              <button type="button" className="qbl-btn-primary" onClick={commitImport} disabled={isImporting || !importPreview || (importPreview.rows || []).every((row) => !row.valid)}>
                {isImporting ? <LoadingOutlined /> : <CheckCircleOutlined />}
                <span>Lưu dòng hợp lệ</span>
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

                {detailQuestion.impactWarning?.warning && (
                  <div className="qbl-impact-warning">
                    <strong>Cảnh báo sử dụng</strong>
                    <p>{detailQuestion.impactWarning.warning}</p>
                  </div>
                )}

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
