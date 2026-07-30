import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../../shared/components/AppShell.jsx'
import AdminFilterDisclosure from '../../../shared/components/AdminFilterDisclosure.jsx'
import LoadingState from '../../../shared/components/LoadingState.jsx'
import { SearchOutlined, EyeOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { adminApi } from '../api/adminApi.js'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import '../styles/ReferenceEmployeesListPage.css'

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

  const updateFilter = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

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
    <AppShell breadcrumbs={breadcrumbs}>
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
                      onChange={(e) => updateFilter(setSearch)(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <span className="rel-results-count">{totalElements} kết quả</span>
                </div>

                <AdminFilterDisclosure
                  activeCount={[
                    positionFilter !== 'all',
                    degreeFilter !== 'all',
                    deptFilter !== 'all',
                    titleFilter !== 'all',
                    genderFilter !== 'all',
                    cbTypeFilter !== 'all',
                  ].filter(Boolean).length}
                >
                  <div className="rel-filter-row">
                  <select
                    className="rel-filter-select"
                    value={positionFilter}
                    onChange={(e) => updateFilter(setPositionFilter)(e.target.value)}
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
                    onChange={(e) => updateFilter(setDegreeFilter)(e.target.value)}
                    disabled={loading}
                  >
                    <option value="all">Trình độ</option>
                    {filterOptions.degrees.map(deg => (
                      <option key={deg} value={deg}>{deg}</option>
                    ))}
                  </select>
                </div>

                {/* Row 2 */}
                <div className="rel-filter-row">
                  <div className="rel-department-filter">
                    <SearchableSelect
                      value={deptFilter}
                      onChange={updateFilter(setDeptFilter)}
                      disabled={loading}
                      options={[
                        { value: 'all', label: 'Tất cả đơn vị' },
                        ...filterOptions.departments.map((department) => ({
                          value: department,
                          label: department,
                        })),
                      ]}
                      placeholder="Tất cả đơn vị"
                      searchPlaceholder="Tìm khoa/phòng, đơn vị..."
                      ariaLabel="Tìm và chọn khoa/phòng, đơn vị"
                    />
                  </div>

                  <select
                    className="rel-filter-select"
                    value={titleFilter}
                    onChange={(e) => updateFilter(setTitleFilter)(e.target.value)}
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
                    onChange={(e) => updateFilter(setGenderFilter)(e.target.value)}
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
                    onChange={(e) => updateFilter(setCbTypeFilter)(e.target.value)}
                    disabled={loading}
                  >
                    <option value="all">Loại CB</option>
                    {filterOptions.cbTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                </AdminFilterDisclosure>
              </div>

              {/* Table Card */}
              <div className="rel-table-card">
                {error && (
                  <div className="rel-error-msg">
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
                        <td colSpan="9">
                          <LoadingState label="Đang tải danh sách nhân viên từ backend..." />
                        </td>
                      </tr>
                    ) : paginatedEmployees.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="ch-empty">
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
    </AppShell>
  )
}

export default ReferenceEmployeesListPage
