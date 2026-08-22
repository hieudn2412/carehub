import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import AppliedFilterToolbar from '../../../shared/components/AppliedFilterToolbar.jsx'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import { adminApi } from '../api/adminApi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import '../styles/ProfessionalFieldManagementPage.css'

const EMPTY_FORM = { code: '', name: '', description: '', active: true, version: null }
const EMPTY_FORM_ERRORS = { code: '', name: '' }

function moderationStatusOf(field) {
  if (field?.moderationStatus) return field.moderationStatus
  return field?.code?.startsWith('CUSTOM_') && !field?.active ? 'PENDING' : 'APPROVED'
}

function validateForm(form) {
  const errors = { ...EMPTY_FORM_ERRORS }
  const code = form.code.trim()
  const name = form.name.trim()

  if (!code) {
    errors.code = 'Vui lòng nhập mã lĩnh vực.'
  } else if (code.length < 2) {
    errors.code = 'Mã lĩnh vực phải có ít nhất 2 ký tự.'
  }

  if (!name) {
    errors.name = 'Vui lòng nhập tên lĩnh vực.'
  }

  return errors
}

function ProfessionalFieldManagementPage() {
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [fields, setFields] = useState([])
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({ keyword: '', status: '' })
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [rejectedCount, setRejectedCount] = useState(0)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState(EMPTY_FORM_ERRORS)
  const [editingId, setEditingId] = useState(null)
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rejectingField, setRejectingField] = useState(null)
  const [rejectSaving, setRejectSaving] = useState(false)

  const activeTab = searchParams.get('tab') || 'existing'

  const handleTabChange = (tabName) => {
    setSearchParams({ tab: tabName })
  }

  const loadFields = useCallback(() => {
    setLoading(true)
    const apiActive = activeTab === 'pending' || activeTab === 'rejected'
      ? 'false'
      : (appliedFilters.status === '' ? undefined : appliedFilters.status)

    adminApi.getProfessionalFields({
      page: 0,
      size: 100,
      keyword: appliedFilters.keyword || undefined,
      active: apiActive,
    })
      .then(response => {
        let content = response.data?.data?.content || []
        if (activeTab === 'pending') {
          content = content.filter(f => moderationStatusOf(f) === 'PENDING')
        } else if (activeTab === 'rejected') {
          content = content.filter(f => moderationStatusOf(f) === 'REJECTED')
        } else {
          content = content.filter(f => moderationStatusOf(f) === 'APPROVED')
        }
        setFields(content)
      })
      .catch(error => showToast(error?.response?.data?.message || 'Không thể tải lĩnh vực chuyên môn', 'error'))
      .finally(() => setLoading(false))
  }, [activeTab, appliedFilters, showToast])

  const loadPendingCount = useCallback(() => {
    adminApi.getProfessionalFields({
      page: 0,
      size: 100,
      active: 'false',
    })
      .then(response => {
        const content = response.data?.data?.content || []
        setPendingCount(content.filter(f => moderationStatusOf(f) === 'PENDING').length)
        setRejectedCount(content.filter(f => moderationStatusOf(f) === 'REJECTED').length)
      })
      .catch(error => console.error("Error loading pending fields count", error))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadFields()
      loadPendingCount()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [loadFields, loadPendingCount])

  useEffect(() => {
    const nextKeyword = keyword.trim()
    if (nextKeyword === appliedFilters.keyword) return undefined
    const timer = window.setTimeout(() => {
      setAppliedFilters((current) => (
        current.keyword === nextKeyword ? current : { ...current, keyword: nextKeyword }
      ))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [appliedFilters.keyword, keyword])

  const closeFormModal = useCallback(() => {
    if (saving) return
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormErrors(EMPTY_FORM_ERRORS)
    setFormModalOpen(false)
  }, [saving])

  const closeRejectModal = useCallback(() => {
    if (rejectSaving) return
    setRejectingField(null)
  }, [rejectSaving])

  const openRejectModal = field => {
    setRejectingField(field)
  }

  const createField = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormErrors(EMPTY_FORM_ERRORS)
    setFormModalOpen(true)
  }

  const editField = field => {
    setEditingId(field.id)
    setForm({
      code: field.code || '',
      name: field.name || '',
      description: field.description || '',
      active: field.active,
      version: field.version,
    })
    setFormErrors(EMPTY_FORM_ERRORS)
    setFormModalOpen(true)
  }

  const updateFormField = (fieldName, value) => {
    setForm(current => ({ ...current, [fieldName]: value }))
    if (formErrors[fieldName]) {
      setFormErrors(current => ({ ...current, [fieldName]: '' }))
    }
  }

  useEffect(() => {
    if (!formModalOpen && !rejectingField) return undefined
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = event => {
      if (event.key === 'Escape') {
        if (rejectingField) closeRejectModal()
        else closeFormModal()
      }
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [closeFormModal, closeRejectModal, formModalOpen, rejectingField])

  const submit = async event => {
    event.preventDefault()
    const errors = validateForm(form)
    if (Object.values(errors).some(Boolean)) {
      setFormErrors(errors)
      return
    }

    const payload = {
      ...form,
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
    }

    setSaving(true)
    try {
      if (editingId) {
        await adminApi.updateProfessionalField(editingId, payload)
        showToast('Đã cập nhật lĩnh vực chuyên môn', 'success')
      } else {
        await adminApi.createProfessionalField(payload)
        showToast('Đã thêm lĩnh vực chuyên môn', 'success')
      }
      setEditingId(null)
      setForm(EMPTY_FORM)
      setFormErrors(EMPTY_FORM_ERRORS)
      setFormModalOpen(false)
      loadFields()
      loadPendingCount()
    } catch (error) {
      showToast(error?.response?.data?.message || 'Không thể lưu lĩnh vực chuyên môn', 'error')
    } finally {
      setSaving(false)
    }
  }

  const rejectField = async event => {
    event.preventDefault()
    setRejectSaving(true)
    try {
      await adminApi.rejectProfessionalField(rejectingField.id)
      showToast('Đã từ chối đề xuất lĩnh vực chuyên môn', 'success')
      setRejectingField(null)
      loadFields()
      loadPendingCount()
    } catch (error) {
      showToast(error?.response?.data?.message || 'Không thể từ chối đề xuất lĩnh vực', 'error')
    } finally {
      setRejectSaving(false)
    }
  }

  const toggleStatus = async field => {
    try {
      await adminApi.updateProfessionalField(field.id, {
        code: field.code,
        name: field.name,
        description: field.description,
        active: !field.active,
        version: field.version,
      })
      showToast(field.active ? 'Đã ngừng sử dụng lĩnh vực' : 'Đã kích hoạt lĩnh vực', 'success')
      loadFields()
      loadPendingCount()
    } catch (error) {
      showToast(error?.response?.data?.message || 'Không thể đổi trạng thái lĩnh vực', 'error')
    }
  }

  const applyFilters = () => {
    setAppliedFilters({ keyword: keyword.trim(), status: statusFilter })
  }

  const resetFilters = () => {
    setKeyword('')
    setStatusFilter('')
    setAppliedFilters({ keyword: '', status: '' })
  }

  return (
    <AppShell
      className="dashboard-layout"
      breadcrumbs={[{ label: 'Đào tạo' }, { label: 'Lĩnh vực chuyên môn' }]}
    >
      <div className="pfm-page">
          <section className="pfm-heading">
            <div>
              <h1>Quản lý lĩnh vực chuyên môn</h1>
              <p>Danh mục dùng chung khi tạo bài kiểm tra, lọc kết quả và khai báo giờ đào tạo.</p>
            </div>
          </section>

          <div className="pfm-layout">
            <section className="pfm-card pfm-list">
              <div className="pfm-tabs-container">
                <div className="pfm-tabs">
                  <button
                    type="button"
                    className={`pfm-tab-btn ${activeTab === 'existing' ? 'active' : ''}`}
                    onClick={() => handleTabChange('existing')}
                  >
                    Lĩnh vực hiện có
                  </button>
                  <button
                    type="button"
                    className={`pfm-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                    onClick={() => handleTabChange('pending')}
                  >
                    Chờ phê duyệt {pendingCount > 0 && <span className="pfm-tab-badge">{pendingCount}</span>}
                  </button>
                  <button
                    type="button"
                    className={`pfm-tab-btn ${activeTab === 'rejected' ? 'active' : ''}`}
                    onClick={() => handleTabChange('rejected')}
                  >
                    Đã từ chối {rejectedCount > 0 && <span className="pfm-tab-badge pfm-tab-badge--rejected">{rejectedCount}</span>}
                  </button>
                </div>
                <AppliedFilterToolbar
                  activeCount={statusFilter ? 1 : 0}
                  actions={<div className="pfm-toolbar-actions">
                      <button className="pfm-create-btn" type="button" onClick={createField}>
                        <PlusOutlined /> Tạo mới lĩnh vực
                      </button>
                      <button type="button" onClick={loadFields}><ReloadOutlined /> Tải lại</button>
                    </div>}
                  className="pfm-search-box"
                  isOpen={activeTab === 'existing' && isFilterOpen}
                  onApply={applyFilters}
                  onReset={resetFilters}
                  onSearchChange={setKeyword}
                  onToggle={() => setIsFilterOpen((current) => !current)}
                  panelClassName="pfm-filter-panel"
                  panelId="professional-field-filter-panel"
                  searchAriaLabel="Tìm lĩnh vực theo mã hoặc tên"
                  searchClassName="pfm-search"
                  searchPlaceholder="Tìm theo mã hoặc tên..."
                  searchValue={keyword}
                  showFilter={activeTab === 'existing'}
                >
                  {activeTab === 'existing' && (
                      <FilterSelectField
                        label="Trạng thái"
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={[{ value: '', label: 'Tất cả trạng thái' }, { value: 'true', label: 'Đang dùng' }, { value: 'false', label: 'Ngừng dùng' }]}
                        placeholder="Tất cả trạng thái"
                      />
                  )}
                </AppliedFilterToolbar>
              </div>
              <div className="pfm-table-container">
                <table className="admin-table-uppercase">
                  <thead><tr><th>Mã</th><th>Tên lĩnh vực</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={4}>Đang tải...</td></tr> : fields.length === 0 ? <tr><td colSpan={4}>Chưa có lĩnh vực phù hợp.</td></tr> : fields.map(field => (
                      <tr key={field.id}>
                        <td><code>{field.code}</code></td>
                         <td>
                           <strong>{field.name}</strong>
                           <small>
                             {moderationStatusOf(field) === 'REJECTED' && field.rejectionReason
                               ? `Lý do: ${field.rejectionReason}`
                               : field.description || 'Không có mô tả'}
                           </small>
                         </td>
                        <td>
                          {moderationStatusOf(field) === 'REJECTED' ? (
                            <span className="pfm-status pfm-status--rejected">Đã từ chối</span>
                          ) : moderationStatusOf(field) === 'PENDING' ? (
                            <span className="pfm-status pfm-status--pending">Chờ duyệt</span>
                          ) : field.active ? (
                            <span className="pfm-status pfm-status--active">Đang dùng</span>
                          ) : (
                            <span className="pfm-status">Ngừng dùng</span>
                          )}
                        </td>
                        <td>
                          <div className="pfm-row-actions admin-table-actions">
                            <button
                              aria-label={`Chỉnh sửa lĩnh vực ${field.name}`}
                              className="pfm-btn-edit admin-table-action admin-table-action--icon admin-table-action--primary"
                              onClick={() => editField(field)}
                              title="Chỉnh sửa"
                              type="button"
                            >
                              <EditOutlined />
                            </button>
                            <button
                              aria-label={`${field.active ? 'Ngừng sử dụng' : moderationStatusOf(field) === 'REJECTED' ? 'Duyệt lại' : field.code?.startsWith('CUSTOM_') ? 'Phê duyệt' : 'Kích hoạt'} lĩnh vực ${field.name}`}
                              type="button"
                              className={`${field.active ? 'pfm-btn-deactivate admin-table-action--danger' : 'pfm-btn-activate admin-table-action--success'} admin-table-action admin-table-action--icon`}
                              onClick={() => toggleStatus(field)}
                              title={field.active ? 'Ngừng sử dụng' : moderationStatusOf(field) === 'REJECTED' ? 'Duyệt lại' : field.code?.startsWith('CUSTOM_') ? 'Phê duyệt' : 'Kích hoạt'}
                            >
                              {field.active ? <StopOutlined /> : <CheckCircleOutlined />}
                            </button>
                            {moderationStatusOf(field) === 'PENDING' && (
                              <button
                                aria-label={`Từ chối lĩnh vực ${field.name}`}
                                className="pfm-btn-reject admin-table-action admin-table-action--icon"
                                onClick={() => openRejectModal(field)}
                                title="Từ chối đề xuất"
                                type="button"
                              >
                                <CloseCircleOutlined />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
      </div>
        {formModalOpen && (
          <div
            className="pfm-modal-backdrop"
            onMouseDown={closeFormModal}
            role="presentation"
          >
            <form
              aria-labelledby="professional-field-modal-title"
              aria-modal="true"
              className="pfm-modal"
              noValidate
              onMouseDown={event => event.stopPropagation()}
              onSubmit={submit}
              role="dialog"
            >
              <header className="pfm-modal__header">
                <div>
                  <span>{editingId ? 'CHỈNH SỬA LĨNH VỰC' : 'LĨNH VỰC MỚI'}</span>
                  <h2 id="professional-field-modal-title">
                    {editingId ? 'Cập nhật lĩnh vực chuyên môn' : 'Tạo mới lĩnh vực chuyên môn'}
                  </h2>
                  <p>Thông tin này được dùng chung trong đào tạo và năng lực chuyên môn.</p>
                </div>
                <button
                  aria-label="Đóng popup"
                  className="pfm-modal__close"
                  disabled={saving}
                  onClick={closeFormModal}
                  type="button"
                >
                  <CloseOutlined />
                </button>
              </header>

              <div className="pfm-form pfm-modal__body">
                <label className="pfm-form-field">
                  <span className="pfm-form-label">
                    Mã lĩnh vực <span aria-hidden="true" className="pfm-required">*</span>
                  </span>
                  <input
                    aria-describedby={formErrors.code ? 'professional-field-code-error' : undefined}
                    aria-invalid={Boolean(formErrors.code)}
                    autoFocus
                    className={formErrors.code ? 'pfm-input--error' : undefined}
                    maxLength={50}
                    onChange={e => updateFormField('code', e.target.value)}
                    placeholder="VD: CAP_CUU"
                    required
                    value={form.code}
                  />
                  {formErrors.code && (
                    <small className="pfm-field-error" id="professional-field-code-error" role="alert">
                      {formErrors.code}
                    </small>
                  )}
                </label>
                <label className="pfm-form-field">
                  <span className="pfm-form-label">
                    Tên lĩnh vực <span aria-hidden="true" className="pfm-required">*</span>
                  </span>
                  <input
                    aria-describedby={formErrors.name ? 'professional-field-name-error' : undefined}
                    aria-invalid={Boolean(formErrors.name)}
                    className={formErrors.name ? 'pfm-input--error' : undefined}
                    maxLength={255}
                    onChange={e => updateFormField('name', e.target.value)}
                    placeholder="VD: Chăm sóc cấp cứu"
                    required
                    value={form.name}
                  />
                  {formErrors.name && (
                    <small className="pfm-field-error" id="professional-field-name-error" role="alert">
                      {formErrors.name}
                    </small>
                  )}
                </label>
                <label className="pfm-form-field pfm-form-field--wide">
                  <span className="pfm-form-label">Mô tả</span>
                  <textarea
                    maxLength={2000}
                    onChange={e => updateFormField('description', e.target.value)}
                    placeholder="Mô tả ngắn về phạm vi của lĩnh vực..."
                    rows={4}
                    value={form.description}
                  />
                </label>
                <label className="pfm-check pfm-form-field--wide">
                  <input
                    checked={form.active}
                    onChange={e => updateFormField('active', e.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>Đang sử dụng</strong>
                    <small>Lĩnh vực sẽ xuất hiện trong các danh sách lựa chọn.</small>
                  </span>
                </label>
              </div>

              <footer className="pfm-actions pfm-modal__actions">
                <button disabled={saving} onClick={closeFormModal} type="button">Hủy</button>
                <button className="pfm-primary" disabled={saving} type="submit">
                  {editingId ? <EditOutlined /> : <PlusOutlined />}
                  {saving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Tạo lĩnh vực'}
                </button>
              </footer>
            </form>
          </div>
        )}
        {rejectingField && (
          <div className="pfm-modal-backdrop" onMouseDown={closeRejectModal} role="presentation">
            <form
              aria-labelledby="professional-field-reject-title"
              aria-modal="true"
              className="pfm-modal pfm-reject-modal"
              onMouseDown={event => event.stopPropagation()}
              onSubmit={rejectField}
              role="dialog"
            >
              <header className="pfm-modal__header pfm-reject-modal__header">
                <div>
                  <span className="pfm-reject-eyebrow">TỪ CHỐI ĐỀ XUẤT</span>
                  <h2 id="professional-field-reject-title">Từ chối lĩnh vực chuyên môn</h2>
                  <p>Đề xuất bị từ chối sẽ không xuất hiện để chọn cho bản ghi đào tạo mới.</p>
                </div>
                <button
                  aria-label="Đóng popup"
                  className="pfm-modal__close"
                  disabled={rejectSaving}
                  onClick={closeRejectModal}
                  type="button"
                >
                  <CloseOutlined />
                </button>
              </header>
              <div className="pfm-modal__body pfm-reject-body">
                <div className="pfm-reject-field-summary">
                  <span className="pfm-reject-field-summary__badge">Lĩnh vực được đề xuất</span>
                  <strong className="pfm-reject-field-summary__name">{rejectingField.name}</strong>
                  {rejectingField.description && (
                    <p className="pfm-reject-field-summary__desc">{rejectingField.description}</p>
                  )}
                </div>
              </div>
              <footer className="pfm-actions pfm-modal__actions">
                <button disabled={rejectSaving} onClick={closeRejectModal} type="button">Hủy</button>
                <button className="pfm-danger" disabled={rejectSaving} type="submit">
                  <CloseCircleOutlined />
                  {rejectSaving ? 'Đang xử lý...' : 'Từ chối đề xuất'}
                </button>
              </footer>
            </form>
          </div>
        )}
    </AppShell>
  )
}

export default ProfessionalFieldManagementPage
