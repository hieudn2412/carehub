import { useState, useEffect } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import {
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  LeftOutlined,
  RightOutlined,
  CloseOutlined,
  LoadingOutlined,
  PlusOutlined,
  UploadOutlined,
  EditOutlined,
  LockOutlined,
  UnlockOutlined,
  DeleteOutlined,
  KeyOutlined
} from '@ant-design/icons'
import '../styles/AdminAccountsScreen.css'

function AdminAccountsScreen() {
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [roles, setRoles] = useState([])
  
  const [loading, setLoading] = useState(true)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

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

  // Filters State
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Selected User Detail Modal State
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [selectedUserDetail, setSelectedUserDetail] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)

  // Form Modal (Create / Edit) State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null) // null = Create, user object = Edit
  
  // Reference lists
  const [positions, setPositions] = useState([])
  const [educationLevels, setEducationLevels] = useState([])

  // Form Fields State
  const [formEmpCode, setFormEmpCode] = useState('')
  const [formFullName, setFormFullName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formDeptId, setFormDeptId] = useState('')
  const [formPositionId, setFormPositionId] = useState('')
  const [formEduLevelId, setFormEduLevelId] = useState('')
  const [formBirthday, setFormBirthday] = useState('')
  const [formGender, setFormGender] = useState(true) // true = Nam, false = Nữ
  const [formRoleIds, setFormRoleIds] = useState([]) // Array of selected role IDs
  const [formStatus, setFormStatus] = useState('ACTIVE')

  // Password reset success banner state
  const [newGeneratedPassword, setNewGeneratedPassword] = useState(null)

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState(null)

  // Debounce search keyword
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 500)
    return () => clearTimeout(handler)
  }, [search])

  // Load static reference data on mount
  useEffect(() => {
    adminApi.getDepartments()
      .then(res => setDepartments(res.data?.data || []))
      .catch(err => console.error('Lỗi khi tải phòng ban:', err))

    adminApi.getRoles()
      .then(res => setRoles(res.data?.data || []))
      .catch(err => console.error('Lỗi khi tải vai trò:', err))

    adminApi.getPositions()
      .then(res => setPositions(res.data?.data || []))
      .catch(err => console.error('Lỗi khi tải chức danh:', err))

    adminApi.getEducationLevels()
      .then(res => setEducationLevels(res.data?.data || []))
      .catch(err => console.error('Lỗi khi tải trình độ học vấn:', err))
  }, [])

  const loadUsers = () => {
    setLoading(true)
    const params = {
      page: page - 1,
      size: 10,
      keyword: debouncedSearch || undefined,
      departmentId: deptFilter !== 'all' ? deptFilter : undefined,
      roleId: roleFilter !== 'all' ? roleFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }

    adminApi.getUsers(params)
      .then(res => {
        const data = res.data?.data
        setUsers(data?.content || [])
        setTotalElements(data?.totalElements || 0)
        setTotalPages(data?.totalPages || 0)
      })
      .catch(err => {
        console.error('Lỗi khi tải danh sách người dùng:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  // Load user data on filter changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, deptFilter, roleFilter, statusFilter])

  // Load detail data when select user changes
  useEffect(() => {
    if (!selectedUserId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedUserDetail(null)
      setNewGeneratedPassword(null)
      return
    }
    setModalLoading(true)
    adminApi.getUserById(selectedUserId)
      .then(res => {
        setSelectedUserDetail(res.data?.data)
      })
      .catch(err => {
        console.error('Lỗi khi tải chi tiết người dùng:', err)
        alert('Không thể tải thông tin chi tiết nhân viên.')
        setSelectedUserId(null)
      })
      .finally(() => {
        setModalLoading(false)
      })
  }, [selectedUserId])

  // Actions
  const handleOpenCreateModal = () => {
    setFormEmpCode('')
    setFormFullName('')
    setFormEmail('')
    setFormPhone('')
    setFormDeptId('')
    setFormPositionId('')
    setFormEduLevelId('')
    setFormBirthday('')
    setFormGender(true)
    setFormRoleIds([])
    setFormStatus('ACTIVE')
    setEditingUser(null)
    setIsFormModalOpen(true)
  }

  const handleOpenEditModal = (userId) => {
    setSelectedUserId(null) // Close detail modal if open
    setModalLoading(true)
    adminApi.getUserById(userId)
      .then(res => {
        const u = res.data?.data
        if (u) {
          setFormEmpCode(u.employeeCode || '')
          setFormFullName(u.fullName || '')
          setFormEmail(u.email || '')
          setFormPhone(u.phone || '')
          setFormDeptId(u.departmentId || '')
          setFormPositionId(u.positionId || '')
          setFormEduLevelId(u.educationLevelId || '')
          setFormBirthday(u.birthday || '')
          setFormGender(u.gender === undefined ? true : u.gender)
          setFormRoleIds(u.roles ? u.roles.map(r => r.id) : [])
          setFormStatus(u.status || 'ACTIVE')
          setEditingUser(u)
          setIsFormModalOpen(true)
        }
      })
      .catch(err => {
        console.error('Lỗi khi tải chi tiết người dùng để sửa:', err)
        alert('Không thể tải thông tin chi tiết tài khoản.')
      })
      .finally(() => {
        setModalLoading(false)
      })
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()

    const empCode = formEmpCode.trim()
    const fullName = formFullName.trim()
    const email = formEmail.trim()
    const phone = formPhone.trim()

    // 1. Check required fields
    if (!empCode || !fullName || !email || !formDeptId) {
      alert('Vui lòng nhập đầy đủ thông tin bắt buộc (Mã nhân viên, Họ và tên, Email, Phòng ban).')
      return
    }

    // 2. Validate Employee Code format
    const codeRegex = /^[a-zA-Z0-9-_]+$/
    if (!codeRegex.test(empCode)) {
      alert('Mã nhân viên chỉ được chứa các ký tự chữ, số, dấu gạch ngang (-) hoặc gạch dưới (_), không chứa khoảng trắng.')
      return
    }

    // 3. Validate FullName length
    if (fullName.length < 2) {
      alert('Họ và tên phải có ít nhất 2 ký tự.')
      return
    }

    // 4. Validate Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      alert('Email không hợp lệ. Vui lòng nhập đúng định dạng email (VD: abc@domain.com).')
      return
    }

    // 5. Validate Phone format if entered
    if (phone) {
      const phoneRegex = /^[0-9]{10,11}$/
      if (!phoneRegex.test(phone)) {
        alert('Số điện thoại không hợp lệ. Vui lòng nhập từ 10 đến 11 chữ số.')
        return
      }
    }

    // 6. Validate Birthday if entered
    if (formBirthday) {
      const selectedDate = new Date(formBirthday)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (selectedDate > today) {
        alert('Ngày sinh không thể lớn hơn ngày hiện tại.')
        return
      }
    }

    // 7. Check at least one role
    if (formRoleIds.length === 0) {
      alert('Vui lòng chọn ít nhất một vai trò cho tài khoản.')
      return
    }

    try {
      if (editingUser) {
        // Edit User
        const updatePayload = {
          employeeCode: empCode,
          fullName: fullName,
          email: email,
          phone: phone || undefined,
          departmentId: parseInt(formDeptId) || undefined,
          positionId: parseInt(formPositionId) || undefined,
          educationLevelId: parseInt(formEduLevelId) || undefined,
          birthday: formBirthday || undefined,
          gender: formGender,
          status: formStatus
        }

        await adminApi.updateUser(editingUser.id, updatePayload)

        // Sync Roles
        const initialRoleIds = editingUser.roles ? editingUser.roles.map(r => r.id) : []
        const rolesToAdd = formRoleIds.filter(id => !initialRoleIds.includes(id))
        const rolesToRemove = initialRoleIds.filter(id => !formRoleIds.includes(id))

        for (const rId of rolesToAdd) {
          await adminApi.assignRole(editingUser.id, rId)
        }
        for (const rId of rolesToRemove) {
          await adminApi.removeRole(editingUser.id, rId)
        }

        alert('Cập nhật tài khoản thành công!')
      } else {
        // Create User
        const createPayload = {
          employeeCode: empCode,
          fullName: fullName,
          email: email,
          departmentId: parseInt(formDeptId),
          roleIds: formRoleIds.map(id => parseInt(id))
        }

        await adminApi.createUser(createPayload)
        alert('Tạo tài khoản thành công! Mật khẩu ngẫu nhiên đã được gửi về email của nhân viên.')
      }

      setIsFormModalOpen(false)
      setEditingUser(null)
      loadUsers()
    } catch (err) {
      console.error('Lỗi khi lưu thông tin tài khoản:', err)
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi lưu thông tin.')
    }
  }

  const handleLockUser = (userId) => {
    if (window.confirm('Bạn có chắc chắn muốn khoá tài khoản này? Người dùng sẽ không thể đăng nhập.')) {
      adminApi.lockUser(userId)
        .then(() => {
          alert('Đã khoá tài khoản thành công.')
          setSelectedUserId(null)
          loadUsers()
        })
        .catch(err => {
          console.error(err)
          alert(err.response?.data?.message || 'Không thể khoá tài khoản.')
        })
    }
  }

  const handleUnlockUser = (userId) => {
    if (window.confirm('Mở khoá tài khoản này? Người dùng có thể đăng nhập lại.')) {
      adminApi.unlockUser(userId)
        .then(() => {
          alert('Đã mở khoá tài khoản thành công.')
          setSelectedUserId(null)
          loadUsers()
        })
        .catch(err => {
          console.error(err)
          alert(err.response?.data?.message || 'Không thể mở khoá tài khoản.')
        })
    }
  }

  const handleDeleteUser = (userId) => {
    if (window.confirm('CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản này? Thao tác này không thể hoàn tác.')) {
      adminApi.deleteUser(userId)
        .then(() => {
          alert('Đã xóa tài khoản thành công.')
          setSelectedUserId(null)
          loadUsers()
        })
        .catch(err => {
          console.error(err)
          alert(err.response?.data?.message || 'Không thể xóa tài khoản.')
        })
    }
  }

  const handleResetPassword = (userId) => {
    if (window.confirm('Hệ thống sẽ tự động đổi sang một mật khẩu ngẫu nhiên mới và cập nhật cho tài khoản này. Bạn có chắc chắn tiếp tục?')) {
      adminApi.resetUserPassword(userId)
        .then(res => {
          const generatedPwd = res.data?.data
          setNewGeneratedPassword(generatedPwd)
          alert('Tự động thay đổi mật khẩu thành công! Xem mật khẩu mới tại khung thông tin phía dưới.')
        })
        .catch(err => {
          console.error(err)
          alert(err.response?.data?.message || 'Không thể thay đổi mật khẩu.')
        })
    }
  }

  const handleImportUsers = (e) => {
    e.preventDefault()
    if (!importFile) {
      alert('Vui lòng chọn tệp Excel chứa danh sách tài khoản cần import.')
      return
    }

    setImportLoading(true)
    setImportResult(null)

    adminApi.importUsers(importFile)
      .then(res => {
        setImportResult(res.data?.data || { success: true })
        alert('Nhập danh sách tài khoản thành công!')
        loadUsers()
      })
      .catch(err => {
        console.error('Lỗi khi import tài khoản:', err)
        alert(err.response?.data?.message || 'Có lỗi xảy ra khi nhập dữ liệu từ Excel.')
      })
      .finally(() => {
        setImportLoading(false)
      })
  }

  // Map departmentId to departmentName for table rows
  const getDeptName = (deptId) => {
    if (!deptId) return 'Chưa phân phòng'
    const dept = departments.find(d => d.id === deptId)
    return dept ? dept.name : `Mã phòng ${deptId}`
  }

  // Handle Export CSV
  const handleExport = () => {
    const params = {
      keyword: debouncedSearch || undefined,
      departmentId: deptFilter !== 'all' ? deptFilter : undefined,
      roleId: roleFilter !== 'all' ? roleFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }

    adminApi.exportUsers(params)
      .then(res => {
        const list = res.data?.data || []
        if (list.length === 0) {
          alert('Không có dữ liệu phù hợp để xuất.')
          return
        }

        const headers = ['Mã nhân viên', 'Họ và tên', 'Phòng ban', 'Vai trò', 'Trạng thái']
        const rows = list.map(u => [
          u.employeeCode || '',
          u.fullName || '',
          getDeptName(u.departmentId),
          u.roles?.map(r => r.name || r.code).join(', ') || '',
          u.status === 'ACTIVE' ? 'Hoạt động' : (u.status === 'LOCKED' ? 'Đã khoá' : 'Ngưng hoạt động')
        ])

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', `danh_sach_tai_khoan_${new Date().toISOString().slice(0, 10)}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      })
      .catch(err => {
        console.error('Lỗi khi xuất danh sách:', err)
        alert('Có lỗi xảy ra khi xuất tệp dữ liệu.')
      })
  }

  // Render Pill badges for roles
  const renderRoles = (userRoles) => {
    if (!userRoles || userRoles.length === 0) return <span className="am-badge">Nhân viên</span>
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {userRoles.map(r => {
          let mod = 'staff'
          let label = r.name || r.code
          if (r.code === 'ADMIN') {
            mod = 'admin'
          } else if (r.code === 'MANAGER') {
            mod = 'manager'
          }
          return (
            <span key={r.id} className={`am-badge am-badge--role-${mod}`}>
              {label}
            </span>
          )
        })}
      </div>
    )
  }

  // Render status badge with colored dot
  const renderStatus = (status) => {
    let mod = 'inactive'
    let label = 'Ngưng hoạt động'
    if (status === 'ACTIVE') {
      mod = 'active'
      label = 'Hoạt động'
    } else if (status === 'LOCKED') {
      mod = 'locked'
      label = 'Đã khoá'
    }
    return (
      <span className={`am-badge am-badge--status-${mod}`}>
        <span className="am-badge__dot" />
        {label}
      </span>
    )
  }

  // Format date helper
  const fmtDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader title="Quản lý tài khoản" />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="am-page">
              
              {/* Title Header Card */}
              <div className="am-title-card">
                <h1 className="am-title">Danh sách tài khoản</h1>
                <p className="am-subtitle">Quản lý và giám sát tất cả các tài khoản người dùng trong hệ thống</p>
              </div>

              {/* Filters Block */}
              <div className="am-filter-bar">
                <div className="am-search">
                  <span className="am-search-icon">
                    <SearchOutlined />
                  </span>
                  <input
                    type="text"
                    className="am-search-input"
                    placeholder="Tìm theo tên hoặc ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Department dropdown */}
                <select 
                  className="am-filter-select" 
                  value={deptFilter} 
                  onChange={(e) => { setDeptFilter(e.target.value); setPage(1) }}
                >
                  <option value="all">Tất cả phòng ban</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>

                {/* Role dropdown */}
                <select 
                  className="am-filter-select" 
                  value={roleFilter} 
                  onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
                >
                  <option value="all">Tất cả vai trò</option>
                  {roles.map(r => {
                    const roleLabel = r.name || r.code
                    return <option key={r.id} value={r.id}>{roleLabel}</option>
                  })}
                </select>

                {/* Status dropdown */}
                <select 
                  className="am-filter-select" 
                  value={statusFilter} 
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="INACTIVE">Ngưng hoạt động</option>
                  <option value="LOCKED">Đã khoá</option>
                </select>

                {/* Results Count & Export */}
                <span className="am-results-count">{totalElements} kết quả</span>
                
                <button className="am-btn-primary" onClick={handleOpenCreateModal}>
                  <PlusOutlined /> Thêm tài khoản
                </button>
                
                <button className="am-btn-secondary" onClick={() => { setIsImportModalOpen(true); setImportFile(null); setImportResult(null); }}>
                  <UploadOutlined /> Import Excel
                </button>

                <button className="am-export-btn" onClick={handleExport} title="Xuất CSV">
                  <DownloadOutlined />
                </button>
              </div>

              {/* Table Card */}
              <div className="am-table-card">
                <table className="am-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Họ và tên</th>
                      <th>Phòng ban</th>
                      <th>Vai trò</th>
                      <th>Trạng thái</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                          <LoadingOutlined style={{ marginRight: 8 }} /> Đang tải danh sách tài khoản...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                          Không tìm thấy tài khoản người dùng phù hợp.
                        </td>
                      </tr>
                    ) : (
                      users.map(u => (
                        <tr key={u.id}>
                          <td><span className="am-emp-code">{u.employeeCode || `USR-${u.id}`}</span></td>
                          <td><strong>{u.fullName || 'Chưa đặt tên'}</strong></td>
                          <td>{getDeptName(u.departmentId)}</td>
                          <td>{renderRoles(u.roles)}</td>
                          <td>{renderStatus(u.status)}</td>
                          <td>
                            <button className="am-btn-detail" onClick={() => setSelectedUserId(u.id)}>
                              <EyeOutlined /> Chi tiết
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Table Footer / Pagination */}
                {!loading && users.length > 0 && (
                  <div className="am-pagination">
                    <span>
                      Hiển thị {users.length} trong tổng số {totalElements} kết quả
                    </span>
                    <div className="am-page-nums">
                      <button 
                        className="am-pn" 
                        onClick={() => setPage(p => Math.max(1, p - 1))} 
                        disabled={page === 1}
                      >
                        <LeftOutlined />
                      </button>

                      {getVisiblePages().map((n, idx) => {
                        if (n === '...') {
                          return <span key={`dots-${idx}`} className="am-pn-dots">...</span>
                        }
                        return (
                          <button
                            key={n}
                            className={`am-pn ${n === page ? 'am-pn--active' : ''}`}
                            onClick={() => setPage(n)}
                          >
                            {n}
                          </button>
                        )
                      })}

                      <button 
                        className="am-pn" 
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

      {/* Account Detail Modal overlay */}
      {selectedUserId && (
        <div className="am-modal-overlay" onClick={() => setSelectedUserId(null)}>
          <div className="am-modal" onClick={(e) => e.stopPropagation()}>
            <div className="am-modal-header">
              <h3 className="am-modal-title">Thông tin tài khoản</h3>
              <button className="am-modal-close" onClick={() => setSelectedUserId(null)}>
                <CloseOutlined />
              </button>
            </div>
            
            <div className="am-modal-body">
              {modalLoading ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
                  <LoadingOutlined style={{ marginRight: 8 }} /> Đang tải thông tin nhân viên...
                </div>
              ) : selectedUserDetail ? (
                <>
                  <div className="am-detail-header">
                    <div className="am-detail-avatar">
                      {selectedUserDetail.fullName ? selectedUserDetail.fullName.trim().split(' ').pop().charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="am-detail-name-wrap">
                      <h4 className="am-detail-fullname">{selectedUserDetail.fullName}</h4>
                      <p className="am-detail-code">Mã nhân viên: <strong>{selectedUserDetail.employeeCode || '-'}</strong></p>
                    </div>
                  </div>

                  <div className="am-detail-grid">
                    <div className="am-detail-item">
                      <span className="am-detail-label">Phòng ban</span>
                      <span className="am-detail-value">{selectedUserDetail.departmentName || 'Chưa phân phòng'}</span>
                    </div>

                    <div className="am-detail-item">
                      <span className="am-detail-label">Chức danh</span>
                      <span className="am-detail-value">{selectedUserDetail.positionName || 'Nhân viên'}</span>
                    </div>

                    <div className="am-detail-item">
                      <span className="am-detail-label">Thư điện tử (Email)</span>
                      <span className="am-detail-value">{selectedUserDetail.email || '-'}</span>
                    </div>

                    <div className="am-detail-item">
                      <span className="am-detail-label">Số điện thoại</span>
                      <span className="am-detail-value">{selectedUserDetail.phone || '-'}</span>
                    </div>

                    <div className="am-detail-item">
                      <span className="am-detail-label">Vai trò hệ thống</span>
                      <span className="am-detail-value" style={{ display: 'flex', gap: 4 }}>
                        {selectedUserDetail.roles && selectedUserDetail.roles.length > 0 ? (
                          selectedUserDetail.roles.map(r => (
                            <span key={r.id} className={`am-badge am-badge--role-${r.code === 'ADMIN' ? 'admin' : (r.code === 'MANAGER' ? 'manager' : 'staff')}`}>
                              {r.name || r.code}
                            </span>
                          ))
                        ) : (
                          <span className="am-badge am-badge--role-staff">Nhân viên</span>
                        )}
                      </span>
                    </div>

                    <div className="am-detail-item">
                      <span className="am-detail-label">Trạng thái</span>
                      <span className="am-detail-value">
                        {renderStatus(selectedUserDetail.status)}
                      </span>
                    </div>

                    <div className="am-detail-item">
                      <span className="am-detail-label">Đăng nhập cuối</span>
                      <span className="am-detail-value">{fmtDate(selectedUserDetail.lastLogin)}</span>
                    </div>

                    <div className="am-detail-item">
                      <span className="am-detail-label">Ngày tạo tài khoản</span>
                      <span className="am-detail-value">{fmtDate(selectedUserDetail.createdAt)}</span>
                    </div>
                  </div>

                  {/* Admin Actions Block */}
                  <div className="am-detail-actions">
                    <button className="am-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleOpenEditModal(selectedUserDetail.id)}>
                      <EditOutlined /> Sửa thông tin
                    </button>
                    {selectedUserDetail.status === 'LOCKED' ? (
                      <button className="am-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleUnlockUser(selectedUserDetail.id)}>
                        <UnlockOutlined /> Mở khoá
                      </button>
                    ) : (
                      <button className="am-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleLockUser(selectedUserDetail.id)}>
                        <LockOutlined /> Khoá tài khoản
                      </button>
                    )}
                    <button className="am-btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleResetPassword(selectedUserDetail.id)}>
                      <KeyOutlined /> Đổi mật khẩu tự động
                    </button>
                    <button className="am-modal-btn" style={{ padding: '6px 12px', fontSize: '12px', background: '#fef2f2', color: '#b91c1c', borderColor: '#fca5a5' }} onClick={() => handleDeleteUser(selectedUserDetail.id)}>
                      <DeleteOutlined /> Xoá tài khoản
                    </button>
                  </div>

                  {newGeneratedPassword && (
                    <div className="am-pwd-display">
                      <span>Mật khẩu ngẫu nhiên mới:</span>
                      <span className="am-pwd-code">{newGeneratedPassword}</span>
                      <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 'normal', marginTop: 4 }}>
                        * Hãy copy mật khẩu này cung cấp cho người dùng. Nó chỉ hiển thị một lần.
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#dc2626' }}>
                  Lỗi: Không tìm thấy dữ liệu người dùng.
                </div>
              )}
            </div>

            <div className="am-modal-footer">
              <button className="am-modal-btn" onClick={() => setSelectedUserId(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Create or Edit Form Modal overlay */}
      {isFormModalOpen && (
        <div className="am-modal-overlay" onClick={() => { setIsFormModalOpen(false); setEditingUser(null); }}>
          <div className="am-modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="am-modal-header">
              <h3 className="am-modal-title">
                {editingUser ? 'Sửa thông tin tài khoản' : 'Thêm tài khoản nhân viên'}
              </h3>
              <button className="am-modal-close" onClick={() => { setIsFormModalOpen(false); setEditingUser(null); }}>
                <CloseOutlined />
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit}>
              <div className="am-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="am-form-grid">
                  
                  <div className="am-form-group">
                    <label className="am-form-label">Mã nhân viên *</label>
                    <input
                      type="text"
                      className="am-form-input"
                      value={formEmpCode}
                      onChange={(e) => setFormEmpCode(e.target.value)}
                      placeholder="VD: NV-00042"
                      required
                    />
                  </div>

                  <div className="am-form-group">
                    <label className="am-form-label">Họ và tên *</label>
                    <input
                      type="text"
                      className="am-form-input"
                      value={formFullName}
                      onChange={(e) => setFormFullName(e.target.value)}
                      placeholder="VD: Nguyễn Văn A"
                      required
                    />
                  </div>

                  <div className="am-form-group">
                    <label className="am-form-label">Địa chỉ Email *</label>
                    <input
                      type="email"
                      className="am-form-input"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="VD: email@example.com"
                      required
                    />
                  </div>

                  <div className="am-form-group">
                    <label className="am-form-label">Số điện thoại</label>
                    <input
                      type="text"
                      className="am-form-input"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="Nhập số điện thoại..."
                    />
                  </div>

                  <div className="am-form-group">
                    <label className="am-form-label">Phòng ban *</label>
                    <select
                      className="am-form-select"
                      value={formDeptId}
                      onChange={(e) => setFormDeptId(e.target.value)}
                      required
                    >
                      <option value="">Chọn phòng ban...</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {editingUser && (
                    <>
                      <div className="am-form-group">
                        <label className="am-form-label">Chức danh</label>
                        <select
                          className="am-form-select"
                          value={formPositionId}
                          onChange={(e) => setFormPositionId(e.target.value)}
                        >
                          <option value="">Chọn chức danh...</option>
                          {positions.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="am-form-group">
                        <label className="am-form-label">Trình độ học vấn</label>
                        <select
                          className="am-form-select"
                          value={formEduLevelId}
                          onChange={(e) => setFormEduLevelId(e.target.value)}
                        >
                          <option value="">Chọn trình độ...</option>
                          {educationLevels.map(el => (
                            <option key={el.id} value={el.id}>{el.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="am-form-group">
                        <label className="am-form-label">Ngày sinh</label>
                        <input
                          type="date"
                          className="am-form-input"
                          value={formBirthday}
                          onChange={(e) => setFormBirthday(e.target.value)}
                        />
                      </div>

                      <div className="am-form-group">
                        <label className="am-form-label">Giới tính</label>
                        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13.5px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="gender"
                              checked={formGender === true}
                              onChange={() => setFormGender(true)}
                            /> Nam
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13.5px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="gender"
                              checked={formGender === false}
                              onChange={() => setFormGender(false)}
                            /> Nữ
                          </label>
                        </div>
                      </div>

                      <div className="am-form-group">
                        <label className="am-form-label">Trạng thái tài khoản</label>
                        <select
                          className="am-form-select"
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value)}
                        >
                          <option value="ACTIVE">Hoạt động</option>
                          <option value="INACTIVE">Ngưng hoạt động</option>
                          <option value="LOCKED">Bị khoá</option>
                        </select>
                      </div>
                    </>
                  )}

                  <div className="am-form-group am-form-group--full">
                    <label className="am-form-label">Vai trò hệ thống *</label>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
                      {roles.map(r => {
                        const roleLabel = r.name || r.code
                        const isChecked = formRoleIds.includes(r.id)
                        return (
                          <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13.5px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormRoleIds([...formRoleIds, r.id])
                                } else {
                                  setFormRoleIds(formRoleIds.filter(id => id !== r.id))
                                }
                              }}
                            /> {roleLabel}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                </div>
              </div>
              
              <div className="am-modal-footer" style={{ gap: 10 }}>
                <button
                  type="button"
                  className="am-modal-btn"
                  onClick={() => { setIsFormModalOpen(false); setEditingUser(null); }}
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="am-btn-primary"
                  style={{ borderRadius: '8px' }}
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal overlay */}
      {isImportModalOpen && (
        <div className="am-modal-overlay" onClick={() => setIsImportModalOpen(false)}>
          <div className="am-modal" onClick={(e) => e.stopPropagation()}>
            <div className="am-modal-header">
              <h3 className="am-modal-title">Import danh sách tài khoản</h3>
              <button className="am-modal-close" onClick={() => setIsImportModalOpen(false)}>
                <CloseOutlined />
              </button>
            </div>
            
            <form onSubmit={handleImportUsers}>
              <div className="am-modal-body">
                <p style={{ fontSize: '13.5px', color: '#475569', margin: 0 }}>
                  Chọn file Excel chứa danh sách tài khoản nhân viên gốc để import hàng loạt vào hệ thống.
                </p>

                <div className="am-import-dropzone" onClick={() => document.getElementById('excel-file-input').click()}>
                  <UploadOutlined className="am-import-icon" />
                  <div className="am-import-text">
                    {importFile ? <strong>{importFile.name}</strong> : 'Nhấn để chọn tệp Excel (.xlsx, .xls)'}
                  </div>
                  <div className="am-import-subtext">Hỗ trợ các định dạng tệp Excel chuẩn</div>
                  <input
                    type="file"
                    id="excel-file-input"
                    accept=".xlsx, .xls"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setImportFile(e.target.files[0])
                        setImportResult(null)
                      }
                    }}
                  />
                </div>

                {importLoading && (
                  <div style={{ textAlign: 'center', padding: '10px 0', color: '#64748b', fontSize: '13.5px' }}>
                    <LoadingOutlined /> Đang tải lên và phân tích dữ liệu, vui lòng đợi...
                  </div>
                )}

                {importResult && (
                  <div className="am-import-result">
                    <div className="am-import-result-title">Kết quả Import:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div>Thêm mới thành công: <strong style={{ color: '#16a34a' }}>{importResult.createdCount ?? 0}</strong></div>
                      <div>Cập nhật thành công: <strong style={{ color: '#2563eb' }}>{importResult.updatedCount ?? 0}</strong></div>
                      {importResult.failedCount > 0 && (
                        <div style={{ color: '#dc2626' }}>
                          Lỗi hàng: <strong>{importResult.failedCount}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="am-modal-footer" style={{ gap: 10 }}>
                <button
                  type="button"
                  className="am-modal-btn"
                  onClick={() => setIsImportModalOpen(false)}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="am-btn-primary"
                  style={{ borderRadius: '8px' }}
                  disabled={!importFile || importLoading}
                >
                  Bắt đầu Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminAccountsScreen
