import { useCallback, useState, useMemo, useEffect } from 'react'
import AppShell from '../../../shared/components/AppShell.jsx'
import LoadingState from '../../../shared/components/LoadingState.jsx'
import { adminApi } from '../api/adminApi'
import { SearchOutlined, LeftOutlined, RightOutlined, PlusOutlined, EditOutlined, DeleteOutlined, CloseOutlined } from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import '../styles/ReferenceDepartmentsListPage.css'

function ReferenceDepartmentsListPage() {
  const { showToast } = useToast()
  const [apiDepts, setApiDepts] = useState([])
  const [loading, setLoading] = useState(true)

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    id: null
  })

  // Filters State
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDept, setEditingDept] = useState(null) // null = Create, object = Edit
  const [formDeptCode, setFormDeptCode] = useState('')
  const [formDeptName, setFormDeptName] = useState('')

  const loadDepartments = useCallback(() => {
    setLoading(true)
    adminApi.getDepartments()
      .then(res => {
        const list = res.data?.data
        const departments = Array.isArray(list) ? list : []
        setApiDepts(departments.map(dept => ({
          ...dept,
          employeeCount: Number(dept.employeeCount) || 0,
        })))
      })
      .catch(err => {
        console.error('GET /departments API failed.', err)
        setApiDepts([])
        showToast(err?.response?.data?.message || 'Không thể tải danh sách phòng ban.', 'error')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [showToast])

  // Fetch departments from backend
  useEffect(() => {

    loadDepartments()
  }, [loadDepartments])

  // Action handlers
  const handleOpenCreateModal = () => {
    setFormDeptCode('')
    setFormDeptName('')
    setEditingDept(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (dept) => {
    setFormDeptCode(dept.departmentCode || '')
    setFormDeptName(dept.name || '')
    setEditingDept(dept)
    setIsModalOpen(true)
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (!formDeptCode.trim() || !formDeptName.trim()) {
      showToast('Vui lòng nhập đầy đủ Mã và Tên phòng ban.', 'warning')
      return
    }

    const payload = {
      departmentCode: formDeptCode.trim().toUpperCase(),
      name: formDeptName.trim()
    }

    if (editingDept) {
      // Update
      adminApi.updateDepartment(editingDept.id, payload)
        .then(() => {
          showToast('Cập nhật phòng ban thành công!', 'success')
          setIsModalOpen(false)
          loadDepartments()
        })
        .catch(err => {
          console.error(err)
          showToast(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật phòng ban.', 'error')
        })
    } else {
      // Create
      adminApi.createDepartment(payload)
        .then(() => {
          showToast('Tạo phòng ban thành công!', 'success')
          setIsModalOpen(false)
          loadDepartments()
        })
        .catch(err => {
          console.error(err)
          showToast(err.response?.data?.message || 'Có lỗi xảy ra khi tạo phòng ban.', 'error')
        })
    }
  }

  const handleDeleteDept = (id) => {
    setConfirmModal({
      isOpen: true,
      id
    })
  }

  const executeDeleteDept = (id) => {
    adminApi.deleteDepartment(id)
      .then(() => {
        showToast('Xóa phòng ban thành công!', 'success')
        loadDepartments()
      })
      .catch(err => {
        console.error(err)
        showToast(err.response?.data?.message || 'Không thể xóa phòng ban này.', 'error')
      })
  }

  // Reset page when filters change
  useEffect(() => {

    setPage(1)
  }, [search])

  // Apply filters
  const filteredDepartments = useMemo(() => {
    return apiDepts.filter(dept => {
      const matchSearch = dept.name.toLowerCase().includes(search.toLowerCase())
      return matchSearch
    })
  }, [apiDepts, search])

  // Pagination
  const PAGE_SIZE = 10
  const totalElements = filteredDepartments.length
  const totalPages = Math.ceil(totalElements / PAGE_SIZE)
  const paginatedDepartments = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE
    return filteredDepartments.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredDepartments, page])

  const breadcrumbs = [
    { label: 'Danh mục phòng ban' }
  ]

  // Generate pagination buttons array with ellipsis for clean design
  const getVisiblePages = () => {
    const pages = []
    const range = 1
    pages.push(1)
    if (page - range > 2) {
      pages.push('...')
    }
    const start = Math.max(2, page - range)
    const end = Math.min(totalPages - 1, page + range)
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    if (page + range < totalPages - 1) {
      pages.push('...')
    }
    if (totalPages > 1) {
      pages.push(totalPages)
    }
    return pages
  }

  return (
    <AppShell breadcrumbs={breadcrumbs}>
            <div className="rdl-page">

              {/* Title Card */}
              <div className="rdl-title-card">
                <h1 className="rdl-title">Danh mục phòng ban</h1>
                <p className="rdl-subtitle">Quản lý danh mục các khoa/phòng ban trong hệ thống</p>
              </div>

              {/* Filter Bar */}
              <div className="rdl-filter-bar">
                <div className="rdl-search-wrapper">
                  <span className="rdl-search-icon">
                    <SearchOutlined />
                  </span>
                  <input
                    type="text"
                    className="rdl-search-input"
                    placeholder="Tìm theo tên phòng ban/khoa..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <span className="rdl-results-count">{totalElements} kết quả</span>

                <button className="rdl-btn-primary" onClick={handleOpenCreateModal}>
                  <PlusOutlined /> Thêm phòng ban
                </button>
              </div>

              {/* Table Card */}
              <div className="rdl-table-card">
                <table className="rdl-table admin-table-uppercase">
                  <thead>
                    <tr>
                      <th style={{ width: '10%' }}>ID</th>
                      <th style={{ width: '18%' }}>Mã Code</th>
                      <th style={{ width: '38%' }}>Tên phòng ban</th>
                      <th style={{ width: '14%' }}>Nhân viên</th>
                      <th style={{ width: '20%' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="5">
                          <LoadingState label="Đang tải danh mục phòng ban..." />
                        </td>
                      </tr>
                    ) : paginatedDepartments.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="ch-empty">
                          Không tìm thấy phòng ban phù hợp.
                        </td>
                      </tr>
                    ) : (
                      paginatedDepartments.map(dept => (
                        <tr key={dept.id}>
                          <td><span className="rdl-dept-code">{dept.id}</span></td>
                          <td><strong>{dept.departmentCode || '-'}</strong></td>
                          <td><strong>{dept.name}</strong></td>
                          <td>{dept.employeeCount}</td>
                          <td>
                            <div className="rdl-actions-cell admin-table-actions">
                              <button
                                aria-label={`Chỉnh sửa phòng ban ${dept.name}`}
                                className="rdl-btn-secondary admin-table-action admin-table-action--icon admin-table-action--primary"
                                onClick={() => handleOpenEditModal(dept)}
                                title="Chỉnh sửa"
                                type="button"
                              >
                                <EditOutlined />
                              </button>
                              <button
                                aria-label={`Xóa phòng ban ${dept.name}`}
                                className="rdl-btn-danger admin-table-action admin-table-action--icon admin-table-action--danger"
                                onClick={() => handleDeleteDept(dept.id)}
                                title="Xóa"
                                type="button"
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
                {!loading && totalElements > 0 && (
                  <div className="rdl-pagination">
                    <span className="rdl-pagination-info">
                      Hiển thị {paginatedDepartments.length} trong tổng số {totalElements} kết quả
                    </span>
                    <div className="rdl-page-nums">
                      <button
                        className="rdl-pn"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <LeftOutlined />
                      </button>

                      {getVisiblePages().map((n, idx) => {
                        if (n === '...') {
                          return (
                            <span key={`dots-${idx}`} className="rdl-pn-dots">
                              ...
                            </span>
                          )
                        }
                        return (
                          <button
                            key={n}
                            className={`rdl-pn ${n === page ? 'rdl-pn--active' : ''}`}
                            onClick={() => setPage(n)}
                          >
                            {n}
                          </button>
                        )
                      })}

                      <button
                        className="rdl-pn"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || totalPages === 0}
                      >
                        <RightOutlined />
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="rdl-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="rdl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rdl-modal-header">
              <h3 className="rdl-modal-title">
                {editingDept ? 'Chỉnh sửa phòng ban' : 'Thêm phòng ban mới'}
              </h3>
              <button className="rdl-modal-close" onClick={() => setIsModalOpen(false)}>
                <CloseOutlined />
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="rdl-modal-body">
                <div className="rdl-form-group">
                  <label className="rdl-form-label">Mã Code phòng ban *</label>
                  <input
                    type="text"
                    className="rdl-form-input"
                    placeholder="VD: K-TIMMACH"
                    value={formDeptCode}
                    onChange={(e) => setFormDeptCode(e.target.value)}
                    required
                  />
                </div>

                <div className="rdl-form-group">
                  <label className="rdl-form-label">Tên khoa/phòng ban *</label>
                  <input
                    type="text"
                    className="rdl-form-input"
                    placeholder="VD: Khoa Tim mạch"
                    value={formDeptName}
                    onChange={(e) => setFormDeptName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="rdl-modal-footer">
                <button type="button" className="rdl-modal-btn" onClick={() => setIsModalOpen(false)}>
                  Huỷ
                </button>
                <button type="submit" className="rdl-btn-primary" style={{ borderRadius: '8px' }}>
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Xóa phòng ban"
        message="Bạn có chắc chắn muốn xóa phòng ban này? Hành động này không thể hoàn tác."
        danger={true}
        onConfirm={() => {
          executeDeleteDept(confirmModal.id)
          setConfirmModal({ isOpen: false, id: null })
        }}
        onCancel={() => setConfirmModal({ isOpen: false, id: null })}
      />
    </AppShell>
  )
}

export default ReferenceDepartmentsListPage
