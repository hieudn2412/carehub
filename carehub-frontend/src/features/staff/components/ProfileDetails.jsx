import {
  ApartmentOutlined,
  ClockCircleOutlined,
  EditOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from '@ant-design/icons'

const INFO_FIELDS = [
  { key: 'employeeCode', label: 'Mã nhân viên', icon: <IdcardOutlined />, color: 'blue' },
  { key: 'fullName', label: 'Họ và tên', icon: <UserOutlined />, color: 'teal' },
  { key: 'email', label: 'Email', icon: <MailOutlined />, color: 'blue' },
  { key: 'phone', label: 'Số điện thoại', icon: <PhoneOutlined />, color: 'purple' },
  { key: 'departmentName', label: 'Phòng ban', icon: <ApartmentOutlined />, color: 'blue' },
  { key: 'lastLogin', label: 'Lần cuối đăng nhập', icon: <ClockCircleOutlined />, color: 'blue' },
]

function getInitials(name, fallback) {
  if (!name) return fallback

  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function formatDateTime(value) {
  if (!value) return 'Chưa từng đăng nhập'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function ProfileDetails({
  profile,
  loading,
  errorMessage,
  fallbackRole = 'Nhân viên',
  fallbackInitials = 'U',
  onChangePassword,
}) {
  const displayName = profile?.fullName || 'Chưa cập nhật'
  const initials = getInitials(profile?.fullName, fallbackInitials)
  const displayRole = profile?.roles?.map((role) => role.name).filter(Boolean).join(', ') || fallbackRole
  const isActive = profile?.status === 'ACTIVE'
  const displayStatus = profile?.status
    ? (isActive ? 'Hoạt động' : 'Bị khóa')
    : 'Chưa xác định'

  const getValue = (key) => {
    if (key === 'lastLogin') return formatDateTime(profile?.lastLogin)
    return profile?.[key] || 'Chưa cập nhật'
  }

  return (
    <div className="profile-page">
      <section className="profile-card" aria-busy={loading}>
        <p className="profile-card__title">Hồ sơ cá nhân của tôi</p>
        <p className="profile-card__sub">Thông tin cá nhân được đồng bộ từ hệ thống nhân sự</p>

        {loading && <div className="profile-card__state">Đang tải thông tin cá nhân...</div>}

        {!loading && errorMessage && (
          <div className="profile-card__state profile-card__state--error" role="alert">
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && (
          <>
            <div className="profile-card__header">
              <div className="profile-card__avatar-row">
                <div className="profile-avatar" aria-hidden="true">{initials}</div>
                <div>
                  <p className="profile-name">{displayName}</p>
                  <div className="profile-badges">
                    <span className="profile-badge profile-badge--role">{displayRole}</span>
                    <span className={`profile-badge profile-badge--status${isActive ? '' : ' profile-badge--status-inactive'}`}>
                      <span className="profile-badge__dot" />
                      {displayStatus}
                    </span>
                  </div>
                </div>
              </div>

              <button type="button" className="profile-change-pw-btn" onClick={onChangePassword}>
                <EditOutlined /> Đổi mật khẩu
              </button>
            </div>

            <div className="profile-info-grid">
              {INFO_FIELDS.map(({ key, label, icon, color }) => (
                <div key={key} className="profile-info-item">
                  <div className={`profile-info-icon profile-info-icon--${color}`} aria-hidden="true">
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
      </section>
    </div>
  )
}

export default ProfileDetails
