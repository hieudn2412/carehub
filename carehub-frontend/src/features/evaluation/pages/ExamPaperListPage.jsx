import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CopyOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined, PlusCircleOutlined, ReloadOutlined, SearchOutlined, SendOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examPaperApi } from '../api/examPaperApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../utils/documentQuestionUi.js'
import '../styles/ExamPaperPages.css'

const EXPORT_FORMATS = ['txt', 'pdf', 'docx', 'xlsx']
const EXPORT_MIME_TYPES = {
  txt: 'text/plain;charset=utf-8',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function ExamPaperListPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [papers, setPapers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [exportFormat, setExportFormat] = useState('docx')

  const loadPapers = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await examPaperApi.listExamPapers({})
      setPapers(apiData(response, []))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadPapers()
  }, [loadPapers])

  const filteredPapers = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return papers.filter((paper) => {
      const matchesKeyword = !normalized
        || (paper.name || '').toLowerCase().includes(normalized)
        || (paper.code || '').toLowerCase().includes(normalized)
        || (paper.examConfigName || '').toLowerCase().includes(normalized)
        || (paper.questionSetName || '').toLowerCase().includes(normalized)
      const matchesStatus = !status || paper.status === status
      return matchesKeyword && matchesStatus
    })
  }, [keyword, papers, status])

  async function publishPaper(paper) {
    try {
      await examPaperApi.publishExamPaper(paper.id)
      showToast('Đã phát hành bộ đề kiểm tra.', 'success')
      loadPapers()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  async function archivePaper(paper) {
    if (!window.confirm(`Lưu trữ bộ đề "${paper.name}"?`)) return
    try {
      await examPaperApi.archiveExamPaper(paper.id)
      showToast('Đã lưu trữ bộ đề kiểm tra.', 'success')
      loadPapers()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  async function duplicatePaper(paper) {
    try {
      const response = await examPaperApi.duplicateExamPaper(paper.id)
      const duplicated = apiData(response)
      showToast('Đã nhân bản bộ đề kiểm tra.', 'success')
      await loadPapers()
      if (duplicated?.id && window.confirm('Mở bản sao để xem ngay?')) {
        navigate(`/admin/evaluation/exam-papers/${duplicated.id}`)
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  async function exportPaper(paper, includeAnswers = false) {
    try {
      const response = await examPaperApi.exportExamPaper(paper.id, includeAnswers, exportFormat)
      const filename = includeAnswers
        ? `dap-an-${paper.code || paper.id}.${exportFormat}`
        : `${paper.code || paper.id}.${exportFormat}`
      downloadBlob(filename, response.data, EXPORT_MIME_TYPES[exportFormat] || EXPORT_MIME_TYPES.txt)
      showToast(includeAnswers ? `Đã tải đáp án bộ đề ${exportFormat.toUpperCase()}.` : `Đã tải bộ đề ${exportFormat.toUpperCase()}.`, 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  const breadcrumbs = [{ label: 'Bộ đề kiểm tra' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="exp-page">
              <div className="exp-title-card">
                <div>
                  <h1 className="exp-title">Bộ đề kiểm tra</h1>
                  <p className="exp-subtitle">Sinh, phát hành và quản lý đề kiểm tra cố định từ cấu hình và bộ câu hỏi</p>
                </div>
                <div className="exp-title-actions">
                  <button type="button" className="exp-btn-secondary" onClick={loadPapers} disabled={isLoading}>
                    <ReloadOutlined /> Tải lại
                  </button>
                  <button type="button" className="exp-btn-primary" onClick={() => navigate('/admin/evaluation/exam-papers/new')}>
                    <PlusCircleOutlined /> Sinh bộ đề
                  </button>
                </div>
              </div>

              <div className="exp-filter-bar">
                <div className="exp-search">
                  <SearchOutlined />
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm mã đề, tên đề, cấu hình..." />
                </div>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">Trạng thái</option>
                  <option value="DRAFT">Bản nháp</option>
                  <option value="PUBLISHED">Đã phát hành</option>
                  <option value="ARCHIVED">Đã lưu trữ</option>
                </select>
                <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value)} title="Định dạng export">
                  {EXPORT_FORMATS.map((format) => (
                    <option key={format} value={format}>{format.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="exp-table-card">
                <table className="exp-table">
                  <thead>
                    <tr>
                      <th>Mã đề</th>
                      <th>Tên đề</th>
                      <th>Cấu hình</th>
                      <th>Số câu</th>
                      <th>Trạng thái</th>
                      <th>Ngày tạo</th>
                      <th style={{ width: 150, textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="7" className="exp-empty">Đang tải bộ đề kiểm tra...</td></tr>
                    ) : filteredPapers.length === 0 ? (
                      <tr><td colSpan="7" className="exp-empty">Chưa có bộ đề kiểm tra.</td></tr>
                    ) : filteredPapers.map((paper) => (
                      <tr key={paper.id}>
                        <td><strong>{paper.code}</strong></td>
                        <td>{paper.name}</td>
                        <td>{paper.examConfigName}</td>
                        <td>{paper.totalQuestions}</td>
                        <td><span className={`exp-badge exp-badge--${paper.status?.toLowerCase()}`}>{paper.statusText || paper.status}</span></td>
                        <td>{formatDateTime(paper.createdAt)}</td>
                        <td>
                          <div className="exp-actions">
                            <button type="button" onClick={() => navigate(`/admin/evaluation/exam-papers/${paper.id}`)} title="Xem chi tiết"><EyeOutlined /></button>
                            <button type="button" onClick={() => duplicatePaper(paper)} disabled={paper.status === 'ARCHIVED'} title="Nhân bản"><CopyOutlined /></button>
                            <button type="button" onClick={() => exportPaper(paper, false)} title="Tải đề"><DownloadOutlined /></button>
                            <button type="button" onClick={() => exportPaper(paper, true)} title="Tải đáp án"><DownloadOutlined /></button>
                            {paper.status === 'DRAFT' && <button type="button" onClick={() => publishPaper(paper)} title="Phát hành"><SendOutlined /></button>}
                            <button type="button" onClick={() => archivePaper(paper)} disabled={paper.status === 'ARCHIVED'} title="Lưu trữ"><DeleteOutlined /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function downloadBlob(filename, content, type) {
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

export default ExamPaperListPage
