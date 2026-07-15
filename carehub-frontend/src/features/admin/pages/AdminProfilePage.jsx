import { useState, useEffect } from 'react'
import {
  IdcardOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  ApartmentOutlined,
  ClockCircleOutlined,
  EditOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { staffApi } from '../../staff/api/staffApi'
import '../../staff/styles/ProfileStaffScreen.css'

const INFO_FIELDS = [
  { key: 'employeeCode',   label: 'Mã nhân viên',       icon: <IdcardOutlined />,     color: 'blue' },
  { key: 'fullName',       label: 'Họ và tên',           icon: <UserOutlined />,       color: 'teal' },
  { key: 'email',          label: 'Email',               icon: <MailOutlined />,       color: 'blue' },
  { key: 'phone',          label: 'Số điện thoại',       icon: <PhoneOutlined />,      color: 'purple' },
  { key: 'departmentName', label: 'Phòng ban',           icon: <ApartmentOutlined />,  color: 'blue' },
  { key: 'lastLogin',      label: 'Lần cuối đăng nhập',  icon: <ClockCircleOutlined />, color: 'blue' },
]

function AdminProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    staffApi.getProfile()
      .then(res => setProfile(res.data?.data))
      .catch(err => console.error("Lỗi khi tải thông tin cá nhân", err))
      .finally(() => setLoading(false))
  }, [])

  const displayName = profile?.fullName || ''
  const initials = displayName
    ? displayName.trim().split(' ').slice(-2).map(w => w[0]).join('').toUpperCase()
    : 'AD'

  const breadcrumbs = [{ label: 'Hồ sơ cá nhân' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-layout__body">
          <div className="profile-container">
            <div className="profile-header-card">
              <div className="profile-avatar">{initials}</div>
              <div className="profile-header-info">
                <h2>{loading ? 'Đang tải...' : displayName}</h2>
                <p>{profile?.role || 'Quản trị viên'}</p>
              </div>
            </div>
            <div className="profile-info-grid">
              {INFO_FIELDS.map(field => {
                const value = profile?.[field.key]
                return (
                  <div key={field.key} className="profile-info-card">
                    <div className={`profile-info-icon profile-info-icon--${field.color}`}>
                      {field.icon}
                    </div>
                    <div>
                      <span className="profile-info-label">{field.label}</span>
                      <strong>{loading ? '...' : (value || '—')}</strong>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminProfilePage
