import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { SearchOutlined, EyeOutlined, EditOutlined, PlusCircleOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons'
import '../styles/ActivityTypeListPage.css'

const EMPTY_FORM = {
  id: null,
  code: '',
  name: '',
  description: '',
  defaultDurationUnit: 'HOUR',
  requiresEvidence: true,
  maxCreditedHoursPerRecord: '',
  sortOrder: 0,
  active: true,
  multiplier: '',
  version: null,
}

function generateCodeFromName(name) {
  if (!name) return ''
  return name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove Vietnamese accents
    .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special characters
    .replace(/[\s-]+/g, '_') // Replace spaces/dashes with underscores
    .toUpperCase()
}

function ActivityTypeListPage() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('') // '', 'true', 'false'
  const [page, setPage] = useState(0)
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' or 'edit'
  const [modalForm, setModalForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const fetchActivityTypes = async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const response = await trainingApi.getActivityTypes({
        keyword: keyword || undefined,
        isActive: status === '' ? undefined : status === 'true',
        page,
        size: 10,
        sort: 'sortOrder,asc',
      })
      setData(response.data.data)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không tải được danh sách loại đào tạo'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchActivityTypes()
  }, [page, status])

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      setPage(0)
      fetchActivityTypes()
    }
  }

  const handleStatusChange = (e) => {
    setPage(0)
    setStatus(e.target.value)
  }

  // Modal Actions
  const handleOpenCreateModal = () => {
    setModalMode('create')
    setModalForm({
      ...EMPTY_FORM,
      code: `ATC_${Date.now()}` // Default temp code in case name is empty
    })
    setSuccessMessage('')
    setErrorMessage('')
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (item) => {
    setModalMode('edit')
    setModalForm({
      id: item.id,
      code: item.code || '',
      name: item.name || '',
      description: item.description || '',
      defaultDurationUnit: item.defaultDurationUnit || 'HOUR',
      requiresEvidence: item.requiresEvidence ?? true,
      maxCreditedHoursPerRecord: item.maxCreditedHoursPerRecord || '',
      sortOrder: item.sortOrder ?? 0,
      active: item.active ?? true,
      multiplier: item.multiplier || '1.0',
      version: item.version || null,
    })
    setSuccessMessage('')
    setErrorMessage('')
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setModalForm(EMPTY_FORM)
  }

  const updateModalField = (name, value) => {
    setModalForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleModalSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setErrorMessage('')
    setSuccessMessage('')

    const generatedCode = modalForm.code || generateCodeFromName(modalForm.name) || `ATC_${Date.now()}`

    const payload = {
      code: generatedCode,
      name: modalForm.name,
      description: modalForm.description || null,
      defaultDurationUnit: modalForm.defaultDurationUnit,
      requiresEvidence: modalForm.requiresEvidence,
      maxCreditedHoursPerRecord: modalForm.maxCreditedHoursPerRecord
        ? Number(modalForm.maxCreditedHoursPerRecord)
        : null,
      sortOrder: Number(modalForm.sortOrder),
      active: modalForm.active,
      version: modalForm.version,
    }

    try {
      if (modalMode === 'create') {
        await trainingApi.createActivityType(payload)
        setSuccessMessage('Đã thêm hình thức đào tạo mới thành công!')
      } else {
        await trainingApi.updateActivityType(modalForm.id, payload)
        setSuccessMessage('Đã cập nhật hình thức đào tạo thành công!')
      }
      handleCloseModal()
      fetchActivityTypes()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không thể lưu hình thức đào tạo'))
    } finally {
      setIsSaving(false)
    }
  }

  const rows = data?.content ?? []
  const totalElements = data?.totalElements ?? 0
  const totalPages = data?.totalPages ?? 1

  const displayRows = rows
  const displayTotal = totalElements

  const breadcrumbs = [{ label: 'Các hình thức đào tạo' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="atl-page">
              {/* Title Card */}
              <div className="atl-title-card">
                <h1 className="atl-title">Các hình thức đào tạo</h1>
                <p className="atl-subtitle">
                  Quản lý các danh mục dùng để phân loại hồ sơ đào tạo
                </p>
              </div>

              {/* Filter Bar */}
              <div className="atl-filter-bar">
                <div className="atl-filter-left">
                  <div className="atl-search">
                    <span className="atl-search-icon">
                      <SearchOutlined />
                    </span>
                    <input
                      type="text"
                      className="atl-search-input"
                      placeholder="Tìm theo hình thức..."
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      onKeyDown={handleSearchKeyPress}
                    />
                  </div>

                  <select
                    className="atl-filter-select"
                    value={status}
                    onChange={handleStatusChange}
                  >
                    <option value="">Trạng thái</option>
                    <option value="true">Hoạt động</option>
                    <option value="false">Ngưng hoạt động</option>
                  </select>
                </div>

                <button
                  className="atl-btn-add"
                  onClick={handleOpenCreateModal}
                >
                  <PlusCircleOutlined /> Thêm hình thức
                </button>
              </div>

              {/* Feedback Alerts */}
              {errorMessage && (
                <div style={{ padding: '12px 16px', background: '#ffebeb', color: '#d32f2f', borderRadius: 8, fontSize: 13.5, fontWeight: 500 }}>
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div style={{ padding: '12px 16px', background: '#e8f5f0', color: '#0f6e56', borderRadius: 8, fontSize: 13.5, fontWeight: 500 }}>
                  {successMessage}
                </div>
              )}

              {/* Table Card */}
              <div className="atl-table-card">
                {isLoading && rows.length === 0 ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
                    Đang tải danh sách các hình thức đào tạo...
                  </div>
                ) : (
                  <>
                    <table className="atl-table">
                      <thead>
                        <tr>
                          <th>Tên hình thức</th>
                          <th>Mô tả</th>
                          <th>Quy tắc tính giờ</th>
                          <th>Trạng thái</th>
                          <th style={{ width: '100px', textAlign: 'center' }}>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayRows.map((item) => (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                            <td style={{ color: '#475569' }}>{item.description || '-'}</td>
                            <td style={{ fontWeight: 500, color: '#334155' }}>
                              {item.maxCreditedHoursPerRecord
                                ? `Tối đa ${item.maxCreditedHoursPerRecord} giờ`
                                : 'Toàn bộ số giờ'}
                            </td>
                            <td>
                              <span className={`atl-badge ${item.active ? 'atl-badge--active' : 'atl-badge--inactive'}`}>
                                {item.active ? 'Hoạt động' : 'Ngưng'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                <Link
                                  className="atl-action-btn atl-action-btn--view"
                                  to={`/admin/training/activity-types/${item.id}`}
                                  title="Xem chi tiết"
                                >
                                  <EyeOutlined />
                                </Link>
                                <button
                                  type="button"
                                  className="atl-action-btn atl-action-btn--edit"
                                  onClick={() => handleOpenEditModal(item)}
                                  title="Chỉnh sửa"
                                >
                                  <EditOutlined />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination Bar */}
                    <div className="atl-pagination-bar">
                      <div className="atl-pagination-info">
                        Hiển thị {displayRows.length} trong tổng số {displayTotal} kết quả
                      </div>
                      <div className="atl-pagination-buttons">
                        <button
                          className="atl-page-btn"
                          disabled={page <= 0}
                          onClick={() => setPage(page - 1)}
                        >
                          &lt;
                        </button>
                        
                        {/* Pagination Numbers */}
                        {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => (
                          <button
                            key={idx}
                            className={`atl-page-btn ${page === idx ? 'atl-page-btn--active' : ''}`}
                            onClick={() => setPage(idx)}
                          >
                            {idx + 1}
                          </button>
                        ))}
                        
                        {totalPages > 5 && (
                          <>
                            <span className="atl-page-btn atl-page-btn--dots">...</span>
                            <button
                              className={`atl-page-btn ${page === totalPages - 1 ? 'atl-page-btn--active' : ''}`}
                              onClick={() => setPage(totalPages - 1)}
                            >
                              {totalPages}
                            </button>
                          </>
                        )}

                        <button
                          className="atl-page-btn"
                          disabled={page + 1 >= totalPages}
                          onClick={() => setPage(page + 1)}
                        >
                          &gt;
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Add / Edit Modal Popup */}
      {isModalOpen && (
        <div className="atl-modal-backdrop" onClick={handleCloseModal}>
          <div className="atl-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="atl-modal-header">
              <div className="atl-modal-title-wrap">
                <div className="atl-modal-title-icon">
                  <PlusOutlined />
                </div>
                <h2 className="atl-modal-title">
                  {modalMode === 'create' ? 'Tạo hình thức đào tạo' : 'Cập nhật hình thức đào tạo'}
                </h2>
              </div>
              <button className="atl-modal-close" onClick={handleCloseModal}>
                <CloseOutlined />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleModalSubmit} className="atl-modal-form">
              <div className="atl-modal-row">
                <div className="atl-modal-group">
                  <label>Tên hình thức <span className="required-star">*</span></label>
                  <input
                    type="text"
                    className="atl-input-red"
                    required
                    value={modalForm.name}
                    onChange={(e) => updateModalField('name', e.target.value)}
                    placeholder="Nhập tên hình thức đào tạo..."
                  />
                </div>
                <div className="atl-modal-group">
                  <label>Trạng thái</label>
                  <select
                    className="atl-input-red"
                    value={modalForm.active.toString()}
                    onChange={(e) => updateModalField('active', e.target.value === 'true')}
                  >
                    <option value="true">Hoạt động (Active)</option>
                    <option value="false">Ngưng (Inactive)</option>
                  </select>
                </div>
              </div>

              <div className="atl-modal-group">
                <label>Mô tả</label>
                <textarea
                  className="atl-textarea-green"
                  rows={3}
                  value={modalForm.description}
                  onChange={(e) => updateModalField('description', e.target.value)}
                  placeholder="Nhập mô tả tóm tắt..."
                />
              </div>

              <div className="atl-modal-row">
                <div className="atl-modal-group">
                  <label>Quy tắc tính giờ <span className="required-star">*</span></label>
                  <select
                    className="atl-input-green"
                    required
                    value={modalForm.defaultDurationUnit}
                    onChange={(e) => updateModalField('defaultDurationUnit', e.target.value)}
                  >
                    <option value="HOUR">Tính toàn bộ số giờ (Count full hour)</option>
                    <option value="LESSON">Tính theo tiết học (Count by lesson)</option>
                    <option value="CREDIT">Tính theo tín chỉ (Count by credit)</option>
                    <option value="DAY">Tính theo ngày (Count by day)</option>
                    <option value="MONTH">Tính theo tháng (Count by month)</option>
                    <option value="YEAR">Tính theo năm (Count by year)</option>
                    <option value="OTHER">Khác (Other)</option>
                  </select>
                </div>
                <div className="atl-modal-group">
                  <label>Hệ số nhân (tùy chọn)</label>
                  <input
                    type="text"
                    className="atl-input-green"
                    value={modalForm.multiplier}
                    onChange={(e) => updateModalField('multiplier', e.target.value)}
                    placeholder="Ví dụ: 1.0"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="atl-modal-actions">
                <button type="submit" className="atl-btn-save" disabled={isSaving}>
                  {isSaving ? 'Đang lưu...' : 'Lưu'}
                </button>
                <button type="button" className="atl-btn-cancel" onClick={handleCloseModal}>
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ActivityTypeListPage
