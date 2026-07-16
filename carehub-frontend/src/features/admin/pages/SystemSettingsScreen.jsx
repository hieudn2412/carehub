import { useState } from 'react'
import Toggle from '../components/Toggle'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import '../styles/SystemSettingsScreen.css'

const DEFAULT_SETTINGS = {
  defaultCmeHours: 120,
  requireTrainingProof: true,
  enableEmailNotifications: true,
  complianceWarningThreshold: 80,
  allowMultipleExamAttempts: true,
  autoSubmitOnTimeout: true,
}

function SystemSettingsScreen() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)

  const updateField = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      await fetch(`${import.meta.env.VITE_API_URL}/api/admin/system-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      })
      // có thể show toast thành công ở đây
    } catch (err) {
      console.error('Lưu cấu hình thất bại:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleResetDefault = () => {
    setSettings(DEFAULT_SETTINGS)
  }

  const breadcrumbs = [
    { label: 'Hệ thống' },
    { label: 'Cấu hình hệ thống' }
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="ss-page">
              <div className="ss-card">
                <h2>Cấu hình hệ thống</h2>
                <p className="ss-card__sub">
                  Các cài đặt chung (toàn hệ thống) · mọi thay đổi đều được ghi lại trong nhật ký kiểm toán.
                </p>

                <div className="ss-box">
                  <p className="ss-section-label">ĐÀO TẠO</p>

                  <div className="ss-row">
                    <div className="ss-row__text">
                      <strong>Yêu cầu về số giờ đào tạo mặc định (số giờ / 5 năm)</strong>
                      <span>Áp dụng cho tất cả các khoa phòng, trừ khi có cấu hình riêng cho từng khoa.</span>
                    </div>
                    <input
                      className="ss-num-input"
                      type="number"
                      value={settings.defaultCmeHours}
                      onChange={(e) => updateField('defaultCmeHours', Number(e.target.value))}
                    />
                  </div>

                  <div className="ss-row">
                    <div className="ss-row__text">
                      <strong>Bắt buộc nộp minh chứng đào tạo</strong>
                      <span>Người dùng phải tải lên bằng chứng cho mỗi hồ sơ đào tạo.</span>
                    </div>
                    <Toggle
                      checked={settings.requireTrainingProof}
                      onChange={(val) => updateField('requireTrainingProof', val)}
                    />
                  </div>

                  <hr className="ss-divider" />
                  <p className="ss-section-label">THÔNG BÁO</p>

                  <div className="ss-row">
                    <div className="ss-row__text">
                      <strong>Bật thông báo qua email</strong>
                    </div>
                    <Toggle
                      checked={settings.enableEmailNotifications}
                      onChange={(val) => updateField('enableEmailNotifications', val)}
                    />
                  </div>

                  <div className="ss-row">
                    <div className="ss-row__text">
                      <strong>Ngưỡng cảnh báo tỷ lệ tuân thủ (%)</strong>
                      <span>Cảnh báo sẽ kích hoạt khi tỷ lệ tuân thủ tụt xuống dưới giá trị này.</span>
                    </div>
                    <input
                      className="ss-num-input"
                      type="number"
                      value={settings.complianceWarningThreshold}
                      onChange={(e) => updateField('complianceWarningThreshold', Number(e.target.value))}
                    />
                  </div>

                  <hr className="ss-divider" />
                  <p className="ss-section-label">THI CỬ</p>

                  <div className="ss-row">
                    <div className="ss-row__text">
                      <strong>Cho phép làm bài thi nhiều lần.</strong>
                    </div>
                    <Toggle
                      checked={settings.allowMultipleExamAttempts}
                      onChange={(val) => updateField('allowMultipleExamAttempts', val)}
                    />
                  </div>

                  <div className="ss-row">
                    <div className="ss-row__text">
                      <strong>Tự động nộp bài khi hết giờ.</strong>
                    </div>
                    <Toggle
                      checked={settings.autoSubmitOnTimeout}
                      onChange={(val) => updateField('autoSubmitOnTimeout', val)}
                    />
                  </div>
                </div>

                <div className="ss-actions">
                  <button className="ss-btn ss-btn--primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                  </button>
                  <button className="ss-btn ss-btn--secondary" onClick={handleResetDefault}>
                    Thiết lập mặc định
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default SystemSettingsScreen