import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { SearchOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons'
import '../styles/TrainingEmployeeStatusListPage.css'

const MOCK_EMPLOYEES = [
  {
    employeeId: '1',
    employeeCode: 'VD00368',
    employeeName: 'Vũ Thị Thanh',
    departmentName: 'Khoa Thần kinh',
    approvedHours: 120,
    requiredHours: 120,
    complianceStatus: 'COMPLIANT'
  },
  {
    employeeId: '2',
    employeeCode: 'VD00368',
    employeeName: 'Vũ Thị Thanh',
    departmentName: 'Khoa Tim mạch',
    approvedHours: 125,
    requiredHours: 120,
    complianceStatus: 'COMPLIANT'
  },
  {
    employeeId: '3',
    employeeCode: 'VD00368',
    employeeName: 'Vũ Thị Thanh',
    departmentName: 'Khoa Phẫu thuật tổng hợp',
    approvedHours: 36,
    requiredHours: 120,
    complianceStatus: 'NON_COMPLIANT'
  },
  {
    employeeId: '4',
    employeeCode: 'VD00368',
    employeeName: 'Vũ Thị Thanh',
    departmentName: 'Phòng Kiểm soát nhiễm khuẩn',
    approvedHours: 129,
    requiredHours: 120,
    complianceStatus: 'COMPLIANT'
  }
]

const DEPARTMENTS = [
  'Khoa Thần kinh',
  'Khoa Tim mạch',
  'Khoa Phẫu thuật tổng hợp',
  'Phòng Kiểm soát nhiễm khuẩn'
]

function TrainingEmployeeStatusListPage() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')
  const [employees, setEmployees] = useState(MOCK_EMPLOYEES)
  const [apiMode, setApiMode] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const response = await trainingApi.getEmployeeTrainingStatuses({
          size: 50
        })
        const apiData = response.data?.data?.content
        if (apiData && apiData.length > 0) {
          const mapped = apiData.map(item => ({
            employeeId: String(item.employeeId),
            employeeCode: item.employeeCode,
            employeeName: item.employeeName,
            departmentName: item.departmentName || 'Chưa xác định',
            approvedHours: item.approvedHours || 0,
            requiredHours: item.requiredHours || 120,
            complianceStatus: item.complianceStatus
          }))
          setEmployees(mapped)
          setApiMode(true)
        }
      } catch (err) {
        console.warn('API error, falling back to mock data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchKeyword = 
        emp.employeeName.toLowerCase().includes(keyword.toLowerCase()) ||
        emp.employeeCode.toLowerCase().includes(keyword.toLowerCase())
      
      const matchDept = department ? emp.departmentName === department : true
      
      const matchStatus = status ? emp.complianceStatus === status : true

      return matchKeyword && matchDept && matchStatus
    })
  }, [employees, keyword, department, status])

  const breadcrumbs = [
    { label: 'Quản lý chất lượng' },
    { label: 'Giờ đào tạo nhân viên' }
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="tes-page">
              
              {/* Title Card */}
              <div className="tes-title-card">
                <h1 className="tes-title">Giờ đào tạo nhân viên</h1>
                <p className="tes-subtitle">
                  View and monitor training records across all departments
                </p>
              </div>

              {/* Filter Bar */}
              <div className="tes-filter-bar">
                <div className="tes-search">
                  <span className="tes-search-icon">
                    <SearchOutlined />
                  </span>
                  <input
                    type="text"
                    className="tes-search-input"
                    placeholder="Tìm theo tên nhân viên.."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                </div>

                <select
                  className="tes-filter-select"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="">Khoa/Phòng</option>
                  {DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>

                <select
                  className="tes-filter-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Trạng thái</option>
                  <option value="COMPLIANT">Đạt</option>
                  <option value="NON_COMPLIANT">Không đạt</option>
                </select>

                <button 
                  className="tes-btn-export"
                  title="Xuất dữ liệu"
                  onClick={() => alert('Chức năng xuất dữ liệu sẽ được triển khai ở phiên bản sau.')}
                >
                  <DownloadOutlined />
                </button>
              </div>

              {/* Table Card */}
              <div className="tes-table-card">
                {loading ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    Đang tải dữ liệu...
                  </div>
                ) : (
                  <>
                    <table className="tes-table">
                      <thead>
                        <tr>
                          <th>Mã nhân viên</th>
                          <th>Họ và tên</th>
                          <th>Khoa/Phòng</th>
                          <th>Tổng số giờ (5 năm)</th>
                          <th>Yêu cầu</th>
                          <th>Trạng thái</th>
                          <th>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEmployees.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                              Không tìm thấy kết quả phù hợp
                            </td>
                          </tr>
                        ) : (
                          filteredEmployees.map((item, idx) => (
                            <tr key={item.employeeId + '-' + idx}>
                              <td style={{ fontWeight: 500 }}>{item.employeeCode}</td>
                              <td>{item.employeeName}</td>
                              <td>{item.departmentName}</td>
                              <td style={{ fontWeight: 600 }}>{item.approvedHours}h</td>
                              <td style={{ color: '#64748b' }}>{item.requiredHours}h</td>
                              <td>
                                <span className={`tes-badge ${
                                  item.complianceStatus === 'COMPLIANT' 
                                    ? 'tes-badge--compliant' 
                                    : 'tes-badge--non-compliant'
                                }`}>
                                  {item.complianceStatus === 'COMPLIANT' ? 'Đạt' : 'Không đạt'}
                                </span>
                              </td>
                              <td>
                                <Link 
                                  to={`/training/employees/${item.employeeId}`} 
                                  className="tes-btn-detail"
                                >
                                  <EyeOutlined /> Chi tiết
                                </Link>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Pagination Bar */}
                    <div className="tes-pagination-bar">
                      <div className="tes-pagination-info">
                        Hiển thị {filteredEmployees.length} trong tổng số {apiMode ? filteredEmployees.length : 74} kết quả
                      </div>
                      <div className="tes-pagination-buttons">
                        <button className="tes-page-btn" disabled>&lt;</button>
                        <button className="tes-page-btn tes-page-btn--active">1</button>
                        <button className="tes-page-btn">2</button>
                        <button className="tes-page-btn">3</button>
                        <button className="tes-page-btn">4</button>
                        <button className="tes-page-btn tes-page-btn--dots">...</button>
                        <button className="tes-page-btn">10</button>
                        <button className="tes-page-btn">&gt;</button>
                      </div>
                    </div>
                  </>
                )}
              </div>

            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default TrainingEmployeeStatusListPage
