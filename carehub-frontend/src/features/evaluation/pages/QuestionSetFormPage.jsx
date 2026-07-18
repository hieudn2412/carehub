import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  CopyOutlined,
  EditOutlined,
  LoadingOutlined,
  LockOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { questionSetApi } from '../api/questionSetApi.js'
import { questionSetCategoryApi } from '../api/questionSetCategoryApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../utils/documentQuestionUi.js'
import '../styles/QuestionSetFormPage.css'

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Bản nháp' },
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Tạm ngưng' },
]

function QuestionSetFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { showToast } = useToast()
  const isEditMode = Boolean(id)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('DRAFT')
  const [description, setDescription] = useState('')
  const [questionCount, setQuestionCount] = useState(0)
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [snapshotInfo, setSnapshotInfo] = useState({
    activeVersion: null,
    snapshotAt: null,
    versions: [],
    activeSnapshotItems: [],
  })

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [categoriesResponse] = await Promise.all([
        questionSetCategoryApi.listCategories({ status: 'ACTIVE' }),
      ])
      setCategories(apiData(categoriesResponse, []))
      if (isEditMode) {
        const detailResponse = await questionSetApi.getQuestionSet(id)
        const detail = apiData(detailResponse)
        setName(detail.name || '')
        setCategory(detail.category || '')
        setStatus(detail.status === 'ARCHIVED' ? 'INACTIVE' : detail.status || 'DRAFT')
        setDescription(detail.description || '')
        setQuestionCount(detail.questionCount || 0)
        setSnapshotInfo({
          activeVersion: detail.activeVersion || null,
          snapshotAt: detail.snapshotAt || null,
          versions: detail.versions || [],
          activeSnapshotItems: detail.activeSnapshotItems || [],
        })
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [id, isEditMode, showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const topics = useMemo(() => {
    return categories.map((cat) => cat.name)
  }, [categories])

  const isActiveLocked = isEditMode && status === 'ACTIVE'

  async function handleSave(event) {
    event.preventDefault()
    if (isActiveLocked) {
      showToast('Bộ câu hỏi đang hoạt động đã được khóa snapshot. Hãy tạo bản nháp chỉnh sửa.', 'warning')
      return
    }
    if (!name.trim()) {
      showToast('Vui lòng nhập tên bộ câu hỏi.', 'warning')
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        name: name.trim(),
        category: category.trim() || null,
        status: isEditMode ? status : 'DRAFT',
        description: description.trim() || null,
      }
      let responseData
      if (isEditMode) {
        responseData = await questionSetApi.updateQuestionSet(id, payload)
        showToast('Cập nhật bộ câu hỏi thành công.', 'success')
        navigate('/admin/evaluation/question-sets')
      } else {
        responseData = await questionSetApi.createQuestionSet(payload)
        const created = apiData(responseData)
        showToast('Tạo bộ câu hỏi thành công.', 'success')
        if (created?.id) {
          navigate(`/admin/evaluation/question-sets/${created.id}/questions`)
        } else {
          navigate('/admin/evaluation/question-sets')
        }
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  async function createDraftCopy() {
    if (!id) return
    setIsSaving(true)
    try {
      const response = await questionSetApi.duplicateQuestionSet(id)
      const duplicated = apiData(response)
      showToast('Đã tạo bản nháp chỉnh sửa từ bộ đang hoạt động.', 'success')
      if (duplicated?.id) {
        navigate(`/admin/evaluation/question-sets/${duplicated.id}/edit`)
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const breadcrumbs = [
    { label: 'Bộ câu hỏi', path: '/admin/evaluation/question-sets' },
    { label: isEditMode ? 'Chỉnh sửa' : 'Tạo mới' },
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qsf-page">
              <div className="qsf-container">
                <div className="qsf-header">
                  <button type="button" className="qsf-btn-cancel" onClick={() => navigate('/admin/evaluation/question-sets')}>
                    <ArrowLeftOutlined /> Quay lại
                  </button>
                  <div>
                    <h2 className="qsf-title">{isEditMode ? 'Cập nhật bộ câu hỏi' : 'Tạo bộ câu hỏi'}</h2>
                    <p className="qsf-subtitle">Thiết lập thông tin cơ bản cho bộ câu hỏi</p>
                  </div>
                </div>

                {isLoading ? (
                  <section className="qsf-questions-card">Đang tải dữ liệu bộ câu hỏi...</section>
                ) : (
                  <form onSubmit={handleSave} className="qsf-form">
                    {isActiveLocked && (
                      <section className="qsf-lock-banner">
                        <LockOutlined />
                        <div>
                          <strong>Bộ câu hỏi đang hoạt động đã khóa snapshot</strong>
                          <p>Không sửa trực tiếp bản active. Tạo bản nháp chỉnh sửa để thay đổi câu hỏi, thứ tự hoặc metadata rồi kích hoạt thành version mới.</p>
                        </div>
                        <button type="button" className="qsf-btn-save" onClick={createDraftCopy} disabled={isSaving}>
                          {isSaving ? <LoadingOutlined /> : <CopyOutlined />}
                          Tạo bản nháp chỉnh sửa
                        </button>
                      </section>
                    )}
                    <div className="qsf-form-group">
                      <label>Tên bộ câu hỏi <span className="qsf-required-star">*</span></label>
                      <input
                        type="text"
                        className="qsf-input-green"
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Nhập tên bộ câu hỏi..."
                        disabled={isActiveLocked}
                      />
                    </div>

                    {isEditMode ? (
                      <div className="qsf-form-row">
                        <div className="qsf-form-group">
                          <label>Danh mục</label>
                          <input
                            className="qsf-input-green"
                            value={category}
                            onChange={(event) => setCategory(event.target.value)}
                            list="question-set-topics"
                            placeholder="Chọn hoặc nhập danh mục..."
                            disabled={isActiveLocked}
                          />
                          <datalist id="question-set-topics">
                            {topics.map((topic) => <option key={topic} value={topic} />)}
                          </datalist>
                        </div>
                        <div className="qsf-form-group">
                          <label>Trạng thái</label>
                          <select className="qsf-input-red" value={status} onChange={(event) => setStatus(event.target.value)} disabled={isActiveLocked}>
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="qsf-form-group">
                        <label>Danh mục</label>
                        <input
                          className="qsf-input-green"
                          value={category}
                          onChange={(event) => setCategory(event.target.value)}
                          list="question-set-topics"
                          placeholder="Chọn hoặc nhập danh mục..."
                        />
                        <datalist id="question-set-topics">
                          {topics.map((topic) => <option key={topic} value={topic} />)}
                        </datalist>
                      </div>
                    )}

                    <div className="qsf-form-group">
                      <label>Mô tả</label>
                      <textarea
                        className="qsf-input-green"
                        rows={3}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Mô tả tóm tắt về bộ câu hỏi này..."
                        disabled={isActiveLocked}
                      />
                    </div>

                    {isEditMode && (
                      <div className="qsf-form-row">
                        <div className="qsf-form-group">
                          <label>Số câu hỏi</label>
                          <div className="qsf-count-badge">{questionCount > 0 ? `${questionCount} câu hỏi` : 'Chưa có câu hỏi'}</div>
                        </div>
                        <div className="qsf-form-group" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="qsf-btn-save"
                            onClick={() => navigate(`/admin/evaluation/question-sets/${id}/questions`)}
                            disabled={isActiveLocked}
                          >
                            <EditOutlined /> Chọn câu hỏi
                          </button>
                        </div>
                      </div>
                    )}

                    {isEditMode && (
                      <div className="qsf-version-card">
                        <div className="qsf-version-head">
                          <div>
                            <strong>Phiên bản đang hoạt động</strong>
                            <span>
                              {snapshotInfo.activeVersion
                                ? `Version ${snapshotInfo.activeVersion} · ${formatDateTime(snapshotInfo.snapshotAt)}`
                                : 'Chưa có snapshot active'}
                            </span>
                          </div>
                          <span>{snapshotInfo.versions.length} phiên bản</span>
                        </div>

                        {snapshotInfo.versions.length > 0 && (
                          <div className="qsf-version-list">
                            {snapshotInfo.versions.slice(0, 4).map((version) => (
                              <div className="qsf-version-pill" key={version.id || version.version}>
                                <strong>v{version.version}</strong>
                                <span>{version.questionCount} câu · {formatDateTime(version.snapshotAt)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {snapshotInfo.activeSnapshotItems.length > 0 && (
                          <div className="qsf-snapshot-preview">
                            {snapshotInfo.activeSnapshotItems.slice(0, 5).map((item) => (
                              <div className="qsf-snapshot-row" key={item.id || `${item.position}-${item.sourceQuestionId}`}>
                                <span>{item.position}</span>
                                <p>{item.stem}</p>
                                <strong>{item.correctAnswer}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="qsf-form-actions">
                      <button type="submit" className="qsf-btn-save" disabled={isSaving || isActiveLocked}>
                        {isSaving ? <LoadingOutlined /> : <SaveOutlined />}
                        {isActiveLocked ? 'Đã khóa snapshot' : 'Lưu bộ câu hỏi'}
                      </button>
                      <button type="button" className="qsf-btn-cancel" onClick={() => navigate('/admin/evaluation/question-sets')} disabled={isSaving}>
                        Hủy
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default QuestionSetFormPage
