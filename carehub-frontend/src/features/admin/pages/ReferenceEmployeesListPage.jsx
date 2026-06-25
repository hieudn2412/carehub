import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { SearchOutlined, EyeOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { adminApi } from '../api/adminApi.js'
import '../styles/ReferenceEmployeesListPage.css'

// Generate 248 mock reference employees to match mockup details (kept as fallback helper)
const generateMockEmployees = () => {
  const employees = []
  const names = [
    'Vũ Thị Thanh', 'Phạm Quốc Bảo', 'Lê Hoàng Long', 'Nguyễn Thị Mai', 
    'Trần Văn Hùng', 'Hoàng Kim Chi', 'Đặng Minh Triết', 'Đỗ Thùy Linh'
  ]
  
  const depts = [
    'Phòng Tài chính kế toán', 'Phòng Kiểm toán nội bộ', 'Phòng Vật tư - Thiết bị Y tế', 
    'Văn phòng Bệnh viện', 'Ban Giám đốc', 'Khoa Thần kinh', 'Khoa Tim mạch',
    'Khoa Phẫu thuật tổng hợp', 'Phòng Kiểm soát nhiễm khuẩn'
  ]
  
  const cbTypes = ['HD204', 'BC', 'HD68']
  const genders = ['Nam', 'Nữ']
  
  const degrees = ['Cao đẳng', 'Dược sĩ', 'PGS.TS Y', 'Tiến sĩ Y', 'Cử nhân', 'Thạc sĩ']
  const positions = ['Cán sự', 'Chuyên viên', 'Nhân viên kỹ thuật', 'Kỹ sư (hạng III)', 'Giám đốc', 'Điều dưỡng']
  const titles = ['Bác sĩ chính (hạng II)', 'Chuyên viên chính', 'Điều dưỡng hạng III', 'Kế toán viên trung cấp', 'Bác sĩ cao cấp (hạng I)']
  
  for (let i = 0; i < 248; i++) {
    const id = i + 1
    let code = `VD${String(id).padStart(5, '0')}`
    let name = names[i % names.length]
    let dept = depts[i % depts.length]
    let cbType = cbTypes[i % cbTypes.length]
    let gender = genders[i % genders.length]
    let degree = degrees[i % degrees.length]
    let pos = positions[i % positions.length]
    let title = titles[i % titles.length]
    let birthday = '10/7/1966'
    let blockCode = 'K. HC'

    // First 4 rows matched with mockup exactly
    if (i === 0) {
      code = 'VD00368'
      name = 'Vũ Thị Thanh'
      dept = 'Phòng Tài chính kế toán'
      cbType = 'HD204'
      gender = 'Nam'
      degree = 'Cao đẳng'
      pos = 'Cán sự'
      title = 'Bác sĩ chính (hạng II)'
    } else if (i === 1) {
      code = 'VD00368'
      name = 'Vũ Thị Thanh'
      dept = 'Phòng Kiểm toán nội bộ'
      cbType = 'BC'
      gender = 'Nữ'
      degree = 'Dược sĩ'
      pos = 'Chuyên viên'
      title = 'Chuyên viên chính'
    } else if (i === 2) {
      code = 'VD00368'
      name = 'Vũ Thị Thanh'
      dept = 'Phòng Vật tư - Thiết bị Y tế'
      cbType = 'HD68'
      gender = 'Nam'
      degree = 'PGS.TS Y'
      pos = 'Nhân viên kỹ thuật'
      title = 'Điều dưỡng hạng III'
    } else if (i === 3) {
      code = 'VD00368'
      name = 'Vũ Thị Thanh'
      dept = 'Văn phòng Bệnh viện'
      cbType = 'HD68'
      gender = 'Nam'
      degree = 'Tiến sĩ Y'
      pos = 'Kỹ sư (hạng III)'
      title = 'Kế toán viên trung cấp'
    } else {
      const year = 1970 + (i % 25)
      const month = 1 + (i % 12)
      const day = 1 + (i % 28)
      birthday = `${day}/${month}/${year}`
      blockCode = i % 2 === 0 ? 'K. HC' : 'K. LS'
    }

    employees.push({
      id,
      employeeCode: code,
      fullName: name,
      departmentName: dept,
      cbType,
      gender,
      degree,
      positionName: pos,
      titleName: title,
      birthday,
      blockCode
    })
  }
  return employees
}

function ReferenceEmployeesListPage() {
  const navigate = useNavigate()
  
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters State
  const [search, setSearch] = useState('')
  const [positionFilter, setPositionFilter] = useState('all')
  const [degreeFilter, setDegreeFilter] = useState('all')
  const [deptFilter, setDeptFilter] = useState('all')
  const [titleFilter, setTitleFilter] = useState('all')
  const [genderFilter, setGenderFilter] = useState('all')
  const [cbTypeFilter, setCbTypeFilter] = useState('all')
  const [page, setPage] = useState(1)

  // Load real employee data from backend
  useEffect(() => {
    let active = true
    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await adminApi.getUsers({ size: 10000 })
        if (active && response.data?.success) {
          const content = response.data.data.content || []
          
          // Map to match frontend format
          const mapped = content.map(emp => {
            const roleNames = emp.roles?.map(r => r.name).join(', ') || 'USER'
            return {
              id: emp.id,
              employeeCode: emp.employeeCode,
              fullName: emp.fullName,
              departmentName: emp.departmentName || '–',
              cbType: roleNames,
              gender: emp.gender ? 'Nam' : 'Nữ',
              degree: emp.educationLevelName || '–',
              positionName: emp.positionName || '–',
              titleName: roleNames,
              birthday: emp.birthday ? new Date(emp.birthday).toLocaleDateString('vi-VN') : '–',
              blockCode: '–'
            }
          })
          setEmployees(mapped)
        }
      } catch (err) {
        console.error(err)
        if (active) {
          setError('Không thể tải danh sách nhân viên từ backend.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadData()
    return () => { active = false }
  }, [])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [search, positionFilter, degreeFilter, deptFilter, titleFilter, genderFilter, cbTypeFilter])

  // Extract unique values for filter selects
  const filterOptions = useMemo(() => {
    const options = {
      positions: new Set(),
      degrees: new Set(),
      departments: new Set(),
      titles: new Set(),
      genders: new Set(),
      cbTypes: new Set()
    }
    employees.forEach(emp => {
      if (emp.positionName && emp.positionName !== '–') options.positions.add(emp.positionName)
      if (emp.degree && emp.degree !== '–') options.degrees.add(emp.degree)
      if (emp.departmentName && emp.departmentName !== '–') options.departments.add(emp.departmentName)
      if (emp.titleName && emp.titleName !== '–') options.titles.add(emp.titleName)
      if (emp.gender) options.genders.add(emp.gender)
      if (emp.cbType) options.cbTypes.add(emp.cbType)
    })
    return {
      positions: Array.from(options.positions),
      degrees: Array.from(options.degrees),
      departments: Array.from(options.departments),
      titles: Array.from(options.titles),
      genders: Array.from(options.genders),
      cbTypes: Array.from(options.cbTypes)
    }
  }, [employees])

  // Apply filters
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchSearch = 
        emp.fullName.toLowerCase().includes(search.toLowerCase()) ||
        emp.employeeCode.toLowerCase().includes(search.toLowerCase())
      
      const matchPosition = positionFilter === 'all' || emp.positionName === positionFilter
      const matchDegree = degreeFilter === 'all' || emp.degree === degreeFilter
      const matchDept = deptFilter === 'all' || emp.departmentName === deptFilter
      const matchTitle = titleFilter === 'all' || emp.titleName === titleFilter
      const matchGender = genderFilter === 'all' || emp.gender === genderFilter
      const matchCbType = cbTypeFilter === 'all' || emp.cbType === cbTypeFilter

      return matchSearch && matchPosition && matchDegree && matchDept && matchTitle && matchGender && matchCbType
    })
  }, [employees, search, positionFilter, degreeFilter, deptFilter, titleFilter, genderFilter, cbTypeFilter])

  // Pagination
  const PAGE_SIZE = 10
  const totalElements = filteredEmployees.length
  const totalPages = Math.ceil(totalElements / PAGE_SIZE)
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
  const paginatedEmployees = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE
    return filteredEmployees.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredEmployees, page])

  const breadcrumbs = [
    { label: 'Dữ liệu tham chiếu' },
    { label: 'Danh sách nhân viên gốc' }
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="rel-page">
              
              {/* Title Card */}
              <div className="rel-title-card">
                <h1 className="rel-title">Danh sách nhân viên gốc</h1>
                <p className="rel-subtitle">Dữ liệu nhân viên gốc · Chỉ đọc · Được đồng bộ từ hệ thống nhân sự</p>
              </div>

              {/* Multi-row Filter Bar */}
              <div className="rel-filter-bar">
                {/* Row 1 */}
                <div className="rel-filter-row">
                  <div className="rel-search-wrapper">
                    <span className="rel-search-icon">
                      <SearchOutlined />
                    </span>
                    <input
                      type="text"
                      className="rel-search-input"
                      placeholder="Tìm theo tên/ID"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <select
                    className="rel-filter-select"
                    value={positionFilter}
                    onChange={(e) => setPositionFilter(e.target.value)}
                    disabled={loading}
                  >
                    <option value="all">Vị trí</option>
                    {filterOptions.positions.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>

                  <select
                    className="rel-filter-select"
                    value={degreeFilter}
                    onChange={(e) => setDegreeFilter(e.target.value)}
                    disabled={loading}
                  >
                    <option value="all">Trình độ</option>
                    {filterOptions.degrees.map(deg => (
                      <option key={deg} value={deg}>{deg}</option>
                    ))}
                  </select>

                  <span className="rel-results-count">{totalElements} kết quả</span>
                </div>

                {/* Row 2 */}
                <div className="rel-filter-row">
                  <select
                    className="rel-filter-select"
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    disabled={loading}
                  >
                    <option value="all">Đơn vị</option>
                    {filterOptions.departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>

                  <select
                    className="rel-filter-select"
                    value={titleFilter}
                    onChange={(e) => setTitleFilter(e.target.value)}
                    disabled={loading}
                  >
                    <option value="all">Chức danh</option>
                    {filterOptions.titles.map(title => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                  </select>

                  <select
                    className="rel-filter-select"
                    value={genderFilter}
                    onChange={(e) => setGenderFilter(e.target.value)}
                    disabled={loading}
                  >
                    <option value="all">Giới tính</option>
                    {filterOptions.genders.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>

                  <select
                    className="rel-filter-select"
                    value={cbTypeFilter}
                    onChange={(e) => setCbTypeFilter(e.target.value)}
                    disabled={loading}
                  >
                    <option value="all">Loại CB</option>
                    {filterOptions.cbTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table Card */}
              <div className="rel-table-card">
                {error && (
                  <div className="rel-error-msg" style={{ padding: '20px', color: '#dc2626', textAlign: 'center' }}>
                    {error}
                  </div>
                )}
                
                <table className="rel-table">
                  <thead>
                    <tr>
                      <th>Mã CB</th>
                      <th>Họ và tên</th>
                      <th>Đơn vị</th>
                      <th>Loại CB</th>
                      <th>Giới tính</th>
                      <th>Trình độ</th>
                      <th>Vị trí</th>
                      <th>Chức danh</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                          Đang tải danh sách nhân viên từ backend...
                        </td>
                      </tr>
                    ) : paginatedEmployees.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                          Không tìm thấy nhân viên gốc phù hợp.
                        </td>
                      </tr>
                    ) : (
                      paginatedEmployees.map(emp => (
                        <tr key={emp.id}>
                          <td><span className="rel-emp-code">{emp.employeeCode}</span></td>
                          <td><strong>{emp.fullName}</strong></td>
                          <td>{emp.departmentName}</td>
                          <td>{emp.cbType}</td>
                          <td>{emp.gender}</td>
                          <td>{emp.degree}</td>
                          <td>{emp.positionName}</td>
                          <td>{emp.titleName}</td>
                          <td>
                            <button
                              className="rel-btn-detail"
                              onClick={() => navigate(`/admin/reference/employees/${emp.id}`)}
                            >
                              <EyeOutlined /> Chi tiết
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Table Footer / Pagination */}
                {!loading && totalElements > 0 && (
                  <div className="rel-pagination">
                    <span>
                      Hiển thị {paginatedEmployees.length} trong tổng số {totalElements} kết quả
                    </span>
                    <div className="rel-page-nums">
                      <button
                        className="rel-pn"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <LeftOutlined />
                      </button>

                      {getVisiblePages().map((n, idx) => {
                        if (n === '...') {
                          return <span key={`dots-${idx}`} className="rel-pn-dots">...</span>
                        }
                        return (
                          <button
                            key={n}
                            className={`rel-pn ${n === page ? 'rel-pn--active' : ''}`}
                            onClick={() => setPage(n)}
                          >
                            {n}
                          </button>
                        )
                      })}

                      <button
                        className="rel-pn"
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
    </div>
  )
}

export default ReferenceEmployeesListPage
export { generateMockEmployees }
