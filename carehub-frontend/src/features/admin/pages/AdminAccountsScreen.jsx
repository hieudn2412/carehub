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
  LoadingOutlined
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
  }, [])

  // Load user data on filter changes
  useEffect(() => {
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
  }, [page, debouncedSearch, deptFilter, roleFilter, statusFilter])

  // Load detail data when select user changes
  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUserDetail(null)
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
          u.roles?.map(r => r.name).join(', ') || '',
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
          let label = 'Nhân viên'
          if (r.name === 'ADMIN') {
            mod = 'admin'
            label = 'Quản trị'
          } else if (r.name === 'MANAGER') {
            mod = 'manager'
            label = 'Quản lý'
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
                    const roleLabel = r.name === 'ADMIN' ? 'Quản trị' : (r.name === 'MANAGER' ? 'Quản lý' : 'Nhân viên')
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

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                        <button
                          key={n}
                          className={`am-pn ${n === page ? 'am-pn--active' : ''}`}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </button>
                      ))}

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
                            <span key={r.id} className={`am-badge am-badge--role-${r.name === 'ADMIN' ? 'admin' : (r.name === 'MANAGER' ? 'manager' : 'staff')}`}>
                              {r.name === 'ADMIN' ? 'Quản trị' : (r.name === 'MANAGER' ? 'Quản lý' : 'Nhân viên')}
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
    </div>
  )
}

export default AdminAccountsScreen
