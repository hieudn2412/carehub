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
import Sidebar from '../components/sidebar'
import Header from '../components/Header'
import ChangePasswordModal from '../components/ChangePasswordModal'
import { staffApi } from '../api/staffApi'
import '../styles/ProfileStaffScreen.css'

const INFO_FIELDS = [
  { key: 'employeeCode',   label: 'Mã nhân viên',       icon: <IdcardOutlined />,         color: 'blue' },
  { key: 'fullName',       label: 'Họ và tên',           icon: <UserOutlined />,           color: 'teal'   },
  { key: 'email',          label: 'Email',               icon: <MailOutlined />,           color: 'blue'   },
  { key: 'phone',          label: 'Số điện thoại',       icon: <PhoneOutlined />,          color: 'purple'  },
  { key: 'departmentName', label: 'Phòng ban',           icon: <ApartmentOutlined />,      color: 'blue'   },
  { key: 'lastLogin',      label: 'Lần cuối đăng nhập', icon: <ClockCircleOutlined />,     color: 'blue'   },
]

function ProfileStaffScreen() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    staffApi.getProfile()
      .then(res => {
        setProfile(res.data?.data)
      })
      .catch(err => {
        console.error("Lỗi khi tải thông tin cá nhân", err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const displayName = profile?.fullName || ''
  const initials = displayName
    ? displayName
        .trim()
        .split(' ')
        .slice(-2)
        .map(w => w[0])
        .join('')
        .toUpperCase()
    : 'U'

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Chưa từng đăng nhập'
    try {
      const date = new Date(dateStr)
      const d = String(date.getDate()).padStart(2, '0')
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const y = date.getFullYear()
      const hh = String(date.getHours()).padStart(2, '0')
      const mm = String(date.getMinutes()).padStart(2, '0')
      return `${d}/${m}/${y} ${hh}:${mm}`
    } catch (e) {
      return dateStr
    }
  }

  const getValue = (key) => {
    if (!profile) return '...'
    if (key === 'lastLogin') return formatDateTime(profile.lastLogin)
    return profile[key] || 'Chưa cập nhật'
  }

  const displayRole = profile?.roles?.map(r => r.name).join(', ') || 'Nhân viên'
  const displayStatus = profile?.status === 'ACTIVE' ? 'Hoạt động' : 'Bị khoá'

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Hồ sơ cá nhân" />
        <div className="dashboard-layout__body">
          <div className="profile-page">
            <div className="profile-card">
              <p className="profile-card__title">Hồ sơ cá nhân của tôi</p>
              <p className="profile-card__sub">Thông tin cá nhân được đồng bộ từ HR systems</p>

              {loading ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#6b7280' }}>
                  Đang tải thông tin cá nhân...
                </div>
              ) : (
                <>
                  <div className="profile-card__header">
                    <div className="profile-card__avatar-row">
                      <div className="profile-avatar">{initials}</div>
                      <div>
                        <p className="profile-name">{displayName}</p>
                        <div className="profile-badges">
                          <span className="profile-badge profile-badge--role">{displayRole}</span>
                          <span className="profile-badge profile-badge--status">
                            <span className="profile-badge__dot" />
                            {displayStatus}
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
                          <p className="profile-info-value">{getValue(key)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <ChangePasswordModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
      </div>
    </div>
  )
}

export default ProfileStaffScreen