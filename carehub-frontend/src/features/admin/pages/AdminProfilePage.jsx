import { useEffect, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import ChangePasswordModal from '../../staff/components/ChangePasswordModal'
import ProfileDetails from '../../staff/components/ProfileDetails'
import { staffApi } from '../../staff/api/staffApi'
import '../../staff/styles/ProfileStaffScreen.css'

function AdminProfilePage() {
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
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={[{ label: 'Hồ sơ cá nhân' }]} />
        <div className="dashboard-layout__body">
          <ProfileDetails
            profile={profile}
            loading={loading}
            errorMessage={errorMessage}
            fallbackRole="Quản trị viên"
            fallbackInitials="AD"
            onChangePassword={() => setIsModalOpen(true)}
          />
          <ChangePasswordModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
      </div>
    </div>
  )
}

export default AdminProfilePage
