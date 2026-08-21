import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../../../shared/components/AppShell.jsx'
import ConfirmModal from '../../../shared/components/ConfirmModal.jsx'
import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import AppliedFilterToolbar from '../../../shared/components/AppliedFilterToolbar.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { questionCategoryApi } from '../api/questionCategoryApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/QuestionCategoryListPage.css'

const EMPTY_FORM = {
  id: null,
  code: '',
  name: '',
  description: '',
  status: 'ACTIVE',
}

export default function QuestionCategoryListPage() {
  const { showToast } = useToast()
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({ keyword: '', status: '' })
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [page, setPage] = useState(0)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' or 'edit'
  const [modalForm, setModalForm] = useState(EMPTY_FORM)
  const [categoryToArchive, setCategoryToArchive] = useState(null)

  const loadCategories = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await questionCategoryApi.listCategories({ status: '' })
      setCategories(apiData(response, []))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const filteredCategories = useMemo(() => {
    return categories.filter((item) => {
      const matchesKeyword =
        item.name.toLowerCase().includes(appliedFilters.keyword.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(appliedFilters.keyword.toLowerCase()) ||
        (item.code || '').toLowerCase().includes(appliedFilters.keyword.toLowerCase())
      const matchesStatus = appliedFilters.status === '' || item.status === appliedFilters.status
      return matchesKeyword && matchesStatus
    })
  }, [appliedFilters, categories])

  // Pagination calculations
  const pageSize = 10
  const totalElements = filteredCategories.length
  const totalPages = Math.ceil(totalElements / pageSize) || 1
  const displayRows = filteredCategories.slice(page * pageSize, (page + 1) * pageSize)

  // Modal actions
  const handleOpenCreateModal = () => {
    setModalMode('create')
    setModalForm(EMPTY_FORM)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (item) => {
    setModalMode('edit')
    setModalForm({
      id: item.id,
      code: item.code || '',
      name: item.name,
      description: item.description || '',
      status: item.status || 'ACTIVE',
    })
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

    if (modalForm.name.trim() === '') {
      showToast('Tên danh mục không được để trống.', 'warning')
      return
    }
    const payload = {
      code: modalForm.code.trim() || null,
      name: modalForm.name.trim(),
      description: modalForm.description.trim(),
      status: modalForm.status,
    }

    setIsSaving(true)
    try {
      if (modalMode === 'create') {
        await questionCategoryApi.createCategory(payload)
      } else {
        await questionCategoryApi.updateCategory(modalForm.id, payload)
      }
      showToast(modalMode === 'create' ? 'Đã tạo danh mục câu hỏi.' : 'Đã cập nhật danh mục câu hỏi.', 'success')
      handleCloseModal()
      setPage(0)
      setKeyword('')
      loadCategories()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteCategory = (item) => {
    setCategoryToArchive(item)
  }

  const confirmDeleteCategory = () => {
    if (!categoryToArchive) return
    const item = categoryToArchive
    setCategoryToArchive(null)
    questionCategoryApi
      .archiveCategory(item.id)
      .then(() => {
        showToast('Đã lưu trữ danh mục câu hỏi.', 'success')
        loadCategories()
      })
      .catch((error) => showToast(apiErrorMessage(error), 'error'))
  }

  const breadcrumbs = [{ label: 'Danh mục câu hỏi' }]
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

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <div className="qcl-page">
        {/* Title Card */}
        <div className="qcl-title-card">
          <h1 className="qcl-title">Danh mục câu hỏi</h1>
          <p className="qcl-subtitle">Quản lý danh mục kiến thức dùng chung cho ngân hàng câu hỏi</p>
        </div>

        {/* Filter Bar */}
        <AppliedFilterToolbar
          activeCount={status ? 1 : 0}
          actions={<button className="qcl-btn-add" onClick={handleOpenCreateModal}>
              <PlusCircleOutlined /> Thêm danh mục
            </button>}
          className="qcl-filter-bar"
          isOpen={isFilterOpen}
          onApply={applyFilters}
          onReset={resetFilters}
          onSearchChange={setKeyword}
          onToggle={() => setIsFilterOpen((current) => !current)}
          panelId="question-category-filter-panel"
          searchAriaLabel="Tìm danh mục câu hỏi"
          searchClassName="qcl-search"
          searchPlaceholder="Tìm danh mục..."
          searchValue={keyword}
        >
              <label className="admin-control-toolbar__field">
                <span>Trạng thái</span>
                <select
                  className="qcl-filter-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="INACTIVE">Tạm ngưng</option>
                  <option value="ARCHIVED">Đã lưu trữ</option>
                </select>
              </label>
        </AppliedFilterToolbar>

        {/* Table Card */}
        <div className="qcl-table-card">
          <table className="qcl-table admin-table-uppercase">
            <thead>
              <tr>
                <th>Tên danh mục</th>
                <th>Số câu hỏi</th>
                <th>Trạng thái</th>
                <th style={{ width: '120px' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                    Đang tải danh mục câu hỏi...
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                    Không tìm thấy danh mục câu hỏi nào.
                  </td>
                </tr>
              ) : (
                displayRows.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                    <td style={{ fontWeight: 600, color: '#334155' }}>{item.questionCount || 0}</td>
                    <td>
                      <span className={`qcl-badge ${item.status === 'ACTIVE' ? 'qcl-badge--active' : 'qcl-badge--inactive'}`}>
                        {item.statusText || (item.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ngưng')}
                      </span>
                    </td>
                    <td>
                      <div className="admin-table-actions">
                        <button
                          className="admin-action-btn admin-action-btn--edit"
                          onClick={() => handleOpenEditModal(item)}
                          title="Chỉnh sửa danh mục"
                        >
                          <EditOutlined />
                        </button>
                        <button
                          className="admin-action-btn admin-action-btn--danger"
                          onClick={() => handleDeleteCategory(item)}
                          title="Lưu trữ danh mục"
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Footer */}
          <div className="qcl-pagination-bar">
            <div className="qcl-pagination-info">
              Hiển thị {displayRows.length} trong tổng số {totalElements} kết quả
            </div>
            <div className="qcl-pagination-buttons">
              <button className="qcl-page-btn" disabled={page <= 0} onClick={() => setPage(page - 1)}>
                &lt;
              </button>
              {(() => {
                const maxVisible = 5
                const half = Math.floor(maxVisible / 2)
                let start = Math.max(0, page - half)
                const end = Math.min(totalPages, start + maxVisible)
                if (end - start < maxVisible) start = Math.max(0, end - maxVisible)
                const buttons = []
                if (start > 0) {
                  buttons.push(
                    <button key={0} className={`qcl-page-btn ${page === 0 ? 'qcl-page-btn--active' : ''}`} onClick={() => setPage(0)}>
                      1
                    </button>,
                  )
                  if (start > 1) buttons.push(<span key="se" className="qcl-page-ellipsis">&hellip;</span>)
                }
                for (let i = start; i < end; i++) {
                  buttons.push(
                    <button key={i} className={`qcl-page-btn ${page === i ? 'qcl-page-btn--active' : ''}`} onClick={() => setPage(i)}>
                      {i + 1}
                    </button>,
                  )
                }
                if (end < totalPages) {
                  if (end < totalPages - 1) buttons.push(<span key="ee" className="qcl-page-ellipsis">&hellip;</span>)
                  buttons.push(
                    <button
                      key={totalPages - 1}
                      className={`qcl-page-btn ${page === totalPages - 1 ? 'qcl-page-btn--active' : ''}`}
                      onClick={() => setPage(totalPages - 1)}
                    >
                      {totalPages}
                    </button>,
                  )
                }
                return buttons
              })()}
              <button className="qcl-page-btn" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal Popup */}
      {isModalOpen && (
        <div className="qcl-modal-backdrop" onClick={handleCloseModal}>
          <div className="qcl-modal" role="dialog" aria-modal="true" aria-labelledby="qcl-modal-title" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="qcl-modal-header">
              <div className="qcl-modal-title-wrap">
                <div className="qcl-modal-title-icon">
                  <PlusOutlined />
                </div>
                <h2 className="qcl-modal-title" id="qcl-modal-title">
                  {modalMode === 'create' ? 'Tạo danh mục câu hỏi' : 'Cập nhật danh mục câu hỏi'}
                </h2>
              </div>
              <button type="button" className="qcl-modal-close" onClick={handleCloseModal} aria-label="Đóng hộp thoại danh mục">
                <CloseOutlined />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleModalSubmit} className="qcl-modal-form">
              <div className="qcl-modal-row">
                <div className="qcl-modal-group">
                  <label>Mã danh mục</label>
                  <input
                    type="text"
                    className="qcl-input-red"
                    value={modalForm.code}
                    onChange={(e) => updateModalField('code', e.target.value)}
                    placeholder="Tự sinh nếu bỏ trống"
                    disabled={isSaving || modalMode === 'edit'}
                    title={modalMode === 'edit' ? 'Mã danh mục là định danh ổn định và không thể thay đổi' : undefined}
                  />
                </div>
                <div className="qcl-modal-group">
                  <label>
                    Tên danh mục <span className="required-star">*</span>
                  </label>
                  <input
                    type="text"
                    className="qcl-input-red"
                    required
                    value={modalForm.name}
                    onChange={(e) => updateModalField('name', e.target.value)}
                    placeholder="Nhập tên danh mục câu hỏi..."
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="qcl-modal-row">
                <div className="qcl-modal-group">
                  <label>Trạng thái</label>
                  <select
                    className="qcl-input-red"
                    value={modalForm.status}
                    onChange={(e) => updateModalField('status', e.target.value)}
                    disabled={isSaving}
                  >
                    <option value="ACTIVE">Hoạt động</option>
                    <option value="INACTIVE">Tạm ngưng</option>
                  </select>
                </div>
              </div>

              <div className="qcl-modal-group">
                <label>Mô tả chi tiết</label>
                <textarea
                  rows="3"
                  className="qcl-input-red"
                  value={modalForm.description}
                  onChange={(e) => updateModalField('description', e.target.value)}
                  placeholder="Mô tả danh mục kiến thức..."
                  disabled={isSaving}
                />
              </div>

              <div className="qcl-modal-actions">
                <button type="button" className="qcl-btn-cancel" onClick={handleCloseModal} disabled={isSaving}>
                  Hủy
                </button>
                <button type="submit" className="qcl-btn-save" disabled={isSaving}>
                  {isSaving ? 'Đang lưu...' : modalMode === 'create' ? 'Tạo mới' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Archive Modal */}
      {categoryToArchive && (
        <ConfirmModal
          isOpen={true}
          title="Xác nhận lưu trữ danh mục"
          message={`Bạn có chắc chắn muốn lưu trữ danh mục "${categoryToArchive.name}"? Danh mục sau khi lưu trữ sẽ bị ẩn khỏi danh sách chính.`}
          confirmLabel="Lưu trữ"
          cancelLabel="Hủy"
          onConfirm={confirmDeleteCategory}
          onCancel={() => setCategoryToArchive(null)}
        />
      )}
    </AppShell>
  )
}
