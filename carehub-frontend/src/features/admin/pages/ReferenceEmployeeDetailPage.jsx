import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { LeftOutlined } from '@ant-design/icons'
import { adminApi } from '../api/adminApi.js'
import '../styles/ReferenceEmployeeDetailPage.css'

function ReferenceEmployeeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    const loadEmployeeDetail = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await adminApi.getUserById(id)

        if (active && response.data?.success) {
          const emp = response.data.data
          setEmployee({
            employeeCode: emp.employeeCode,
            fullName: emp.fullName,
            cbType: emp.roles?.map(r => r.name).join(', ') || 'USER',
            gender: emp.gender ? 'Nam' : 'Nữ',
            birthday: emp.birthday ? new Date(emp.birthday).toLocaleDateString('vi-VN') : '–',
            departmentName: emp.departmentName || '–',
            blockCode: '–',
            positionName: emp.positionName || '–',
            degree: emp.educationLevelName || '–',
            titleName: emp.roles?.map(r => r.name).join(', ') || '–'
          })
        }
      } catch (err) {
        console.error(err)
        if (active) {
          setError('Không thể tải chi tiết thông tin nhân viên.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    loadEmployeeDetail()
    return () => { active = false }
  }, [id])

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
              {loading ? (
                <div className="red-card" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  Đang tải thông tin chi tiết nhân viên...
                </div>
              ) : error ? (
                <div className="red-card" style={{ textAlign: 'center', padding: '40px 0', color: '#dc2626' }}>
                  {error}
                </div>
              ) : employee ? (
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
              ) : null}

            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ReferenceEmployeeDetailPage
