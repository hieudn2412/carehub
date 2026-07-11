import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DeleteOutlined,
  EditOutlined,
  LeftOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { adminApi } from '../api/adminApi'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import '../styles/EmailTemplatesListPage.css'

const CATEGORY_LABELS = {
  TRAINING: 'Đào tạo',
  EVALUATION: 'Đánh giá',
  QUALITY: 'Chất lượng',
}

function EmailTemplatesListPage() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null })
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let activeRequest = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError('')
      adminApi.getEmailTemplates({
        page: page - 1,
        size: 10,
        sort: 'updatedAt,desc',
        q: debouncedSearch || undefined,
        category: categoryFilter || undefined,
        active: statusFilter === '' ? undefined : statusFilter === 'ACTIVE',
      })
        .then((response) => {
          if (!activeRequest) return
          const data = response.data?.data
          setTemplates(data?.content || [])
          setTotalElements(data?.totalElements || 0)
          setTotalPages(data?.totalPages || 0)
        })
        .catch((requestError) => {
          if (!activeRequest) return
          console.error('Không thể tải biểu mẫu email', requestError)
          setError('Không thể tải danh sách biểu mẫu email.')
          setTemplates([])
        })
        .finally(() => {
          if (activeRequest) setLoading(false)
        })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      activeRequest = false
    }
  }, [page, debouncedSearch, categoryFilter, statusFilter, reloadToken])

  const executeDelete = async (id) => {
    try {
      await adminApi.deleteEmailTemplate(id)
      showToast('Xoá biểu mẫu email thành công!', 'success')
      setReloadToken((value) => value + 1)
    } catch (requestError) {
      console.error('Không thể xoá biểu mẫu email', requestError)
      showToast(requestError.response?.data?.message || 'Không thể xoá biểu mẫu email.', 'error')
    }
  }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={[{ label: 'Danh sách biểu mẫu email thông báo' }]} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="etl-page">
              <div className="etl-title-card">
                <h1 className="etl-title">Biểu mẫu</h1>
                <p className="etl-subtitle">Quản lý mẫu email cho từng sự kiện thông báo</p>
              </div>

              <div className="etl-filter-bar">
                <div className="etl-search-wrapper">
                  <span className="etl-search-icon"><SearchOutlined /></span>
                  <input
                    type="text"
                    className="etl-search-input"
                    placeholder="Tìm theo tên, mã hoặc tiêu đề..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <select
                  className="etl-filter-select"
                  value={categoryFilter}
                  onChange={(event) => { setCategoryFilter(event.target.value); setPage(1) }}
                >
                  <option value="">Danh mục</option>
                  <option value="TRAINING">Đào tạo</option>
                  <option value="EVALUATION">Đánh giá</option>
                  <option value="QUALITY">Chất lượng</option>
                </select>
                <select
                  className="etl-filter-select"
                  value={statusFilter}
                  onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}
                >
                  <option value="">Trạng thái</option>
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="INACTIVE">Ngừng</option>
                </select>
                <button className="etl-btn-create" onClick={() => navigate('/admin/notifications/email-templates/new')}>
                  <PlusCircleOutlined /> Tạo mới biểu mẫu
                </button>
              </div>

              <div className="etl-table-card">
                <table className="etl-table">
                  <thead>
                    <tr>
                      <th>Tên biểu mẫu</th>
                      <th>Danh mục</th>
                      <th>Điều kiện kích hoạt</th>
                      <th>Trạng thái</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                        <LoadingOutlined style={{ marginRight: 8 }} /> Đang tải danh sách biểu mẫu...
                      </td></tr>
                    ) : error ? (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px 0', color: '#dc2626' }}>{error}</td></tr>
                    ) : templates.length === 0 ? (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                        Không tìm thấy biểu mẫu email phù hợp.
                      </td></tr>
                    ) : templates.map((template) => (
                      <tr key={template.id}>
                        <td><strong>{template.name}</strong><div style={{ color: '#94a3b8', fontSize: 12 }}>{template.code}</div></td>
                        <td>{CATEGORY_LABELS[template.category] || template.category}</td>
                        <td>{template.triggerLabel}</td>
                        <td>
                          <span className={`etl-badge ${template.active ? 'etl-badge--active' : 'etl-badge--inactive'}`}>
                            {template.active ? 'Hoạt động' : 'Ngừng'}
                          </span>
                        </td>
                        <td>
                          <div className="etl-actions-cell">
                            <button
                              className="etl-btn-action etl-btn-edit"
                              onClick={() => navigate(`/admin/notifications/email-templates/${template.id}`)}
                              title="Chỉnh sửa"
                            >
                              <EditOutlined />
                            </button>
                            <button
                              className="etl-btn-action etl-btn-delete"
                              onClick={() => setConfirmModal({ isOpen: true, id: template.id })}
                              title={template.deletable ? 'Xoá' : 'Biểu mẫu hệ thống không thể xoá'}
                              disabled={!template.deletable}
                            >
                              <DeleteOutlined />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!loading && !error && totalElements > 0 && (
                  <div className="etl-pagination">
                    <span>Hiển thị {templates.length} trong tổng số {totalElements} kết quả</span>
                    <div className="etl-page-nums">
                      <button className="etl-pn" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
                        <LeftOutlined />
                      </button>
                      <span className="etl-pn etl-pn--active">{page}/{Math.max(totalPages, 1)}</span>
                      <button className="etl-pn" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>
                        <RightOutlined />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Xóa biểu mẫu email"
        message="Bạn có chắc chắn muốn xoá biểu mẫu email này không?"
        danger
        onConfirm={() => {
          executeDelete(confirmModal.id)
          setConfirmModal({ isOpen: false, id: null })
        }}
        onCancel={() => setConfirmModal({ isOpen: false, id: null })}
      />
    </div>
  )
}

export default EmailTemplatesListPage
