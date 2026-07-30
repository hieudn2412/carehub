import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CheckCircleOutlined,
  CloseOutlined,
  EditOutlined,
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons'
import AdminHeader from '../components/AdminHeader.jsx'
import AdminSidebar from '../components/AdminSidebar.jsx'
import { adminApi } from '../api/adminApi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import '../styles/ProfessionalFieldManagementPage.css'

const EMPTY_FORM = { code: '', name: '', description: '', active: true, version: null }

function ProfessionalFieldManagementPage() {
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [fields, setFields] = useState([])
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const activeTab = searchParams.get('tab') || 'existing'

  const handleTabChange = (tabName) => {
    setSearchParams({ tab: tabName })
  }

  const loadFields = useCallback(() => {
    setLoading(true)
    const apiActive = activeTab === 'pending'
      ? 'false'
      : (statusFilter === '' ? undefined : statusFilter)

    adminApi.getProfessionalFields({
      page: 0,
      size: 100,
      keyword: keyword || undefined,
      active: apiActive,
    })
      .then(response => {
        let content = response.data?.data?.content || []
        if (activeTab === 'pending') {
          content = content.filter(f => f.code?.startsWith('CUSTOM_'))
        } else {
          // 'existing' - show all except unapproved custom fields
          content = content.filter(f => !(f.code?.startsWith('CUSTOM_') && !f.active))
        }
        setFields(content)
      })
      .catch(error => showToast(error?.response?.data?.message || 'Không thể tải lĩnh vực chuyên môn', 'error'))
      .finally(() => setLoading(false))
  }, [activeTab, statusFilter, keyword, showToast])

  const loadPendingCount = useCallback(() => {
    adminApi.getProfessionalFields({
      page: 0,
      size: 100,
      active: 'false',
    })
      .then(response => {
        const content = response.data?.data?.content || []
        const count = content.filter(f => f.code?.startsWith('CUSTOM_')).length
        setPendingCount(count)
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

  const closeFormModal = useCallback(() => {
    if (saving) return
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormModalOpen(false)
  }, [saving])

  const createField = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
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
    setFormModalOpen(true)
  }

  useEffect(() => {
    if (!formModalOpen) return undefined
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = event => {
      if (event.key === 'Escape') closeFormModal()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [closeFormModal, formModalOpen])

  const submit = async event => {
    event.preventDefault()
    if (!form.code.trim() || !form.name.trim()) {
      showToast('Vui lòng nhập mã và tên lĩnh vực chuyên môn', 'warning')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await adminApi.updateProfessionalField(editingId, form)
        showToast('Đã cập nhật lĩnh vực chuyên môn', 'success')
      } else {
        await adminApi.createProfessionalField(form)
        showToast('Đã thêm lĩnh vực chuyên môn', 'success')
      }
      setEditingId(null)
      setForm(EMPTY_FORM)
      setFormModalOpen(false)
      loadFields()
      loadPendingCount()
    } catch (error) {
      showToast(error?.response?.data?.message || 'Không thể lưu lĩnh vực chuyên môn', 'error')
    } finally {
      setSaving(false)
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

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={[{ label: 'Đào tạo' }, { label: 'Lĩnh vực chuyên môn' }]} />
        <main className="pfm-page">
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
                </div>
                <div className="pfm-search-box">
                  <div className="pfm-toolbar-main">
                    <div className="pfm-search-filter-group">
                      <div className="pfm-search">
                        <SearchOutlined />
                        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Tìm theo mã hoặc tên..." />
                      </div>
                      {activeTab === 'existing' && (
                        <button
                          type="button"
                          className={`pfm-filter-trigger${isFilterOpen ? ' is-open' : ''}`}
                          aria-expanded={isFilterOpen}
                          aria-controls="professional-field-filter-panel"
                          onClick={() => setIsFilterOpen((current) => !current)}
                        >
                          <FilterOutlined /> Bộ lọc
                          {statusFilter && <span className="pfm-filter-count">1</span>}
                        </button>
                      )}
                    </div>
                    <div className="pfm-toolbar-actions">
                      <button className="pfm-create-btn" type="button" onClick={createField}>
                        <PlusOutlined /> Tạo mới lĩnh vực
                      </button>
                      <button type="button" onClick={loadFields}><ReloadOutlined /> Tải lại</button>
                    </div>
                  </div>
                  {activeTab === 'existing' && isFilterOpen && (
                    <div className="pfm-filter-panel" id="professional-field-filter-panel">
                      <label>
                        <span>Trạng thái</span>
                        <select
                          value={statusFilter}
                          onChange={e => setStatusFilter(e.target.value)}
                          className="pfm-status-select"
                        >
                          <option value="">Tất cả trạng thái</option>
                          <option value="true">Đang dùng</option>
                          <option value="false">Ngừng dùng</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              </div>
              <div className="pfm-table-container">
                <table className="admin-table-uppercase">
                  <thead><tr><th>Mã</th><th>Tên lĩnh vực</th><th>Trạng thái</th><th>Hành động</th></tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={4}>Đang tải...</td></tr> : fields.length === 0 ? <tr><td colSpan={4}>Chưa có lĩnh vực phù hợp.</td></tr> : fields.map(field => (
                      <tr key={field.id}>
                        <td><code>{field.code}</code></td>
                        <td><strong>{field.name}</strong><small>{field.description || 'Không có mô tả'}</small></td>
                        <td>
                          {field.active ? (
                            <span className="pfm-status pfm-status--active">Đang dùng</span>
                          ) : field.code?.startsWith('CUSTOM_') ? (
                            <span className="pfm-status pfm-status--pending">Chờ duyệt</span>
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
                              aria-label={`${field.active ? 'Ngừng sử dụng' : field.code?.startsWith('CUSTOM_') ? 'Phê duyệt' : 'Kích hoạt'} lĩnh vực ${field.name}`}
                              type="button"
                              className={`${field.active ? 'pfm-btn-deactivate admin-table-action--danger' : 'pfm-btn-activate admin-table-action--success'} admin-table-action admin-table-action--icon`}
                              onClick={() => toggleStatus(field)}
                              title={field.active ? 'Ngừng sử dụng' : field.code?.startsWith('CUSTOM_') ? 'Phê duyệt' : 'Kích hoạt'}
                            >
                              {field.active ? <StopOutlined /> : <CheckCircleOutlined />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>
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
                <label>
                  Mã lĩnh vực
                  <input
                    autoFocus
                    maxLength={50}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    placeholder="VD: CAP_CUU"
                    value={form.code}
                  />
                </label>
                <label>
                  Tên lĩnh vực
                  <input
                    maxLength={255}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="VD: Chăm sóc cấp cứu"
                    value={form.name}
                  />
                </label>
                <label>
                  Mô tả
                  <textarea
                    maxLength={2000}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Mô tả ngắn về phạm vi của lĩnh vực..."
                    rows={4}
                    value={form.description}
                  />
                </label>
                <label className="pfm-check">
                  <input
                    checked={form.active}
                    onChange={e => setForm({ ...form, active: e.target.checked })}
                    type="checkbox"
                  />
                  Đang sử dụng
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
      </div>
    </div>
  )
}

export default ProfessionalFieldManagementPage
