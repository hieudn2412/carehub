import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { EditOutlined, DeleteOutlined, PlusCircleOutlined, CloseOutlined, WarningOutlined } from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examConfigApi } from '../api/examConfigApi.js'
import { examPaperApi } from '../api/examPaperApi.js'
import { questionCategoryApi } from '../api/questionCategoryApi.js'
import { questionSetApi } from '../api/questionSetApi.js'
import { questionSetCategoryApi } from '../api/questionSetCategoryApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/ExamConfigPage.css'

const DEFAULT_FORM = {
  name: '',
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
  questionSetCategoryId: '',
  distributions: [],
}

function ExamConfigPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [configs, setConfigs] = useState([])
  const [selectedConfigId, setSelectedConfigId] = useState('')
  const [form, setForm] = useState(DEFAULT_FORM)
  const [activeQuestionSets, setActiveQuestionSets] = useState([])
  const [categories, setCategories] = useState([])
  const [qsCategories, setQsCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [preview, setPreview] = useState(null)

  const [namePrefix, setNamePrefix] = useState('')
  const [variantCount, setVariantCount] = useState(1)

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
      setNamePrefix('')
      return
    }
    setSelectedConfigId(String(config.id))
    setForm({
      name: config.name || '',
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
      questionSetCategoryId: config.questionSetCategoryId ? String(config.questionSetCategoryId) : '',
      distributions: (config.distributions || []).map((item, index) => ({
        id: item.id || `${item.categoryId || 'all'}-${index}`,
        categoryId: item.categoryId ? String(item.categoryId) : '',
        categoryName: item.categoryName || 'Tất cả danh mục',
        questions: item.questionCount || 0,
        availableQuestionCount: item.availableQuestionCount,
        shortage: item.shortage,
      })),
    })
    setNamePrefix(config.name)
    setPreview({ warnings: config.warnings || [] })
  }, [])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [configsResponse, setsResponse, categoriesResponse, setCategoriesResponse] = await Promise.all([
        examConfigApi.listExamConfigs({}),
        questionSetApi.listQuestionSets({ status: 'ACTIVE' }),
        questionCategoryApi.listCategories({ status: 'ACTIVE' }),
        questionSetCategoryApi.listCategories({ status: 'ACTIVE' }),
      ])
      const nextConfigs = apiData(configsResponse, [])
      setConfigs(nextConfigs)
      setActiveQuestionSets(apiData(setsResponse, []))
      setCategories(apiData(categoriesResponse, []))
      setQsCategories(apiData(setCategoriesResponse, []))
      if (nextConfigs.length > 0) {
        hydrateForm(nextConfigs[0])
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [hydrateForm, showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredQuestionSets = useMemo(() => {
    if (!form.questionSetCategoryId) return activeQuestionSets
    return activeQuestionSets.filter((qs) => qs.category === qsCategories.find((c) => String(c.id) === form.questionSetCategoryId)?.name)
  }, [activeQuestionSets, form.questionSetCategoryId, qsCategories])

  const selectedQuestionSet = useMemo(
    () => activeQuestionSets.find((item) => String(item.id) === String(form.questionSetId)),
    [activeQuestionSets, form.questionSetId],
  )

  const totalDistributionQuestions = form.distributions.reduce((sum, item) => sum + Number(item.questions || 0), 0)
  const isSumMismatch = totalDistributionQuestions > 0 && totalDistributionQuestions !== Number(form.totalQuestions)

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setPreview(null)
  }

  function buildPayload(nextStatus = form.status) {
    return {
      name: form.name.trim(),
      description: form.description.trim(),
      questionSetId: form.questionSetId ? Number(form.questionSetId) : null,
      questionSetCategoryId: form.questionSetCategoryId ? Number(form.questionSetCategoryId) : null,
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

  async function handleGenerate() {
    if (!selectedConfigId) {
      showToast('Vui lòng chọn một cấu hình đã lưu.', 'warning')
      return
    }
    if (form.status !== 'ACTIVE') {
      showToast('Cấu hình phải ở trạng thái Hoạt động để sinh đề.', 'warning')
      return
    }
    setIsGenerating(true)
    try {
      const response = await examPaperApi.generateExamPapers({
        examConfigId: Number(selectedConfigId),
        namePrefix: namePrefix.trim() || form.name,
        variantCount: Number(variantCount) || 1,
        randomSeed: null,
      })
      const generated = apiData(response, [])
      showToast(`Đã sinh ${generated.length} bộ đề kiểm tra.`, 'success')
      navigate('/admin/evaluation/exam-papers')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsGenerating(false)
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
    updateForm('distributions', form.distributions.filter((_, itemIndex) => itemIndex !== index))
  }

  const warnings = preview?.warnings || []
  const breadcrumbs = [{ label: 'Cấu hình & Sinh đề' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="ecfg-page">
              <div className="ecfg-title-card">
                <h1 className="ecfg-title">Cấu hình & Sinh đề kiểm tra</h1>
                <p className="ecfg-subtitle">Thiết lập cấu hình, phân bổ câu hỏi và sinh đề kiểm tra</p>
              </div>

              <div className="ecfg-layout">
                <div className="ecfg-sidebar">
                  <div className="ecfg-sidebar-header">
                    <span>Cấu hình đã lưu</span>
                    <button type="button" className="ecfg-btn-new" onClick={handleNewConfig}>+ Mới</button>
                  </div>
                  {isLoading ? (
                    <div className="ecfg-sidebar-loading">Đang tải...</div>
                  ) : configs.length === 0 ? (
                    <div className="ecfg-sidebar-empty">Chưa có cấu hình</div>
                  ) : (
                    <div className="ecfg-sidebar-list">
                      {configs.map((config) => (
                        <button
                          key={config.id}
                          type="button"
                          className={`ecfg-sidebar-item ${selectedConfigId === String(config.id) ? 'ecfg-sidebar-item--active' : ''}`}
                          onClick={() => handleConfigSelect(String(config.id))}
                        >
                          <div className="ecfg-sidebar-item-name">{config.name}</div>
                          <div className="ecfg-sidebar-item-meta">
                            {config.totalQuestions} câu · {config.timeLimitMinutes} phút
                          </div>
                          <span className={`ecfg-sidebar-badge ${config.status === 'ACTIVE' ? 'ecfg-sidebar-badge--active' : 'ecfg-sidebar-badge--draft'}`}>
                            {config.statusText || config.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedConfigId || !configs.length ? (
                  <form onSubmit={handleSaveConfig} className="ecfg-form-panel">
                    <div className="ecfg-section">
                      <h3 className="ecfg-section-title">THÔNG TIN CẤU HÌNH</h3>

                      <div className="ecfg-field">
                        <label>Tên cấu hình <span className="ecfg-required">*</span></label>
                        <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="Nhập tên cấu hình" required />
                      </div>

                      <div className="ecfg-row">
                        <div className="ecfg-field">
                          <label>Trạng thái</label>
                          <select className="ecfg-select-red" value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                            <option value="DRAFT">Bản nháp</option>
                            <option value="ACTIVE">Hoạt động</option>
                            <option value="INACTIVE">Tạm ngưng</option>
                          </select>
                        </div>
                        <div className="ecfg-field">
                          <label>Danh mục bộ câu hỏi</label>
                          <select className="ecfg-select-red" value={form.questionSetCategoryId} onChange={(event) => updateForm('questionSetCategoryId', event.target.value)}>
                            <option value="">Tất cả</option>
                            {qsCategories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="ecfg-field">
                        <label>Bộ câu hỏi sử dụng</label>
                        <select
                          className="ecfg-select-red"
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
                          {filteredQuestionSets.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                      </div>

                      {selectedQuestionSet && (
                        <div className="ecfg-set-info">
                          <strong>{selectedQuestionSet.name}</strong>
                          <span>{selectedQuestionSet.questionCount || 0} câu hỏi</span>
                        </div>
                      )}

                      <div className="ecfg-row">
                        <div className="ecfg-field">
                          <label>Tổng số câu</label>
                          <input type="number" min="1" value={form.totalQuestions} onChange={(event) => updateForm('totalQuestions', event.target.value)} />
                        </div>
                        <div className="ecfg-field">
                          <label>Thời gian (phút)</label>
                          <input type="number" min="1" value={form.timeLimitMinutes} onChange={(event) => updateForm('timeLimitMinutes', event.target.value)} />
                        </div>
                      </div>

                      <div className="ecfg-row">
                        <div className="ecfg-field">
                          <label>Điểm đạt (%)</label>
                          <input type="number" min="0" max="100" value={form.passingScore} onChange={(event) => updateForm('passingScore', event.target.value)} />
                        </div>
                        <div className="ecfg-field">
                          <label>Số lần thi lại</label>
                          <input type="number" min="0" value={form.maxRetakes} onChange={(event) => updateForm('maxRetakes', event.target.value)} />
                        </div>
                      </div>
                    </div>

                    <div className="ecfg-section">
                      <h3 className="ecfg-section-title">PHÂN BỔ CÂU HỎI THEO DANH MỤC</h3>

                      {isSumMismatch && (
                        <div className="ecfg-warning">
                          <WarningOutlined />
                          <span>Tổng phân bổ ({totalDistributionQuestions} câu) chưa khớp tổng số câu ({form.totalQuestions} câu)</span>
                        </div>
                      )}

                      {warnings.map((warning, index) => (
                        <div className="ecfg-warning" key={`${warning}-${index}`}>
                          <WarningOutlined />
                          <span>{warning}</span>
                        </div>
                      ))}

                      <table className="ecfg-table">
                        <thead>
                          <tr>
                            <th>Danh mục</th>
                            <th style={{ width: '100px' }}>Số câu</th>
                            <th style={{ width: '80px' }}>%</th>
                            <th style={{ width: '80px' }}>Có sẵn</th>
                            <th style={{ width: '80px', textAlign: 'center' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.distributions.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="ecfg-empty-cell">Chưa có phân bổ danh mục</td>
                            </tr>
                          ) : (
                            form.distributions.map((item, index) => {
                              const pct = Number(form.totalQuestions) > 0 ? Math.round((Number(item.questions) / Number(form.totalQuestions)) * 100) : 0
                              return (
                                <tr key={item.id || index}>
                                  <td><strong>{item.categoryName}</strong></td>
                                  <td>{item.questions}</td>
                                  <td>{pct}%</td>
                                  <td style={{ color: item.shortage ? '#b91c1c' : '#475569' }}>{item.availableQuestionCount ?? '-'}</td>
                                  <td>
                                    <div className="ecfg-table-actions">
                                      <button type="button" onClick={() => handleOpenEditModal(item, index)} title="Sửa"><EditOutlined /></button>
                                      <button type="button" onClick={() => handleDeleteRule(index)} title="Xóa"><DeleteOutlined /></button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>

                      <button type="button" className="ecfg-btn-add-rule" onClick={handleOpenAddModal} disabled={categories.length === 0}>
                        <PlusCircleOutlined /> Thêm phân bổ danh mục
                      </button>
                    </div>

                    <div className="ecfg-actions">
                      <button type="button" className="ecfg-btn-outline" onClick={handlePreviewConfig}>Kiểm tra cấu hình</button>
                      <button type="submit" className="ecfg-btn-primary" disabled={isSaving}>
                        {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="ecfg-form-panel ecfg-empty-panel">
                    <p>Tạo cấu hình đầu tiên để bắt đầu</p>
                  </div>
                )}
              </div>

              {selectedConfigId && (
                <div className="ecfg-generate-card">
                  <h3>SINH ĐỀ KIỂM TRA</h3>
                  <div className="ecfg-row">
                    <div className="ecfg-field">
                      <label>Tiền tố tên đề</label>
                      <input value={namePrefix} onChange={(event) => setNamePrefix(event.target.value)} placeholder={form.name} />
                    </div>
                    <div className="ecfg-field">
                      <label>Số mã đề</label>
                      <input type="number" min="1" max="10" value={variantCount} onChange={(event) => setVariantCount(Number(event.target.value))} />
                    </div>
                  </div>
                  <div className="ecfg-actions">
                    <button type="button" className="ecfg-btn-primary" onClick={handleGenerate} disabled={isGenerating}>
                      {isGenerating ? 'Đang sinh...' : 'Sinh đề'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {isModalOpen && (
        <div className="ecfg-modal-backdrop" onClick={handleCloseModal}>
          <div className="ecfg-modal" onClick={(event) => event.stopPropagation()}>
            <div className="ecfg-modal-header">
              <h2 className="ecfg-modal-title">{modalMode === 'add' ? 'Thêm phân bổ danh mục' : 'Cập nhật phân bổ danh mục'}</h2>
              <button type="button" className="ecfg-modal-close" onClick={handleCloseModal}><CloseOutlined /></button>
            </div>
            <form onSubmit={handleModalSubmit} className="ecfg-modal-form">
              <div className="ecfg-modal-group">
                <label>Danh mục câu hỏi <span className="ecfg-required">*</span></label>
                <select className="ecfg-select-red" required value={modalCategoryId} onChange={(event) => setModalCategoryId(event.target.value)} disabled={modalMode === 'edit'}>
                  <option value="">Chọn danh mục</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div className="ecfg-modal-group">
                <label>Số lượng câu hỏi <span className="ecfg-required">*</span></label>
                <input type="number" min="1" required value={modalQuestions} onChange={(event) => setModalQuestions(event.target.value)} />
              </div>
              <div className="ecfg-modal-actions">
                <button type="submit" className="ecfg-btn-primary">Lưu</button>
                <button type="button" className="ecfg-btn-outline" onClick={handleCloseModal}>Hủy</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExamConfigPage
