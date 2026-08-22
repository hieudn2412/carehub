import { useCallback, useEffect, useState } from 'react'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../../shared/api/apiError.js'
import AppShell from '../../../shared/components/AppShell.jsx'
import LoadingState from '../../../shared/components/LoadingState.jsx'
import EmptyState from '../../../shared/components/EmptyState.jsx'
import AppliedFilterToolbar from '../../../shared/components/AppliedFilterToolbar.jsx'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import { EditOutlined, PlusCircleOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons'
import FormSelectField from '../../../shared/components/FormSelectField.jsx'
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
  version: null,
}

function generateCodeFromName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function ActivityTypeListPage() {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('') // '', 'true', 'false'
  const [appliedFilters, setAppliedFilters] = useState({ keyword: '', status: '' })
  const [page, setPage] = useState(0)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' or 'edit'
  const [modalForm, setModalForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const fetchActivityTypes = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const response = await trainingApi.getActivityTypes({
        keyword: appliedFilters.keyword || undefined,
        isActive: appliedFilters.status === '' ? undefined : appliedFilters.status === 'true',
        page,
        size: 10,
        sort: 'sortOrder,asc',
      })
      setData(response.data.data)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không tải được danh sách cách thức đào tạo'))
    } finally {
      setIsLoading(false)
    }
  }, [appliedFilters, page])

  useEffect(() => {
    fetchActivityTypes()
  }, [fetchActivityTypes])

  const applyFilters = () => {
    setPage(0)
    setAppliedFilters({ keyword: keyword.trim(), status })
  }

  const resetFilters = () => {
    setKeyword('')
    setStatus('')
    setPage(0)
    setAppliedFilters({ keyword: '', status: '' })
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
        setSuccessMessage('Đã thêm cách thức đào tạo mới thành công!')
      } else {
        await trainingApi.updateActivityType(modalForm.id, payload)
        setSuccessMessage('Đã cập nhật cách thức đào tạo thành công!')
      }
      handleCloseModal()
      fetchActivityTypes()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không thể lưu cách thức đào tạo'))
    } finally {
      setIsSaving(false)
    }
  }

  const rows = data?.content ?? []
  const totalElements = data?.totalElements ?? 0
  const totalPages = data?.totalPages ?? 1

  const breadcrumbs = [{ label: 'Cách thức đào tạo' }]

  return (
    <AppShell breadcrumbs={breadcrumbs}>
            <div className="atl-page">
              {/* Title Card */}
              <div className="atl-title-card">
                <h1 className="atl-title">Cách thức đào tạo</h1>
                <p className="atl-subtitle">
                  Quản lý danh mục cách thức thực hiện hoạt động đào tạo
                </p>
              </div>

              {/* Filter Bar */}
              <AppliedFilterToolbar
                activeCount={status ? 1 : 0}
                actions={<button
                    className="atl-btn-add"
                    onClick={handleOpenCreateModal}
                  >
                    <PlusCircleOutlined /> Thêm cách thức
                  </button>}
                className="atl-filter-bar"
                isOpen={isFilterOpen}
                onApply={applyFilters}
                onReset={resetFilters}
                onSearchChange={setKeyword}
                onToggle={() => setIsFilterOpen((current) => !current)}
                panelClassName="atl-filter-panel"
                panelId="activity-type-filter-panel"
                searchAriaLabel="Tìm cách thức đào tạo"
                searchClassName="atl-search"
                searchPlaceholder="Tìm theo cách thức..."
                searchValue={keyword}
              >
                    <FilterSelectField
                      label="Trạng thái"
                      value={status}
                      onChange={setStatus}
                      options={[{ value: '', label: 'Tất cả trạng thái' }, { value: 'true', label: 'Hoạt động' }, { value: 'false', label: 'Ngưng hoạt động' }]}
                      placeholder="Tất cả trạng thái"
                    />
              </AppliedFilterToolbar>

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
                  <LoadingState label="Đang tải danh sách cách thức đào tạo..." />
                ) : rows.length === 0 ? (
                  <EmptyState>
                    {appliedFilters.keyword || appliedFilters.status ? 'Không tìm thấy kết quả phù hợp.' : 'Chưa có cách thức đào tạo nào.'}
                  </EmptyState>
                ) : (
                  <>
                      <table className="atl-table admin-table-uppercase">
                      <thead>
                        <tr>
                          <th>Tên cách thức</th>
                          <th>Mô tả</th>
                          <th>Trạng thái</th>
                          <th style={{ width: '96px' }}>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((item) => (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                            <td style={{ color: '#475569' }}>{item.description || '-'}</td>
                            <td>
                              <span className={`atl-badge ${item.active ? 'atl-badge--active' : 'atl-badge--inactive'}`}>
                                {item.active ? 'Hoạt động' : 'Ngưng'}
                              </span>
                            </td>
                            <td>
                              <div className="admin-table-actions">
                                <button
                                  type="button"
                                  className="admin-table-action admin-table-action--icon admin-table-action--primary"
                                  onClick={() => handleOpenEditModal(item)}
                                  title="Chỉnh sửa"
                                  aria-label={`Chỉnh sửa cách thức đào tạo ${item.name}`}
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
                        Hiển thị {rows.length} trong tổng số {totalElements} kết quả
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
                  {modalMode === 'create' ? 'Tạo cách thức đào tạo' : 'Cập nhật cách thức đào tạo'}
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
                  <label>Tên cách thức <span className="required-star">*</span></label>
                  <input
                    type="text"
                    className="atl-input-red"
                    required
                    value={modalForm.name}
                    onChange={(e) => updateModalField('name', e.target.value)}
                    placeholder="Nhập tên cách thức đào tạo..."
                  />
                </div>
                <FormSelectField
                  label="Trạng thái"
                  className="atl-modal-group"
                  value={modalForm.active.toString()}
                  onChange={(value) => updateModalField('active', value === 'true')}
                  options={[
                    { value: 'true', label: 'Hoạt động' },
                    { value: 'false', label: 'Ngưng hoạt động' }
                  ]}
                  searchable={false}
                />
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
    </AppShell>
  )
}

export default ActivityTypeListPage
