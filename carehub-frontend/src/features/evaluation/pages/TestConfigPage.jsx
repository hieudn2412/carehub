import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { EditOutlined, DeleteOutlined, PlusCircleOutlined, CloseOutlined, WarningOutlined } from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examConfigApi } from '../api/examConfigApi.js'
import { questionCategoryApi } from '../api/questionCategoryApi.js'
import { questionSetApi } from '../api/questionSetApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/TestConfigPage.css'

const DEFAULT_FORM = {
  name: 'Cấu hình kiểm tra mặc định',
  description: '',
  status: 'DRAFT',
  totalQuestions: 30,
  timeLimitMinutes: 45,
  passingScore: 70,
  maxRetakes: 3,
  shuffleQuestions: true,
  shuffleOptions: true,
  selectionStrategy: 'RANDOM',
  questionSetId: '',
  distributions: [],
}

function TestConfigPage() {
  const { showToast } = useToast()
  const [configs, setConfigs] = useState([])
  const [selectedConfigId, setSelectedConfigId] = useState('')
  const [form, setForm] = useState(DEFAULT_FORM)
  const [activeQuestionSets, setActiveQuestionSets] = useState([])
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [preview, setPreview] = useState(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('add')
  const [modalIndex, setModalIndex] = useState(null)
  const [modalCategoryId, setModalCategoryId] = useState('')
  const [modalQuestions, setModalQuestions] = useState(5)

  const hydrateForm = useCallback((config) => {
    if (!config) {
      setForm(DEFAULT_FORM)
      setSelectedConfigId('')
      setPreview(null)
      return
    }
    setSelectedConfigId(String(config.id))
    setForm({
      name: config.name || DEFAULT_FORM.name,
      description: config.description || '',
      status: config.status || 'DRAFT',
      totalQuestions: config.totalQuestions || 30,
      timeLimitMinutes: config.timeLimitMinutes || 45,
      passingScore: config.passingScore || 70,
      maxRetakes: config.maxRetakes ?? 3,
      shuffleQuestions: config.shuffleQuestions !== false,
      shuffleOptions: config.shuffleOptions !== false,
      selectionStrategy: config.selectionStrategy || 'RANDOM',
      questionSetId: config.questionSetId ? String(config.questionSetId) : '',
      distributions: (config.distributions || []).map((item, index) => ({
        id: item.id || `${item.categoryId || 'all'}-${index}`,
        categoryId: item.categoryId ? String(item.categoryId) : '',
        categoryName: item.categoryName || 'Tất cả danh mục',
        questions: item.questionCount || 0,
        availableQuestionCount: item.availableQuestionCount,
        shortage: item.shortage,
      })),
    })
    setPreview({ warnings: config.warnings || [] })
  }, [])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [configsResponse, setsResponse, categoriesResponse] = await Promise.all([
        examConfigApi.listExamConfigs({}),
        questionSetApi.listQuestionSets({ status: 'ACTIVE' }),
        questionCategoryApi.listCategories({ status: 'ACTIVE' }),
      ])
      const nextConfigs = apiData(configsResponse, [])
      setConfigs(nextConfigs)
      setActiveQuestionSets(apiData(setsResponse, []))
      setCategories(apiData(categoriesResponse, []))
      hydrateForm(nextConfigs[0])
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [hydrateForm, showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const selectedQuestionSet = useMemo(
    () => activeQuestionSets.find((item) => String(item.id) === String(form.questionSetId)),
    [activeQuestionSets, form.questionSetId],
  )

  const totalDistributionQuestions = form.distributions.reduce((sum, item) => sum + Number(item.questions || 0), 0)
  const isSumMismatch = totalDistributionQuestions !== Number(form.totalQuestions)

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setPreview(null)
  }

  function buildPayload(nextStatus = form.status) {
    return {
      name: form.name.trim(),
      description: form.description.trim(),
      questionSetId: form.questionSetId ? Number(form.questionSetId) : null,
      totalQuestions: Number(form.totalQuestions),
      timeLimitMinutes: Number(form.timeLimitMinutes),
      passingScore: Number(form.passingScore),
      maxRetakes: Number(form.maxRetakes),
      shuffleQuestions: form.shuffleQuestions,
      shuffleOptions: form.shuffleOptions,
      selectionStrategy: form.selectionStrategy,
      status: nextStatus,
      distributions: form.distributions.map((item) => ({
        categoryId: item.categoryId ? Number(item.categoryId) : null,
        categoryName: item.categoryName,
        questionCount: Number(item.questions),
        required: true,
      })),
    }
  }

  async function handleSaveConfig(event) {
    event.preventDefault()
    if (!form.name.trim()) {
      showToast('Vui lòng nhập tên cấu hình.', 'warning')
      return
    }
    setIsSaving(true)
    try {
      const payload = buildPayload()
      const response = selectedConfigId
        ? await examConfigApi.updateExamConfig(selectedConfigId, payload)
        : await examConfigApi.createExamConfig(payload)
      const saved = apiData(response)
      showToast('Đã lưu cấu hình đề kiểm tra.', 'success')
      await loadData()
      hydrateForm(saved)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePreviewConfig() {
    try {
      const response = await examConfigApi.previewExamConfig(buildPayload('DRAFT'))
      setPreview(apiData(response))
      showToast('Đã kiểm tra cấu hình.', 'success')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }

  function handleResetDefault() {
    if (window.confirm('Thiết lập lại form về mặc định? Dữ liệu backend chỉ thay đổi sau khi bấm Lưu.')) {
      hydrateForm(null)
    }
  }

  function handleNewConfig() {
    hydrateForm(null)
  }

  function handleConfigSelect(configId) {
    const config = configs.find((item) => String(item.id) === String(configId))
    hydrateForm(config)
  }

  function handleOpenAddModal() {
    setModalMode('add')
    const existingCategoryIds = form.distributions.map((item) => String(item.categoryId))
    const availableCategory = categories.find((category) => !existingCategoryIds.includes(String(category.id))) || categories[0]
    setModalCategoryId(availableCategory ? String(availableCategory.id) : '')
    setModalQuestions(5)
    setIsModalOpen(true)
  }

  function handleOpenEditModal(item, index) {
    setModalMode('edit')
    setModalIndex(index)
    setModalCategoryId(String(item.categoryId || ''))
    setModalQuestions(item.questions)
    setIsModalOpen(true)
  }

  function handleCloseModal() {
    setIsModalOpen(false)
    setModalIndex(null)
  }

  function handleModalSubmit(event) {
    event.preventDefault()
    if (!modalCategoryId) {
      showToast('Vui lòng chọn danh mục câu hỏi.', 'warning')
      return
    }
    if (!modalQuestions || Number(modalQuestions) <= 0) {
      showToast('Số lượng câu hỏi phải lớn hơn 0.', 'warning')
      return
    }
    const category = categories.find((item) => String(item.id) === String(modalCategoryId))
    const nextDistribution = {
      id: modalMode === 'edit' ? form.distributions[modalIndex]?.id : `${modalCategoryId}-${Date.now()}`,
      categoryId: modalCategoryId,
      categoryName: category?.name || 'Chưa phân loại',
      questions: Number(modalQuestions),
    }
    if (modalMode === 'add') {
      if (form.distributions.some((item) => String(item.categoryId) === String(modalCategoryId))) {
        showToast('Danh mục này đã có phân bổ.', 'warning')
        return
      }
      updateForm('distributions', [...form.distributions, nextDistribution])
    } else {
      updateForm('distributions', form.distributions.map((item, index) => (index === modalIndex ? nextDistribution : item)))
    }
    handleCloseModal()
  }

  function handleDeleteRule(index) {
    if (window.confirm('Xóa phân bổ danh mục này khỏi cấu hình?')) {
      updateForm('distributions', form.distributions.filter((_, itemIndex) => itemIndex !== index))
    }
  }

  const warnings = preview?.warnings || []
  const breadcrumbs = [{ label: 'Cấu hình đề kiểm tra' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="tcf-page">
              <div className="tcf-title-card">
                <h1 className="tcf-title">Cấu hình đề kiểm tra</h1>
                <p className="tcf-subtitle">Thiết lập nguồn câu hỏi, thời gian, điểm đạt và phân bổ câu hỏi cho đề kiểm tra</p>
              </div>

              <form onSubmit={handleSaveConfig} className="tcf-form">
                <div className="tcf-container">
                  <div className="tcf-section-header">
                    <span className="tcf-section-title">CẤU HÌNH ĐỀ KIỂM TRA</span>
                  </div>

                  <div className="tcf-fields-box">
                    <div className="tcf-field-row">
                      <div className="tcf-field-left">
                        <span className="tcf-field-label">Cấu hình đang chỉnh</span>
                        <span className="tcf-field-subtext">Chọn cấu hình đã lưu hoặc tạo cấu hình mới</span>
                      </div>
                      <div className="tcf-inline-controls">
                        <select className="tcf-field-select" value={selectedConfigId} onChange={(event) => handleConfigSelect(event.target.value)} disabled={isLoading}>
                          <option value="">Tạo cấu hình mới</option>
                          {configs.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} - {item.statusText || item.status}
                            </option>
                          ))}
                        </select>
                        <button type="button" className="tcf-btn-inline" onClick={handleNewConfig}>Mới</button>
                      </div>
                    </div>

                    <div className="tcf-field-row">
                      <div className="tcf-field-left">
                        <span className="tcf-field-label">Tên cấu hình</span>
                      </div>
                      <input className="tcf-field-text" value={form.name} onChange={(event) => updateForm('name', event.target.value)} required />
                    </div>

                    <div className="tcf-field-row">
                      <div className="tcf-field-left">
                        <span className="tcf-field-label">Trạng thái</span>
                        <span className="tcf-field-subtext">Kích hoạt sẽ kiểm tra đủ câu theo phân bổ</span>
                      </div>
                      <select className="tcf-field-select" value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                        <option value="DRAFT">Bản nháp</option>
                        <option value="ACTIVE">Đang hoạt động</option>
                        <option value="INACTIVE">Tạm ngưng</option>
                      </select>
                    </div>

                    <div className="tcf-field-row">
                      <div className="tcf-field-left">
                        <span className="tcf-field-label">Bộ câu hỏi sử dụng</span>
                        <span className="tcf-field-subtext">Chỉ hiển thị bộ câu hỏi đang hoạt động</span>
                      </div>
                      <select
                        className="tcf-field-select"
                        value={form.questionSetId}
                        onChange={(event) => {
                          const nextId = event.target.value
                          updateForm('questionSetId', nextId)
                          const nextSet = activeQuestionSets.find((item) => String(item.id) === String(nextId))
                          if (nextSet?.questionCount) {
                            updateForm('totalQuestions', nextSet.questionCount)
                          }
                        }}
                      >
                        <option value="">Chưa chọn</option>
                        {activeQuestionSets.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </div>

                    {selectedQuestionSet && (
                      <div className="tcf-selected-set">
                        <strong>{selectedQuestionSet.name}</strong>
                        <span>{selectedQuestionSet.questionCount || 0} câu hỏi</span>
                        <span>{selectedQuestionSet.difficulty || 'Chưa phân loại'}</span>
                        <span>{selectedQuestionSet.statusText || 'Hoạt động'}</span>
                      </div>
                    )}

                    <div className="tcf-field-row">
                      <div className="tcf-field-left">
                        <span className="tcf-field-label">Tổng số câu hỏi mỗi đề</span>
                      </div>
                      <input type="number" className="tcf-field-input" min="1" required value={form.totalQuestions} onChange={(event) => updateForm('totalQuestions', event.target.value)} />
                    </div>

                    <div className="tcf-field-row">
                      <div className="tcf-field-left">
                        <span className="tcf-field-label">Thời gian làm bài (phút)</span>
                      </div>
                      <input type="number" className="tcf-field-input" min="1" required value={form.timeLimitMinutes} onChange={(event) => updateForm('timeLimitMinutes', event.target.value)} />
                    </div>

                    <div className="tcf-field-row">
                      <div className="tcf-field-left">
                        <span className="tcf-field-label">Điểm đạt (%)</span>
                      </div>
                      <input type="number" className="tcf-field-input" min="0" max="100" required value={form.passingScore} onChange={(event) => updateForm('passingScore', event.target.value)} />
                    </div>

                    <div className="tcf-field-row">
                      <div className="tcf-field-left">
                        <span className="tcf-field-label">Số lần thi lại tối đa</span>
                      </div>
                      <input type="number" className="tcf-field-input" min="0" required value={form.maxRetakes} onChange={(event) => updateForm('maxRetakes', event.target.value)} />
                    </div>

                    <div className="tcf-field-row">
                      <div className="tcf-field-left">
                        <span className="tcf-field-label">Chiến lược chọn câu hỏi</span>
                        <span className="tcf-field-subtext">RANDOM: chọn ngẫu nhiên. MIXED: câu bắt buộc + random bổ sung</span>
                      </div>
                      <select className="tcf-field-select" value={form.selectionStrategy} onChange={(event) => updateForm('selectionStrategy', event.target.value)}>
                        <option value="RANDOM">RANDOM - Ngẫu nhiên</option>
                        <option value="MIXED">MIXED - Kết hợp (bắt buộc + ngẫu nhiên)</option>
                      </select>
                    </div>
                  </div>

                  <div className="tcf-section-header" style={{ marginTop: '28px' }}>
                    <span className="tcf-section-title">PHÂN BỔ CÂU HỎI THEO DANH MỤC</span>
                  </div>

                  {isSumMismatch && (
                    <div className="tcf-warning-banner">
                      <span className="tcf-warning-icon"><WarningOutlined /></span>
                      <span className="tcf-warning-text">
                        Tổng phân bổ ({totalDistributionQuestions} câu) chưa khớp tổng số câu của đề ({form.totalQuestions} câu).
                      </span>
                    </div>
                  )}

                  {warnings.map((warning, index) => (
                    <div className="tcf-warning-banner" key={`${warning}-${index}`}>
                      <span className="tcf-warning-icon"><WarningOutlined /></span>
                      <span className="tcf-warning-text">{warning}</span>
                    </div>
                  ))}

                  <div className="tcf-table-card">
                    <table className="tcf-table">
                      <thead>
                        <tr>
                          <th>Danh mục</th>
                          <th style={{ width: '150px' }}>Số câu hỏi</th>
                          <th style={{ width: '150px' }}>% đề</th>
                          <th style={{ width: '150px' }}>Có sẵn</th>
                          <th style={{ width: '120px', textAlign: 'center' }}>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.distributions.length === 0 ? (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 0' }}>
                              Chưa có phân bổ danh mục.
                            </td>
                          </tr>
                        ) : (
                          form.distributions.map((item, index) => {
                            const pct = Number(form.totalQuestions) > 0 ? Math.round((Number(item.questions) / Number(form.totalQuestions)) * 100) : 0
                            return (
                              <tr key={item.id || index}>
                                <td style={{ fontWeight: 600, color: '#1e293b' }}>{item.categoryName}</td>
                                <td style={{ fontWeight: 600, color: '#334155' }}>{item.questions}</td>
                                <td style={{ color: '#475569', fontWeight: 500 }}>{pct}%</td>
                                <td style={{ color: item.shortage ? '#b91c1c' : '#475569', fontWeight: 600 }}>
                                  {item.availableQuestionCount ?? '-'}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                    <button type="button" className="tcf-action-btn tcf-action-btn--edit" onClick={() => handleOpenEditModal(item, index)} title="Chỉnh sửa">
                                      <EditOutlined />
                                    </button>
                                    <button type="button" className="tcf-action-btn tcf-action-btn--delete" onClick={() => handleDeleteRule(index)} title="Xóa">
                                      <DeleteOutlined />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>

                    <div className="tcf-card-footer">
                      <button type="button" className="tcf-btn-add-rule" onClick={handleOpenAddModal} disabled={categories.length === 0}>
                        <PlusCircleOutlined /> Thêm phân bổ danh mục
                      </button>
                    </div>
                  </div>
                </div>

                <div className="tcf-form-actions">
                  <button type="button" className="tcf-btn-reset" onClick={handlePreviewConfig}>Kiểm tra cấu hình</button>
                  <button type="submit" className="tcf-btn-save" disabled={isSaving || isLoading}>
                    {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
                  </button>
                  <button type="button" className="tcf-btn-reset" onClick={handleResetDefault}>Thiết lập mặc định</button>
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>

      {isModalOpen && (
        <div className="tcf-modal-backdrop" onClick={handleCloseModal}>
          <div className="tcf-modal" onClick={(event) => event.stopPropagation()}>
            <div className="tcf-modal-header">
              <div className="tcf-modal-title-wrap">
                <h2 className="tcf-modal-title">{modalMode === 'add' ? 'Thêm phân bổ danh mục' : 'Cập nhật phân bổ danh mục'}</h2>
              </div>
              <button type="button" className="tcf-modal-close" onClick={handleCloseModal}>
                <CloseOutlined />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="tcf-modal-form">
              <div className="tcf-modal-group">
                <label>Danh mục câu hỏi <span className="tcf-required-star">*</span></label>
                <select className="tcf-input-red" required value={modalCategoryId} onChange={(event) => setModalCategoryId(event.target.value)} disabled={modalMode === 'edit'}>
                  <option value="">Chọn danh mục</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>

              <div className="tcf-modal-group">
                <label>Số lượng câu hỏi phân bổ <span className="tcf-required-star">*</span></label>
                <input type="number" className="tcf-input-green" min="1" required value={modalQuestions} onChange={(event) => setModalQuestions(event.target.value)} placeholder="Ví dụ: 8" />
              </div>

              <div className="tcf-modal-actions">
                <button type="submit" className="tcf-btn-save-modal">Lưu</button>
                <button type="button" className="tcf-btn-cancel-modal" onClick={handleCloseModal}>Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TestConfigPage
