import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { LeftOutlined } from '@ant-design/icons'
import { generateMockEmployees } from './ReferenceEmployeesListPage'
import '../styles/ReferenceEmployeeDetailPage.css'

function ReferenceEmployeeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Load the mock database to find the selected employee
  const mockDatabase = useMemo(() => generateMockEmployees(), [])
  const employee = useMemo(() => {
    return mockDatabase.find(e => String(e.id) === String(id))
  }, [mockDatabase, id])

  const breadcrumbs = [
    { label: 'Danh sách nhân viên gốc', link: '/admin/reference/employees' },
    { label: 'Chi tiết nhân viên' }
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="red-page">
              
              {/* Title Card with Back Button */}
              <div className="red-title-card">
                <div className="red-title-info">
                  <h1 className="red-title">Chi tiết nhân viên gốc</h1>
                  <p className="red-subtitle">Xem thông tin tham chiếu chi tiết được đồng bộ từ hệ thống nhân sự</p>
                </div>
                <button className="red-back-btn" onClick={() => navigate('/admin/reference/employees')}>
                  <LeftOutlined /> Quay lại danh sách
                </button>
              </div>

              {/* Detail Card Content */}
              {employee ? (
                <div className="red-card">
                  <div className="red-card-header">
                    <h2 className="red-card-title">Employee reference detail</h2>
                    <p className="red-card-subtitle">Chỉ đọc - Được đồng bộ từ hệ thống nhân sự</p>
                  </div>

                  <div className="red-grid">
                    {/* Left Column */}
                    <div className="red-grid-column">
                      <div className="red-item">
                        <span className="red-label">Mã CB</span>
                        <span className="red-value">{employee.employeeCode}</span>
                      </div>
                      <div className="red-item">
                        <span className="red-label">Loại CB</span>
                        <span className="red-value">{employee.cbType}</span>
                      </div>
                      <div className="red-item">
                        <span className="red-label">Họ và tên</span>
                        <span className="red-value">{employee.fullName}</span>
                      </div>
                      <div className="red-item">
                        <span className="red-label">Ngày sinh</span>
                        <span className="red-value">{employee.birthday}</span>
                      </div>
                      <div className="red-item">
                        <span className="red-label">Đơn vị</span>
                        <span className="red-value">{employee.departmentName}</span>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="red-grid-column">
                      <div className="red-item">
                        <span className="red-label">Mã khối</span>
                        <span className="red-value">{employee.blockCode}</span>
                      </div>
                      <div className="red-item">
                        <span className="red-label">Vị trí</span>
                        <span className="red-value">{employee.positionName}</span>
                      </div>
                      <div className="red-item">
                        <span className="red-label">Trình độ</span>
                        <span className="red-value">{employee.degree}</span>
                      </div>
                      <div className="red-item">
                        <span className="red-label">Chức danh</span>
                        <span className="red-value">{employee.titleName}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="red-card" style={{ textAlign: 'center', padding: '40px 0', color: '#dc2626' }}>
                  Lỗi: Không tìm thấy dữ liệu nhân viên gốc phù hợp.
                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ReferenceEmployeeDetailPage
