import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  PrinterOutlined,
  SearchOutlined,
  StopOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { questionSetApi } from '../api/questionSetApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/QuestionSetListPage.css'

const DEFAULT_CATEGORIES = ['Kiểm soát nhiễm khuẩn', 'An toàn sử dụng thuốc', 'An toàn người bệnh', 'Quy trình lâm sàng']

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Bản nháp' },
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Tạm ngưng' },
  { value: 'ARCHIVED', label: 'Đã lưu trữ' },
]

const EXPORT_MIME_TYPES = {
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
}

function QuestionSetListPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [sets, setSets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionId, setActionId] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)

  const loadSets = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await questionSetApi.listQuestionSets({
        q: keyword || undefined,
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
      })
      setSets(apiData(response, []))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [categoryFilter, keyword, showToast, statusFilter])

  useEffect(() => {
    loadSets()
  }, [loadSets])

  const categories = useMemo(() => {
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...sets.map((item) => item.category).filter(Boolean)]))
  }, [sets])

  const pageSize = 10
  const totalElements = sets.length
  const totalPages = Math.ceil(totalElements / pageSize) || 1
  const displayRows = sets.slice(page * pageSize, (page + 1) * pageSize)

  async function archiveSet(item) {
    if (!window.confirm(`Bạn có chắc chắn muốn lưu trữ bộ câu hỏi "${item.name}" không?`)) {
      return
    }
    await runAction(item.id, async () => {
      await questionSetApi.archiveQuestionSet(item.id)
      showToast('Đã lưu trữ bộ câu hỏi.', 'success')
      await loadSets()
    })
  }

  async function activateSet(item) {
    await runAction(item.id, async () => {
      await questionSetApi.activateQuestionSet(item.id)
      showToast('Đã kích hoạt bộ câu hỏi.', 'success')
      await loadSets()
    })
  }

  async function deactivateSet(item) {
    await runAction(item.id, async () => {
      await questionSetApi.deactivateQuestionSet(item.id)
      showToast('Đã tạm ngưng bộ câu hỏi.', 'success')
      await loadSets()
    })
  }

  async function duplicateSet(item) {
    await runAction(item.id, async () => {
      const response = await questionSetApi.duplicateQuestionSet(item.id)
      const duplicated = apiData(response)
      showToast('Đã nhân bản bộ câu hỏi.', 'success')
      await loadSets()
      if (duplicated?.id && window.confirm('Mở bản sao để chỉnh sửa ngay?')) {
        navigate(`/admin/evaluation/question-sets/${duplicated.id}/edit`)
      }
    })
  }

  async function exportSet(item, format) {
    await runAction(item.id, async () => {
      const response = await questionSetApi.exportQuestionSet(item.id, format)
      downloadFile(`${safeFilename(item.name)}.${format}`, response.data, EXPORT_MIME_TYPES[format] || EXPORT_MIME_TYPES.csv)
      showToast(`Đã export bộ câu hỏi ${format.toUpperCase()}.`, 'success')
    })
  }

  async function printSet(item) {
    await runAction(item.id, async () => {
      const response = await questionSetApi.getQuestionSet(item.id)
      printQuestionSet(apiData(response))
    })
  }

  async function runAction(id, callback) {
    setActionId(id)
    try {
      await callback()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setActionId(null)
    }
  }

  const breadcrumbs = [{ label: 'Bộ câu hỏi' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qsl-page">
              <div className="qsl-title-card">
                <h1 className="qsl-title">Bộ câu hỏi</h1>
                <p className="qsl-subtitle">Quản lý các nhóm ngân hàng câu hỏi theo chủ đề và độ khó</p>
              </div>

              <div className="qsl-filter-bar">
                <div className="qsl-filter-left">
                  <div className="qsl-search">
                    <span className="qsl-search-icon">
                      <SearchOutlined />
                    </span>
                    <input
                      type="text"
                      className="qsl-search-input"
                      placeholder="Tìm bộ câu hỏi..."
                      value={keyword}
                      onChange={(event) => {
                        setKeyword(event.target.value)
                        setPage(0)
                      }}
                    />
                  </div>

                  <select
                    className="qsl-filter-select"
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
                    className="qsl-filter-select"
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value)
                      setPage(0)
                    }}
                  >
                    <option value="">Trạng thái</option>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button className="qsl-btn-add" onClick={() => navigate('/admin/evaluation/question-sets/new')}>
                  <PlusCircleOutlined /> Tạo bộ câu hỏi
                </button>
              </div>

              <div className="qsl-table-card">
                <table className="qsl-table">
                  <thead>
                    <tr>
                      <th>Tên bộ câu hỏi</th>
                      <th>Danh mục</th>
                      <th>Số câu hỏi</th>
                      <th>Độ khó</th>
                      <th>Trạng thái</th>
                      <th style={{ width: '330px', textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>
                          <LoadingOutlined /> Đang tải bộ câu hỏi...
                        </td>
                      </tr>
                    ) : displayRows.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                          Không tìm thấy bộ câu hỏi nào.
                        </td>
                      </tr>
                    ) : (
                      displayRows.map((item) => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                          <td style={{ color: '#475569' }}>{item.category || '---'}</td>
                          <td style={{ fontWeight: 600, color: '#334155' }}>{item.questionCount || 0}</td>
                          <td>
                            <span className={`diff-badge ${getDifficultyClass(item.difficulty)}`}>
                              {difficultyText(item.difficulty)}
                            </span>
                          </td>
                          <td>
                            <span className={`qsl-badge ${getStatusClass(item.status)}`}>
                              {item.statusText || statusText(item.status)}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="qsl-action-btn qsl-action-btn--edit"
                                onClick={() => navigate(`/admin/evaluation/question-sets/${item.id}/edit`)}
                                title="Chỉnh sửa"
                              >
                                <EditOutlined />
                              </button>
                              <button
                                type="button"
                                className="qsl-action-btn qsl-action-btn--questions"
                                onClick={() => navigate(`/admin/evaluation/question-sets/${item.id}/questions`)}
                                title="Chọn câu hỏi"
                              >
                                <UnorderedListOutlined />
                              </button>
                              <button
                                type="button"
                                className="qsl-action-btn"
                                onClick={() => duplicateSet(item)}
                                title="Nhân bản"
                                disabled={actionId === item.id || item.status === 'ARCHIVED'}
                              >
                                <CopyOutlined />
                              </button>
                              <button
                                type="button"
                                className="qsl-action-btn"
                                onClick={() => exportSet(item, 'xlsx')}
                                title="Xuất XLSX"
                                disabled={actionId === item.id}
                              >
                                <DownloadOutlined />
                              </button>
                              <button
                                type="button"
                                className="qsl-action-btn"
                                onClick={() => exportSet(item, 'csv')}
                                title="Xuất CSV"
                                disabled={actionId === item.id}
                              >
                                <FileTextOutlined />
                              </button>
                              <button
                                type="button"
                                className="qsl-action-btn"
                                onClick={() => exportSet(item, 'docx')}
                                title="Xuất DOCX"
                                disabled={actionId === item.id}
                              >
                                <FileTextOutlined />
                              </button>
                              <button
                                type="button"
                                className="qsl-action-btn"
                                onClick={() => exportSet(item, 'pdf')}
                                title="Xuất PDF"
                                disabled={actionId === item.id}
                              >
                                <DownloadOutlined />
                              </button>
                              <button
                                type="button"
                                className="qsl-action-btn"
                                onClick={() => printSet(item)}
                                title="In bộ câu hỏi"
                                disabled={actionId === item.id}
                              >
                                <PrinterOutlined />
                              </button>
                              {item.status === 'ACTIVE' ? (
                                <button
                                  type="button"
                                  className="qsl-action-btn"
                                  onClick={() => deactivateSet(item)}
                                  title="Tạm ngưng"
                                  disabled={actionId === item.id}
                                >
                                  {actionId === item.id ? <LoadingOutlined /> : <StopOutlined />}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="qsl-action-btn"
                                  onClick={() => activateSet(item)}
                                  title="Kích hoạt"
                                  disabled={actionId === item.id || item.status === 'ARCHIVED'}
                                >
                                  {actionId === item.id ? <LoadingOutlined /> : <CheckCircleOutlined />}
                                </button>
                              )}
                              <button
                                type="button"
                                className="qsl-action-btn qsl-action-btn--delete"
                                onClick={() => archiveSet(item)}
                                title="Lưu trữ"
                                disabled={actionId === item.id || item.status === 'ARCHIVED'}
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

                <div className="qsl-pagination-bar">
                  <div className="qsl-pagination-info">Hiển thị {displayRows.length} trong tổng số {totalElements} kết quả</div>
                  <div className="qsl-pagination-buttons">
                    <button className="qsl-page-btn" disabled={page <= 0} onClick={() => setPage(page - 1)}>
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
                        buttons.push(<button key={0} className={`qsl-page-btn ${page === 0 ? 'qsl-page-btn--active' : ''}`} onClick={() => setPage(0)}>1</button>)
                        if (start > 1) buttons.push(<span key="se" className="qsl-page-btn qsl-page-btn--dots">&hellip;</span>)
                      }
                      for (let i = start; i < end; i++) {
                        buttons.push(<button key={i} className={`qsl-page-btn ${page === i ? 'qsl-page-btn--active' : ''}`} onClick={() => setPage(i)}>{i + 1}</button>)
                      }
                      if (end < totalPages) {
                        if (end < totalPages - 1) buttons.push(<span key="ee" className="qsl-page-btn qsl-page-btn--dots">&hellip;</span>)
                        buttons.push(<button key={totalPages - 1} className={`qsl-page-btn ${page === totalPages - 1 ? 'qsl-page-btn--active' : ''}`} onClick={() => setPage(totalPages - 1)}>{totalPages}</button>)
                      }
                      return buttons
                    })()}
                    <button className="qsl-page-btn" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
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
  )
}

