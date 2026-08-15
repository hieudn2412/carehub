import { useEffect, useState } from 'react'
import AppShell from '../../../shared/components/AppShell.jsx'
import ChangePasswordModal from '../components/ChangePasswordModal'
import EditProfileModal from '../components/EditProfileModal.jsx'
import ProfileDetails from '../components/ProfileDetails'
import { staffApi } from '../api/staffApi'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import '../styles/ProfileStaffScreen.css'

function ProfileStaffScreen() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const { showToast } = useToast()

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
    <AppShell title="Hồ sơ cá nhân">
      <ProfileDetails
        profile={profile}
        loading={loading}
        errorMessage={errorMessage}
        fallbackRole="Nhân viên"
        fallbackInitials="U"
        onEditProfile={() => setIsEditModalOpen(true)}
        onChangePassword={() => setIsModalOpen(true)}
      />
      <EditProfileModal
        isOpen={isEditModalOpen}
        profile={profile}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={(updatedProfile) => {
          setProfile(updatedProfile)
          setIsEditModalOpen(false)
          showToast('Cập nhật hồ sơ cá nhân thành công', 'success')
        }}
      />
      <ChangePasswordModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </AppShell>
  )
}

export default ProfileStaffScreen
