import React, { useCallback, useEffect, useMemo, useState } from 'react'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { SearchOutlined, EditOutlined, DeleteOutlined, PlusCircleOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { questionSetCategoryApi } from '../api/questionSetCategoryApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/QuestionSetCategoryListPage.css'

const EMPTY_FORM = {
  id: null,
  code: '',
  name: '',
  description: '',
  status: 'ACTIVE',
  sortOrder: 0,
}

function QuestionSetCategoryListPage() {
  const { showToast } = useToast()
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create')
  const [modalForm, setModalForm] = useState(EMPTY_FORM)

  const loadCategories = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await questionSetCategoryApi.listCategories({ status: '' })
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

  const filteredCategories = useMemo(() => categories.filter((item) => {
    const matchesKeyword =
      item.name.toLowerCase().includes(keyword.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(keyword.toLowerCase()) ||
      (item.code || '').toLowerCase().includes(keyword.toLowerCase())
    const matchesStatus = status === '' || item.status === status
    return matchesKeyword && matchesStatus
  }), [categories, keyword, status])

  const pageSize = 10
  const totalElements = filteredCategories.length
  const totalPages = Math.ceil(totalElements / pageSize) || 1
  const displayRows = filteredCategories.slice(page * pageSize, (page + 1) * pageSize)

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
      sortOrder: item.sortOrder || 0,
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
      showToast('Tên danh mục bộ câu hỏi không được để trống.', 'warning')
      return
    }

    const payload = {
      code: modalForm.code.trim() || null,
      name: modalForm.name.trim(),
      description: modalForm.description.trim(),
      status: modalForm.status,
      sortOrder: Number(modalForm.sortOrder) || 0,
    }

    setIsSaving(true)
    try {
      if (modalMode === 'create') {
        await questionSetCategoryApi.createCategory(payload)
      } else {
        await questionSetCategoryApi.updateCategory(modalForm.id, payload)
      }
      showToast(modalMode === 'create' ? 'Đã tạo danh mục bộ câu hỏi.' : 'Đã cập nhật danh mục bộ câu hỏi.', 'success')
      handleCloseModal()
      loadCategories()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteCategory = (item) => {
    if (!window.confirm(`Lưu trữ danh mục "${item.name}"?`)) {
      return
    }
    questionSetCategoryApi.archiveCategory(item.id)
      .then(() => {
        showToast('Đã lưu trữ danh mục bộ câu hỏi.', 'success')
        loadCategories()
      })
      .catch((error) => showToast(apiErrorMessage(error), 'error'))
  }

  const breadcrumbs = [{ label: 'Danh mục bộ câu hỏi' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qscl-page">
              <div className="qscl-title-card">
                <h1 className="qscl-title">Danh mục bộ câu hỏi</h1>
                <p className="qscl-subtitle">
                  Quản lý các danh mục dùng để phân loại bộ câu hỏi
                </p>
              </div>

              <div className="qscl-filter-bar">
                <div className="qscl-filter-left">
                  <div className="qscl-search">
                    <span className="qscl-search-icon">
                      <SearchOutlined />
                    </span>
                    <input
                      type="text"
                      className="qscl-search-input"
                      placeholder="Tìm danh mục..."
                      value={keyword}
                      onChange={(e) => {
                        setKeyword(e.target.value)
                        setPage(0)
                      }}
                    />
                  </div>

                  <select
                    className="qscl-filter-select"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value)
                      setPage(0)
                    }}
                  >
                    <option value="">Trạng thái</option>
                    <option value="ACTIVE">Hoạt động</option>
                    <option value="INACTIVE">Tạm ngưng</option>
                    <option value="ARCHIVED">Đã lưu trữ</option>
                  </select>
                </div>

                <button className="qscl-btn-add" onClick={handleOpenCreateModal}>
                  <PlusCircleOutlined /> Thêm danh mục
                </button>
              </div>

              <div className="qscl-table-card">
                <table className="qscl-table">
                  <thead>
                    <tr>
                      <th>Tên danh mục</th>
                      <th>Mô tả</th>
                      <th>Thứ tự</th>
                      <th>Trạng thái</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                          Đang tải danh mục bộ câu hỏi...
                        </td>
                      </tr>
                    ) : displayRows.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                          Không tìm thấy danh mục bộ câu hỏi nào.
                        </td>
                      </tr>
                    ) : (
                      displayRows.map((item) => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                          <td style={{ color: '#475569' }}>{item.description || '-'}</td>
                          <td style={{ fontWeight: 600, color: '#334155' }}>{item.sortOrder || 0}</td>
                          <td>
                            <span className={`qscl-badge ${item.status === 'ACTIVE' ? 'qscl-badge--active' : 'qscl-badge--inactive'}`}>
                              {item.statusText || (item.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ngưng')}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="qscl-action-btn qscl-action-btn--edit"
                                onClick={() => handleOpenEditModal(item)}
                                title="Chỉnh sửa"
                              >
                                <EditOutlined />
                              </button>
                              <button
                                type="button"
                                className="qscl-action-btn qscl-action-btn--delete"
                                onClick={() => handleDeleteCategory(item)}
                                title="Lưu trữ"
                                disabled={item.status === 'ARCHIVED'}
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

                <div className="qscl-pagination-bar">
                  <div className="qscl-pagination-info">
                    Hiển thị {displayRows.length} trong tổng số {totalElements} kết quả
                  </div>
                  <div className="qscl-pagination-buttons">
                    <button
                      className="qscl-page-btn"
                      disabled={page <= 0}
                      onClick={() => setPage(page - 1)}
                    >
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
                        buttons.push(<button key={0} className={`qscl-page-btn ${page === 0 ? 'qscl-page-btn--active' : ''}`} onClick={() => setPage(0)}>1</button>)
                        if (start > 1) buttons.push(<span key="se" className="qscl-page-ellipsis">&hellip;</span>)
                      }
                      for (let i = start; i < end; i++) {
                        buttons.push(<button key={i} className={`qscl-page-btn ${page === i ? 'qscl-page-btn--active' : ''}`} onClick={() => setPage(i)}>{i + 1}</button>)
                      }
                      if (end < totalPages) {
                        if (end < totalPages - 1) buttons.push(<span key="ee" className="qscl-page-ellipsis">&hellip;</span>)
                        buttons.push(<button key={totalPages - 1} className={`qscl-page-btn ${page === totalPages - 1 ? 'qscl-page-btn--active' : ''}`} onClick={() => setPage(totalPages - 1)}>{totalPages}</button>)
                      }
                      return buttons
                    })()}
                    <button
                      className="qscl-page-btn"
                      disabled={page + 1 >= totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {isModalOpen && (
        <div className="qscl-modal-backdrop" onClick={handleCloseModal}>
          <div className="qscl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qscl-modal-header">
              <div className="qscl-modal-title-wrap">
                <div className="qscl-modal-title-icon">
                  <PlusOutlined />
                </div>
                <h2 className="qscl-modal-title">
                  {modalMode === 'create' ? 'Tạo danh mục bộ câu hỏi' : 'Cập nhật danh mục bộ câu hỏi'}
                </h2>
              </div>
              <button className="qscl-modal-close" onClick={handleCloseModal}>
                <CloseOutlined />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="qscl-modal-form">
              <div className="qscl-modal-row">
                <div className="qscl-modal-group">
                  <label>Mã danh mục</label>
                  <input
                    type="text"
                    className="qscl-input-red"
                    value={modalForm.code}
                    onChange={(e) => updateModalField('code', e.target.value)}
                    placeholder="Tự sinh nếu bỏ trống"
                    disabled={isSaving}
                  />
                </div>
                <div className="qscl-modal-group">
                  <label>Tên danh mục <span className="required-star">*</span></label>
                  <input
                    type="text"
                    className="qscl-input-red"
                    required
                    value={modalForm.name}
                    onChange={(e) => updateModalField('name', e.target.value)}
                    placeholder="Nhập tên danh mục bộ câu hỏi..."
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="qscl-modal-row">
                <div className="qscl-modal-group">
                  <label>Trạng thái</label>
                  <select
                    className="qscl-input-red"
                    value={modalForm.status}
                    onChange={(e) => updateModalField('status', e.target.value)}
                    disabled={isSaving}
                  >
                    <option value="ACTIVE">Hoạt động</option>
                    <option value="INACTIVE">Tạm ngưng</option>
                  </select>
                </div>
                <div className="qscl-modal-group">
                  <label>Thứ tự hiển thị</label>
                  <input
                    type="number"
                    className="qscl-input-green"
                    value={modalForm.sortOrder}
                    onChange={(e) => updateModalField('sortOrder', e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="qscl-modal-group">
                <label>Mô tả</label>
                <textarea
                  className="qscl-textarea-green"
                  rows={3}
                  value={modalForm.description}
                  onChange={(e) => updateModalField('description', e.target.value)}
                  placeholder="Nhập mô tả tóm tắt..."
                  disabled={isSaving}
                />
              </div>

              <div className="qscl-modal-actions">
                <button type="submit" className="qscl-btn-save" disabled={isSaving}>
                  {isSaving ? 'Đang lưu...' : 'Lưu'}
                </button>
                <button type="button" className="qscl-btn-cancel" onClick={handleCloseModal} disabled={isSaving}>
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

export default QuestionSetCategoryListPage
