import { useState, useMemo, useEffect } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import { SearchOutlined, LeftOutlined, RightOutlined, LoadingOutlined, PlusOutlined, EditOutlined, DeleteOutlined, CloseOutlined } from '@ant-design/icons'
import '../styles/ReferenceDepartmentsListPage.css'

// Generate 248 mock reference departments to match mockup details
const generateMockDepartments = () => {
  const departments = []
  const blockNames = ['Khối Lâm sàng', 'Khối Cận lâm sàng/Chức năng', 'Khối Hành chính']
  const names = [
    'Khoa Thần kinh', 'Khoa Tim mạch', 'Khoa Phẫu thuật tổng hợp', 
    'Phòng Kiểm soát nhiễm khuẩn', 'Khoa Nội tổng hợp', 'Khoa Ngoại chấn thương',
    'Khoa Nhi', 'Khoa Sản', 'Phòng Điều dưỡng', 'Phòng Tổ chức cán bộ'
  ]
  
  for (let i = 0; i < 248; i++) {
    const id = i + 1
    let name = names[i % names.length]
    let block = blockNames[i % blockNames.length]
    let employeeCount = 50 + (i * 12) % 300
    let managerCode = `VD${String(368 + (i % 10)).padStart(5, '0')}`
    
    // Exact mockup matches
    if (i === 0) {
      name = 'Khoa Thần kinh'
      block = 'Khối Lâm sàng'
      employeeCount = 100
      managerCode = 'VD00368'
    } else if (i === 1) {
      name = 'Khoa Tim mạch'
      block = 'Khối Lâm sàng'
      employeeCount = 200
      managerCode = 'VD00368'
    } else if (i === 2) {
      name = 'Khoa Phẫu thuật tổng hợp'
      block = 'Khối Lâm sàng'
      employeeCount = 100
      managerCode = 'VD00368'
    } else if (i === 3) {
      name = 'Phòng Kiểm soát nhiễm khuẩn'
      block = 'Khối Cận lâm sàng/Chức năng'
      employeeCount = 300
      managerCode = 'VD00368'
    }
    
    departments.push({
      id,
      name,
      blockName: block,
      employeeCount,
      managerCode
    })
  }
  return departments
}

