import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  PrinterOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { questionSetApi } from '../api/questionSetApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/QuestionSetListPage.css'

const DEFAULT_CATEGORIES = ['Kiểm soát nhiễm khuẩn', 'An toàn sử dụng thuốc', 'An toàn người bệnh', 'Quy trình lâm sàng']

const EXPORT_MIME_TYPES = {
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
}

const EXPORT_ACTIONS = [
  { key: 'xlsx', label: 'Excel', icon: <FileExcelOutlined /> },
  { key: 'csv', label: 'CSV', icon: <FileTextOutlined /> },
  { key: 'docx', label: 'Word', icon: <FileWordOutlined /> },
  { key: 'pdf', label: 'PDF', icon: <FilePdfOutlined /> },
  { key: 'print', label: 'In', icon: <PrinterOutlined /> },
]

function QuestionSetListPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [sets, setSets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionId, setActionId] = useState(null)
  const [exportMenuId, setExportMenuId] = useState(null)
  const [keyword, setKeyword] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(0)

  const loadSets = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await questionSetApi.listQuestionSets({
        q: keyword || undefined,
        category: categoryFilter || undefined,
      })
      setSets(apiData(response, []).filter((item) => item.status !== 'ARCHIVED'))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [categoryFilter, keyword, showToast])

  useEffect(() => {
    // Hydrate the list from the API when its server-side filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSets()
  }, [loadSets])

  useEffect(() => {
    if (exportMenuId === null) return undefined

    const closeMenu = () => setExportMenuId(null)
    const closeMenuOnEscape = (event) => {
      if (event.key === 'Escape') closeMenu()
    }

    document.addEventListener('click', closeMenu)
    document.addEventListener('keydown', closeMenuOnEscape)

    return () => {
      document.removeEventListener('click', closeMenu)
      document.removeEventListener('keydown', closeMenuOnEscape)
    }
  }, [exportMenuId])

  const categories = useMemo(() => {
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...sets.map((item) => item.category).filter(Boolean)]))
  }, [sets])

  const pageSize = 10
  const totalElements = sets.length
  const totalPages = Math.ceil(totalElements / pageSize) || 1
  const displayRows = sets.slice(page * pageSize, (page + 1) * pageSize)

  async function archiveSet(item) {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bộ câu hỏi "${item.name}" không?`)) {
      return
    }
    await runAction(item.id, async () => {
      await questionSetApi.archiveQuestionSet(item.id)
      showToast('Đã xóa bộ câu hỏi.', 'success')
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
                      <th style={{ width: '230px', textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>
                          <LoadingOutlined /> Đang tải bộ câu hỏi...
                        </td>
                      </tr>
                    ) : displayRows.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
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
                            <div className="qsl-actions">
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
                                className="qsl-action-btn"
                                onClick={() => duplicateSet(item)}
                                title="Nhân bản"
                                disabled={actionId === item.id}
                              >
                                <CopyOutlined />
                              </button>
                              <div
                                className={`qsl-export-radial${exportMenuId === item.id ? ' qsl-export-radial--open' : ''}`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="qsl-action-btn qsl-action-btn--export"
                                  onClick={() => setExportMenuId((currentId) => currentId === item.id ? null : item.id)}
                                  title="Chọn định dạng xuất"
                                  aria-label="Chọn định dạng xuất"
                                  aria-haspopup="menu"
                                  aria-expanded={exportMenuId === item.id}
                                  disabled={actionId === item.id}
                                >
                                  {actionId === item.id ? <LoadingOutlined /> : <ExportOutlined />}
                                </button>

                                <div className="qsl-export-radial__menu" role="menu" aria-label={`Xuất ${item.name}`}>
                                  {EXPORT_ACTIONS.map((exportAction) => (
                                    <button
                                      key={exportAction.key}
                                      type="button"
                                      className={`qsl-export-radial__item qsl-export-radial__item--${exportAction.key}`}
                                      onClick={() => {
                                        setExportMenuId(null)
                                        if (exportAction.key === 'print') {
                                          printSet(item)
                                        } else {
                                          exportSet(item, exportAction.key)
                                        }
                                      }}
                                      role="menuitem"
                                      tabIndex={exportMenuId === item.id ? 0 : -1}
                                    >
                                      <span aria-hidden="true">{exportAction.icon}</span>
                                      <span>{exportAction.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="qsl-action-btn qsl-action-btn--delete"
                                onClick={() => archiveSet(item)}
                                title="Xóa"
                                disabled={actionId === item.id}
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
                    {Array.from({ length: totalPages }).map((_, index) => (
                      <button
                        key={index}
                        className={`qsl-page-btn ${page === index ? 'qsl-page-btn--active' : ''}`}
                        onClick={() => setPage(index)}
                      >
                        {index + 1}
                      </button>
                    ))}
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
