import { useCallback, useEffect, useState } from 'react'
import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import AdminHeader from '../components/AdminHeader.jsx'
import AdminSidebar from '../components/AdminSidebar.jsx'
import { adminApi } from '../api/adminApi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import '../styles/ProfessionalFieldManagementPage.css'

const EMPTY_FORM = { code: '', name: '', description: '', active: true, version: null }

function ProfessionalFieldManagementPage() {
  const { showToast } = useToast()
  const [fields, setFields] = useState([])
  const [keyword, setKeyword] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadFields = useCallback(() => {
    setLoading(true)
    adminApi.getProfessionalFields({
      page: 0,
      size: 100,
      keyword: keyword || undefined,
      active: activeFilter === '' ? undefined : activeFilter,
    })
      .then(response => setFields(response.data?.data?.content || []))
      .catch(error => showToast(error?.response?.data?.message || 'Không thể tải lĩnh vực chuyên môn', 'error'))
      .finally(() => setLoading(false))
  }, [activeFilter, keyword, showToast])

  useEffect(() => {
    const timer = window.setTimeout(loadFields, 250)
    return () => window.clearTimeout(timer)
  }, [loadFields])

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
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
  }

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
      resetForm()
      loadFields()
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
            <button type="button" onClick={loadFields}><ReloadOutlined /> Tải lại</button>
          </section>

          <div className="pfm-layout">
            <form className="pfm-card pfm-form" onSubmit={submit}>
              <h2>{editingId ? 'Cập nhật lĩnh vực' : 'Thêm lĩnh vực mới'}</h2>
              <label>Mã lĩnh vực<input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} maxLength={50} placeholder="VD: CAP_CUU" /></label>
              <label>Tên lĩnh vực<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={255} placeholder="VD: Chăm sóc cấp cứu" /></label>
              <label>Mô tả<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} maxLength={2000} /></label>
              <label className="pfm-check"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Đang sử dụng</label>
              <div className="pfm-actions">
                <button className="pfm-primary" disabled={saving} type="submit"><PlusOutlined /> {saving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Thêm lĩnh vực'}</button>
                {editingId && <button type="button" onClick={resetForm}>Hủy</button>}
              </div>
            </form>

            <section className="pfm-card pfm-list">
              <div className="pfm-filters">
                <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Tìm theo mã hoặc tên..." />
                <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)}>
                  <option value="">Tất cả trạng thái</option>
                  <option value="true">Đang sử dụng</option>
                  <option value="false">Ngừng sử dụng</option>
                </select>
              </div>
              <div className="pfm-table-container">
                <table>
                  <thead><tr><th>Mã</th><th>Tên lĩnh vực</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
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
                          <div className="pfm-row-actions">
                            <button type="button" className="pfm-btn-edit" onClick={() => editField(field)}>
                              <EditOutlined /> Sửa
                            </button>
                            <button
                              type="button"
                              className={field.active ? 'pfm-btn-deactivate' : 'pfm-btn-activate'}
                              onClick={() => toggleStatus(field)}
                            >
                              {field.active ? 'Ngừng dùng' : field.code?.startsWith('CUSTOM_') ? 'Phê duyệt' : 'Kích hoạt'}
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
      </div>
    </div>
  )
}

export default ProfessionalFieldManagementPage