function getDifficultyClass(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'easy' || value === 'Dễ') return 'diff-badge--easy'
  if (normalized === 'medium' || value === 'Trung bình') return 'diff-badge--medium'
  return 'diff-badge--hard'
}

function difficultyText(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'easy') return 'Dễ'
  if (normalized === 'medium') return 'Trung bình'
  if (normalized === 'hard') return 'Khó'
  return value || '---'
}

function getStatusClass(status) {
  if (status === 'ACTIVE') return 'qsl-badge--active'
  if (status === 'ARCHIVED') return 'qsl-badge--inactive'
  return 'qsl-badge--inactive'
}

function statusText(status) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label || 'Không xác định'
}

function downloadFile(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function safeFilename(value) {
  return String(value || 'bo-cau-hoi')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .slice(0, 80)
}

function printQuestionSet(detail) {
  const rows = (detail.items || []).map((item) => {
    const question = item.question || {}
    return `
      <section class="question">
        <h2>Câu ${item.position}. ${escapeHtml(question.stem)}</h2>
        <ol type="A">
          <li>${escapeHtml(question.optionA)}</li>
          <li>${escapeHtml(question.optionB)}</li>
          <li>${escapeHtml(question.optionC)}</li>
          <li>${escapeHtml(question.optionD)}</li>
        </ol>
        <p><strong>Đáp án:</strong> ${escapeHtml(question.correctAnswer)}</p>
        ${question.explanation ? `<p><strong>Giải thích:</strong> ${escapeHtml(question.explanation)}</p>` : ''}
      </section>
    `
  }).join('')
  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  printWindow.document.write(`
    <html>
      <head>
        <title>${escapeHtml(detail.name)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; padding: 24px; line-height: 1.5; }
          h1 { font-size: 24px; margin: 0 0 8px; }
          .meta { color: #475569; margin-bottom: 24px; }
          .question { break-inside: avoid; border-top: 1px solid #e5e7eb; padding-top: 14px; margin-top: 14px; }
          .question h2 { font-size: 16px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(detail.name)}</h1>
        <div class="meta">${escapeHtml(detail.category || '')} ${escapeHtml(detail.difficulty || '')} - ${detail.questionCount || 0} câu hỏi</div>
        ${rows}
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export default QuestionSetListPage