function ReferenceDepartmentsListPage() {
  const [apiDepts, setApiDepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [useMock, setUseMock] = useState(false)

  // Filters State
  const [search, setSearch] = useState('')
  const [blockFilter, setBlockFilter] = useState('all')
  const [page, setPage] = useState(1)

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingDept, setEditingDept] = useState(null) // null = Create, object = Edit
  const [formDeptCode, setFormDeptCode] = useState('')
  const [formDeptName, setFormDeptName] = useState('')

  const mockDatabase = useMemo(() => generateMockDepartments(), [])

  const loadDepartments = () => {
    setLoading(true)
    adminApi.getDepartments()
      .then(res => {
        const list = res.data?.data
        if (list && list.length > 0) {
          // Enrich backend data with additional mockup columns
          const enriched = list.map((dept, index) => {
            const blockNames = ['Khối Lâm sàng', 'Khối Cận lâm sàng/Chức năng', 'Khối Hành chính']
            return {
              id: dept.id,
              name: dept.name,
              departmentCode: dept.departmentCode || `DEPT-${dept.id}`,
              blockName: blockNames[index % blockNames.length],
              employeeCount: 50 + (index * 25) % 250,
              managerCode: `VD${String(368 + (index % 5)).padStart(5, '0')}`
            }
          })
          setApiDepts(enriched)
          setUseMock(false)
        } else {
          setUseMock(true)
        }
      })
      .catch(err => {
        console.warn('GET /departments API failed. Falling back to mock departments.', err)
        setUseMock(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  // Fetch departments from backend or fallback
  useEffect(() => {
    loadDepartments()
  }, [])

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
      alert('Vui lòng nhập đầy đủ Mã và Tên phòng ban.')
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
          alert('Cập nhật phòng ban thành công!')
          setIsModalOpen(false)
          loadDepartments()
        })
        .catch(err => {
          console.error(err)
          alert(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật phòng ban.')
        })
    } else {
      // Create
      adminApi.createDepartment(payload)
        .then(() => {
          alert('Tạo phòng ban thành công!')
          setIsModalOpen(false)
          loadDepartments()
        })
        .catch(err => {
          console.error(err)
          alert(err.response?.data?.message || 'Có lỗi xảy ra khi tạo phòng ban.')
        })
    }
  }

  const handleDeleteDept = (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa phòng ban này? Hành động này không thể hoàn tác.')) {
      adminApi.deleteDepartment(id)
        .then(() => {
          alert('Xóa phòng ban thành công!')
          loadDepartments()
        })
        .catch(err => {
          console.error(err)
          alert(err.response?.data?.message || 'Không thể xóa phòng ban này.')
        })
    }
  }

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [search, blockFilter])

  // Select database
  const activeDatabase = useMemo(() => {
    return useMock ? mockDatabase : apiDepts
  }, [useMock, mockDatabase, apiDepts])

  // Apply filters
  const filteredDepartments = useMemo(() => {
    return activeDatabase.filter(dept => {
      const matchSearch = dept.name.toLowerCase().includes(search.toLowerCase())
      const matchBlock = blockFilter === 'all' || dept.blockName === blockFilter
      return matchSearch && matchBlock
    })
  }, [activeDatabase, search, blockFilter])

  // Pagination
  const PAGE_SIZE = 10
  const totalElements = filteredDepartments.length
  const totalPages = Math.ceil(totalElements / PAGE_SIZE)
  const paginatedDepartments = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE
    return filteredDepartments.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredDepartments, page])

  const breadcrumbs = [
    { label: 'Danh sách phòng ban gốc' }
  ]

  // Extract unique blocks for select dropdown
  const blockOptions = useMemo(() => {
    const blocks = new Set()
    activeDatabase.forEach(d => {
      if (d.blockName) blocks.add(d.blockName)
    })
    return Array.from(blocks)
  }, [activeDatabase])

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="rdl-page">
              
              {/* Title Card */}
              <div className="rdl-title-card">
                <h1 className="rdl-title">Danh sách khoa/phòng ban gốc</h1>
                <p className="rdl-subtitle">Quản lý danh mục các khoa/phòng ban gốc trong hệ thống</p>
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

                <select
                  className="rdl-filter-select"
                  value={blockFilter}
                  onChange={(e) => setBlockFilter(e.target.value)}
                >
                  <option value="all">Khối</option>
                  {blockOptions.map(block => (
                    <option key={block} value={block}>{block}</option>
                  ))}
                </select>

                <span className="rdl-results-count">{totalElements} kết quả</span>
                
                <button className="rdl-btn-primary" onClick={handleOpenCreateModal}>
                  <PlusOutlined /> Thêm phòng ban
                </button>
              </div>

              {/* Table Card */}
              <div className="rdl-table-card">
                <table className="rdl-table">
                  <thead>
                    <tr>
                      <th style={{ width: '10%' }}>ID</th>
                      <th style={{ width: '15%' }}>Mã Code</th>
                      <th style={{ width: '30%' }}>Tên phòng ban</th>
                      <th style={{ width: '20%' }}>Khối</th>
                      <th style={{ width: '13%' }}>Nhân viên</th>
                      <th style={{ width: '12%', textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                          <LoadingOutlined style={{ marginRight: 8 }} /> Đang tải danh sách phòng ban gốc...
                        </td>
                      </tr>
                    ) : paginatedDepartments.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                          Không tìm thấy phòng ban gốc phù hợp.
                        </td>
                      </tr>
                    ) : (
                      paginatedDepartments.map(dept => (
                        <tr key={dept.id}>
                          <td><span className="rdl-dept-code">{dept.id}</span></td>
                          <td><strong>{dept.departmentCode || '-'}</strong></td>
                          <td><strong>{dept.name}</strong></td>
                          <td>{dept.blockName}</td>
                          <td>{dept.employeeCount}</td>
                          <td>
                            <div className="rdl-actions-cell" style={{ justifyContent: 'center' }}>
                              <button className="rdl-btn-secondary" onClick={() => handleOpenEditModal(dept)}>
                                <EditOutlined /> Sửa
                              </button>
                              <button className="rdl-btn-danger" onClick={() => handleDeleteDept(dept.id)}>
                                <DeleteOutlined /> Xoá
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
                    <span>
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

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                        <button
                          key={n}
                          className={`rdl-pn ${n === page ? 'rdl-pn--active' : ''}`}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </button>
                      ))}

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
          </main>
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
    </div>
  )
}

export default ReferenceDepartmentsListPage
