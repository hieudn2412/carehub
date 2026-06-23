import React, { useState } from 'react'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { SearchOutlined, EditOutlined, DeleteOutlined, PlusCircleOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons'
import '../styles/QuestionCategoryListPage.css'

const INITIAL_CATEGORIES = [
  { id: 1, name: 'Kiểm soát nhiễm khuẩn', description: 'Vệ sinh tay, trang thiết bị bảo hộ cá nhân (PPE), kỹ thuật vô trùng', questions: 24, active: true },
  { id: 2, name: 'An toàn sử dụng thuốc', description: 'Cấp phát thuốc, nguyên tắc 6 đúng trong sử dụng thuốc', questions: 18, active: false },
  { id: 3, name: 'An toàn người bệnh', description: 'Phòng ngừa té ngã, nhận diện chính xác bệnh nhân', questions: 15, active: true },
  { id: 4, name: 'Quy trình lâm sàng', description: 'Kỹ thuật tiêm truyền tĩnh mạch, chăm sóc vết thương, đặt ống thông tiểu', questions: 30, active: true },
]

const EMPTY_FORM = {
  id: null,
  name: '',
  description: '',
  questions: 0,
  active: true,
}

function QuestionCategoryListPage() {
  const [categories, setCategories] = useState(INITIAL_CATEGORIES)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('') // '', 'true', 'false'
  const [page, setPage] = useState(0)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' or 'edit'
  const [modalForm, setModalForm] = useState(EMPTY_FORM)

  // Filter Logic (Local Memory)
  const filteredCategories = categories.filter((item) => {
    const matchesKeyword =
      item.name.toLowerCase().includes(keyword.toLowerCase()) ||
      item.description.toLowerCase().includes(keyword.toLowerCase())
    const matchesStatus =
      status === '' ? true : status === 'true' ? item.active : !item.active
    return matchesKeyword && matchesStatus
  })

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
      name: item.name,
      description: item.description,
      questions: item.questions,
      active: item.active,
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

  const handleModalSubmit = (e) => {
    e.preventDefault()

    if (modalForm.name.trim() === '') {
      alert('Tên danh mục không được để trống!')
      return
    }

    if (modalMode === 'create') {
      const newCategory = {
        id: Date.now(),
        name: modalForm.name,
        description: modalForm.description,
        questions: Number(modalForm.questions) || 0,
        active: modalForm.active,
      }
      setCategories((prev) => [newCategory, ...prev])
    } else {
      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === modalForm.id
            ? {
                ...cat,
                name: modalForm.name,
                description: modalForm.description,
                questions: Number(modalForm.questions) || 0,
                active: modalForm.active,
              }
            : cat
        )
      )
    }

    handleCloseModal()
  }

  const handleDeleteCategory = (item) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa danh mục "${item.name}" không?`)) {
      return
    }
    setCategories((prev) => prev.filter((cat) => cat.id !== item.id))
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
                    <option value="true">Hoạt động</option>
                    <option value="false">Ngưng hoạt động</option>
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
                    {displayRows.length === 0 ? (
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
                          <td style={{ fontWeight: 600, color: '#334155' }}>{item.questions}</td>
                          <td>
                            <span className={`qcl-badge ${item.active ? 'qcl-badge--active' : 'qcl-badge--inactive'}`}>
                              {item.active ? 'Hoạt động' : 'Ngưng'}
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
                                title="Xóa"
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
                  <label>Tên danh mục <span className="required-star">*</span></label>
                  <input
                    type="text"
                    className="qcl-input-red"
                    required
                    value={modalForm.name}
                    onChange={(e) => updateModalField('name', e.target.value)}
                    placeholder="Nhập tên danh mục câu hỏi..."
                  />
                </div>
                <div className="qcl-modal-group">
                  <label>Trạng thái</label>
                  <select
                    className="qcl-input-red"
                    value={modalForm.active.toString()}
                    onChange={(e) => updateModalField('active', e.target.value === 'true')}
                  >
                    <option value="true">Hoạt động</option>
                    <option value="false">Ngưng hoạt động</option>
                  </select>
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
                />
              </div>

              <div className="qcl-modal-row">
                <div className="qcl-modal-group" style={{ gridColumn: 'span 2' }}>
                  <label>Số lượng câu hỏi (tùy chọn)</label>
                  <input
                    type="number"
                    className="qcl-input-green"
                    min="0"
                    value={modalForm.questions}
                    onChange={(e) => updateModalField('questions', e.target.value)}
                    placeholder="Ví dụ: 10"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="qcl-modal-actions">
                <button type="submit" className="qcl-btn-save">
                  Lưu
                </button>
                <button type="button" className="qcl-btn-cancel" onClick={handleCloseModal}>
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
