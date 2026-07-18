import { useEffect, useState } from 'react'
import Sidebar from '../components/sidebar'
import Header from '../components/Header'
import ChangePasswordModal from '../components/ChangePasswordModal'
import ProfileDetails from '../components/ProfileDetails'
import { staffApi } from '../api/staffApi'
import '../styles/ProfileStaffScreen.css'

function ProfileStaffScreen() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    staffApi.getProfile()
      .then((response) => setProfile(response.data?.data))
      .catch((error) => {
        console.error('Lỗi khi tải thông tin cá nhân', error)
        setErrorMessage('Không thể tải thông tin cá nhân. Vui lòng thử lại sau.')
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Hồ sơ cá nhân" />
        <div className="dashboard-layout__body">
          <ProfileDetails
            profile={profile}
            loading={loading}
            errorMessage={errorMessage}
            fallbackRole="Nhân viên"
            fallbackInitials="U"
            onChangePassword={() => setIsModalOpen(true)}
          />
          <ChangePasswordModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
      </div>
    </div>
  )
}

export default ProfileStaffScreen
