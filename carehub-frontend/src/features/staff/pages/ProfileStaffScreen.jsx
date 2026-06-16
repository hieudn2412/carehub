import { useState } from 'react'
import {
  IdcardOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  ApartmentOutlined,
  ClockCircleOutlined,
  EditOutlined,
} from '@ant-design/icons'
import Sidebar from '../components/sidebar'
import Header from '../components/Header'
import ChangePasswordModal from '../components/ChangePasswordModal'
import '../styles/ProfileStaffScreen.css'

const MOCK_PROFILE = {
  fullName: 'Nguyễn Thị Lan',
  employeeId: 'EMP-0012',
  email: 'lannguyenthi@gmail.com',
  phone: '0912 345 678',
  department: 'Tim mạch',
  role: 'Nhân viên',
  status: 'Hoạt động',
  lastLogin: '03/06/2026 08:14',
}

const INFO_FIELDS = [
  { key: 'employeeId',  label: 'Mã nhân viên',       icon: <IdcardOutlined />,         color: 'blue' },
  { key: 'fullName',    label: 'Họ và tên',           icon: <UserOutlined />,           color: 'teal'   },
  { key: 'email',       label: 'Email',               icon: <MailOutlined />,           color: 'blue'   },
  { key: 'phone',       label: 'Số điện thoại',       icon: <PhoneOutlined />,          color: 'purple'  },
  { key: 'department',  label: 'Phòng ban',           icon: <ApartmentOutlined />,      color: 'blue'   },
  { key: 'lastLogin',   label: 'Lần cuối đăng nhập', icon: <ClockCircleOutlined />,     color: 'blue'   },
]

function ProfileStaffScreen() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const profile = MOCK_PROFILE
  const initials = profile.fullName
    .split(' ')
    .slice(-2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Hồ sơ cá nhân" userName="Phạm Quốc Bảo" roleName="Nhân viên" />
        <div className="dashboard-layout__body">
          <div className="profile-page">
            <div className="profile-card">
              <p className="profile-card__title">Hồ sơ cá nhân của tôi</p>
              <p className="profile-card__sub">Thông tin cá nhân được đồng bộ từ HR systems</p>

              <div className="profile-card__header">
                <div className="profile-card__avatar-row">
                  <div className="profile-avatar">{initials}</div>
                  <div>
                    <p className="profile-name">{profile.fullName}</p>
                    <div className="profile-badges">
                      <span className="profile-badge profile-badge--role">{profile.role}</span>
                      <span className="profile-badge profile-badge--status">
                        <span className="profile-badge__dot" />
                        {profile.status}
                      </span>
                    </div>
                  </div>
                </div>

                <button className="profile-change-pw-btn" onClick={() => setIsModalOpen(true)}>
                  <EditOutlined /> Đổi mật khẩu
                </button>
              </div>

              <div className="profile-info-grid">
                {INFO_FIELDS.map(({ key, label, icon, color }) => (
                  <div key={key} className="profile-info-item">
                    <div className={`profile-info-icon profile-info-icon--${color}`}>
                      {icon}
                    </div>
                    <div>
                      <p className="profile-info-label">{label}</p>
                      <p className="profile-info-value">{profile[key]}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <ChangePasswordModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
      </div>
    </div>
  )
}

export default ProfileStaffScreen