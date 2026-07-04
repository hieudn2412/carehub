import React, { useCallback, useEffect, useMemo, useState } from 'react'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { SearchOutlined, EditOutlined, DeleteOutlined, PlusCircleOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons'
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
  sortOrder: 0,
}

function QuestionCategoryListPage() {
  const { showToast } = useToast()
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' or 'edit'
  const [modalForm, setModalForm] = useState(EMPTY_FORM)

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

  const filteredCategories = useMemo(() => categories.filter((item) => {
    const matchesKeyword =
      item.name.toLowerCase().includes(keyword.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(keyword.toLowerCase()) ||
      (item.code || '').toLowerCase().includes(keyword.toLowerCase())
    const matchesStatus = status === '' || item.status === status
    return matchesKeyword && matchesStatus
  }), [categories, keyword, status])

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
      showToast('Tên danh mục không được để trống.', 'warning')
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
        await questionCategoryApi.createCategory(payload)
      } else {
        await questionCategoryApi.updateCategory(modalForm.id, payload)
      }
      showToast(modalMode === 'create' ? 'Đã tạo danh mục câu hỏi.' : 'Đã cập nhật danh mục câu hỏi.', 'success')
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
    questionCategoryApi.archiveCategory(item.id)
      .then(() => {
        showToast('Đã lưu trữ danh mục câu hỏi.', 'success')
        loadCategories()
      })
      .catch((error) => showToast(apiErrorMessage(error), 'error'))
  }

  const breadcrumbs = [{ label: 'Danh mục câu hỏi' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qcl-page">
              {/* Title Card */}
              <div className="qcl-title-card">
                <h1 className="qcl-title">Danh mục câu hỏi</h1>
                <p className="qcl-subtitle">
                  Quản lý các danh mục câu hỏi theo chủ đề và mục tiêu đánh giá
                </p>
              </div>

              {/* Filter Bar */}
              <div className="qcl-filter-bar">
                <div className="qcl-filter-left">
                  <div className="qcl-search">
                    <span className="qcl-search-icon">
                      <SearchOutlined />
                    </span>
                    <input
                      type="text"
                      className="qcl-search-input"
                      placeholder="Tìm danh mục..."
                      value={keyword}
                      onChange={(e) => {
                        setKeyword(e.target.value)
                        setPage(0)
                      }}
                    />
                  </div>

                  <select
                    className="qcl-filter-select"
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

                <button className="qcl-btn-add" onClick={handleOpenCreateModal}>
                  <PlusCircleOutlined /> Thêm danh mục
                </button>
              </div>

              {/* Table Card */}
              <div className="qcl-table-card">
                <table className="qcl-table">
                  <thead>
                    <tr>
                      <th>Tên danh mục</th>
                      <th>Mô tả</th>
                      <th>Số câu hỏi</th>
                      <th>Trạng thái</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                          Đang tải danh mục câu hỏi...
                        </td>
                      </tr>
                    ) : displayRows.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                          Không tìm thấy danh mục câu hỏi nào.
                        </td>
                      </tr>
                    ) : (
                      displayRows.map((item) => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                          <td style={{ color: '#475569' }}>{item.description || '-'}</td>
                          <td style={{ fontWeight: 600, color: '#334155' }}>{item.questionCount || 0}</td>
                          <td>
                            <span className={`qcl-badge ${item.status === 'ACTIVE' ? 'qcl-badge--active' : 'qcl-badge--inactive'}`}>
                              {item.statusText || (item.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ngưng')}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="qcl-action-btn qcl-action-btn--edit"
                                onClick={() => handleOpenEditModal(item)}
                                title="Chỉnh sửa"
                              >
                                <EditOutlined />
                              </button>
                              <button
                                type="button"
                                className="qcl-action-btn qcl-action-btn--delete"
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

                {/* Pagination Footer */}
                <div className="qcl-pagination-bar">
                  <div className="qcl-pagination-info">
                    Hiển thị {displayRows.length} trong tổng số {totalElements} kết quả
                  </div>
                  <div className="qcl-pagination-buttons">
                    <button
                      className="qcl-page-btn"
                      disabled={page <= 0}
                      onClick={() => setPage(page - 1)}
                    >
                      &lt;
                    </button>
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        className={`qcl-page-btn ${page === idx ? 'qcl-page-btn--active' : ''}`}
                        onClick={() => setPage(idx)}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    <button
                      className="qcl-page-btn"
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

      {/* Add / Edit Modal Popup */}
      {isModalOpen && (
        <div className="qcl-modal-backdrop" onClick={handleCloseModal}>
          <div className="qcl-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="qcl-modal-header">
              <div className="qcl-modal-title-wrap">
                <div className="qcl-modal-title-icon">
                  <PlusOutlined />
                </div>
                <h2 className="qcl-modal-title">
                  {modalMode === 'create' ? 'Tạo danh mục câu hỏi' : 'Cập nhật danh mục câu hỏi'}
                </h2>
              </div>
              <button className="qcl-modal-close" onClick={handleCloseModal}>
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
                    disabled={isSaving}
                  />
                </div>
                <div className="qcl-modal-group">
                  <label>Tên danh mục <span className="required-star">*</span></label>
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
                <div className="qcl-modal-group">
                  <label>Thứ tự hiển thị</label>
                  <input
                    type="number"
                    className="qcl-input-green"
                    value={modalForm.sortOrder}
                    onChange={(e) => updateModalField('sortOrder', e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="qcl-modal-group">
                <label>Mô tả</label>
                <textarea
                  className="qcl-textarea-green"
                  rows={3}
                  value={modalForm.description}
                  onChange={(e) => updateModalField('description', e.target.value)}
                  placeholder="Nhập mô tả tóm tắt..."
                  disabled={isSaving}
                />
              </div>

              {/* Modal Actions */}
              <div className="qcl-modal-actions">
                <button type="submit" className="qcl-btn-save" disabled={isSaving}>
                  {isSaving ? 'Đang lưu...' : 'Lưu'}
                </button>
                <button type="button" className="qcl-btn-cancel" onClick={handleCloseModal} disabled={isSaving}>
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

export default QuestionCategoryListPage
