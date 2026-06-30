import { useState, useEffect } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import { LoadingOutlined } from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import '../styles/NotificationSettingsPage.css'

function NotificationSettingsPage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // Confirm Modal state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  // State corresponding to mockup switches
  const [cmeAlertEnabled, setCmeAlertEnabled] = useState(true)
  const [alertSchedule, setAlertSchedule] = useState('Hàng tuần')
  
  const [testAssignedEnabled, setTestAssignedEnabled] = useState(true)
  const [testFailedEnabled, setTestFailedEnabled] = useState(true)
  
  const [complianceLowEnabled, setComplianceLowEnabled] = useState(true)
  const [compliancePersonalEnabled, setCompliancePersonalEnabled] = useState(false)

  // Load configuration from API and localStorage
  useEffect(() => {
    setLoading(true)
    adminApi.getNotificationConfig()
      .then(res => {
        const config = res.data?.data
        if (config) {
          setCmeAlertEnabled(config.emailEnabled)
          const schedule = config.alertSchedule
          if (schedule === 'EVERY_15_MIN' || !['Hàng ngày', 'Hàng tuần', 'Hàng tháng'].includes(schedule)) {
            setAlertSchedule('Hàng tuần')
          } else {
            setAlertSchedule(schedule || 'Hàng tuần')
          }
        }
      })
      .catch(err => {
        console.warn('GET /notifications/config failed, using localStorage/defaults', err)
      })
      .finally(() => {
        // Load granular toggles from localStorage
        const storedTestAssigned = localStorage.getItem('ns_test_assigned')
        const storedTestFailed = localStorage.getItem('ns_test_failed')
        const storedComplianceLow = localStorage.getItem('ns_compliance_low')
        const storedCompliancePersonal = localStorage.getItem('ns_compliance_personal')

        if (storedTestAssigned !== null) setTestAssignedEnabled(storedTestAssigned === 'true')
        if (storedTestFailed !== null) setTestFailedEnabled(storedTestFailed === 'true')
        if (storedComplianceLow !== null) setComplianceLowEnabled(storedComplianceLow === 'true')
        if (storedCompliancePersonal !== null) setCompliancePersonalEnabled(storedCompliancePersonal === 'true')
        
        setLoading(false)
      })
  }, [])

  // Handle Save Configuration
  const handleSave = () => {
    setSaving(true)
    setSuccessMsg('')

    const payload = {
      inAppEnabled: true,
      emailEnabled: cmeAlertEnabled,
      dedupWindowMinutes: 60,
      alertSchedule: alertSchedule
    }

    adminApi.updateNotificationConfig(payload)
      .then(() => {
        // Save granular toggles in localStorage
        localStorage.setItem('ns_test_assigned', String(testAssignedEnabled))
        localStorage.setItem('ns_test_failed', String(testFailedEnabled))
        localStorage.setItem('ns_compliance_low', String(complianceLowEnabled))
        localStorage.setItem('ns_compliance_personal', String(compliancePersonalEnabled))
        
        setSuccessMsg('Lưu cấu hình thông báo thành công!')
        setTimeout(() => setSuccessMsg(''), 3000)
      })
      .catch(err => {
        console.error('Lỗi khi lưu cấu hình:', err)
        showToast('Có lỗi xảy ra khi lưu cấu hình thông báo.', 'error')
      })
      .finally(() => {
        setSaving(false)
      })
  }

  // Reset to Defaults
  const handleResetDefaults = () => {
    setIsConfirmOpen(true)
  }

  const executeResetDefaults = () => {
    setCmeAlertEnabled(true)
    setAlertSchedule('Hàng tuần')
    setTestAssignedEnabled(true)
    setTestFailedEnabled(true)
    setComplianceLowEnabled(true)
    setCompliancePersonalEnabled(false)

    setSaving(true)
      const payload = {
        inAppEnabled: true,
        emailEnabled: true,
        dedupWindowMinutes: 60,
        alertSchedule: 'Hàng tuần'
      }

      adminApi.updateNotificationConfig(payload)
        .then(() => {
          localStorage.setItem('ns_test_assigned', 'true')
          localStorage.setItem('ns_test_failed', 'true')
          localStorage.setItem('ns_compliance_low', 'true')
          localStorage.setItem('ns_compliance_personal', 'false')
          setSuccessMsg('Đã khôi phục thiết lập mặc định!')
          setTimeout(() => setSuccessMsg(''), 3000)
        })
        .catch(err => {
          console.error('Reset failed:', err)
        })
        .finally(() => {
          setSaving(false)
        })
  }

  const breadcrumbs = [
    { label: 'Cấu hình thông báo' }
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="ns-page">
              
              {/* Title Card */}
              <div className="ns-title-card">
                <h1 className="ns-title">Cấu hình thông báo</h1>
                <p className="ns-subtitle">Cấu hình thời điểm và cách thức gửi cảnh báo đến nhân viên và quản lý.</p>
              </div>

              {/* Settings Form */}
              <div className="ns-card">
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                    <LoadingOutlined style={{ marginRight: 8 }} /> Đang tải cấu hình thông báo...
                  </div>
                ) : (
                  <>
                    {successMsg && (
                      <div style={{
                        background: '#ecfdf5',
                        border: '1px solid #10b981',
                        color: '#059669',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}>
                        {successMsg}
                      </div>
                    )}

                    {/* Section 1: ĐÀO TẠO */}
                    <div className="ns-section">
                      <h3 className="ns-section-title">Đào tạo</h3>
                      
                      <div className="ns-row">
                        <div className="ns-info">
                          <span className="ns-row-title">Cảnh báo khi số giờ CME thấp dưới ngưỡng quy định</span>
                          <span className="ns-row-desc">Thông báo cho cả nhân viên và quản lý.</span>
                        </div>
                        <label className="ns-switch">
                          <input
                            type="checkbox"
                            checked={cmeAlertEnabled}
                            onChange={(e) => setCmeAlertEnabled(e.target.checked)}
                          />
                          <span className="ns-slider"></span>
                        </label>
                      </div>

                      <div className="ns-row">
                        <div className="ns-info">
                          <span className="ns-row-title">Tần suất cảnh báo</span>
                          <span className="ns-row-desc">Bao lâu thì hệ thống sẽ gửi lại thông báo nếu sự vụ chưa được giải quyết.</span>
                        </div>
                        <select
                          className="ns-select"
                          value={alertSchedule}
                          onChange={(e) => setAlertSchedule(e.target.value)}
                        >
                          <option value="Hàng ngày">Hàng ngày</option>
                          <option value="Hàng tuần">Hàng tuần</option>
                          <option value="Hàng tháng">Hàng tháng</option>
                        </select>
                      </div>
                    </div>

                    {/* Section 2: ĐÁNH GIÁ NĂNG LỰC */}
                    <div className="ns-section">
                      <h3 className="ns-section-title">Đánh giá năng lực</h3>
                      
                      <div className="ns-row">
                        <div className="ns-info">
                          <span className="ns-row-title">Thông báo cho nhân viên khi được giao bài thi</span>
                        </div>
                        <label className="ns-switch">
                          <input
                            type="checkbox"
                            checked={testAssignedEnabled}
                            onChange={(e) => setTestAssignedEnabled(e.target.checked)}
                          />
                          <span className="ns-slider"></span>
                        </label>
                      </div>

                      <div className="ns-row">
                        <div className="ns-info">
                          <span className="ns-row-title">Thông báo cho quản lý khi nhân viên thi trượt</span>
                        </div>
                        <label className="ns-switch">
                          <input
                            type="checkbox"
                            checked={testFailedEnabled}
                            onChange={(e) => setTestFailedEnabled(e.target.checked)}
                          />
                          <span className="ns-slider"></span>
                        </label>
                      </div>
                    </div>

                    {/* Section 3: CHẤT LƯỢNG */}
                    <div className="ns-section">
                      <h3 className="ns-section-title">Chất lượng</h3>
                      
                      <div className="ns-row">
                        <div className="ns-info">
                          <span className="ns-row-title">Cảnh báo khi tỷ lệ tuân thủ thấp dưới mức mục tiêu</span>
                        </div>
                        <label className="ns-switch">
                          <input
                            type="checkbox"
                            checked={complianceLowEnabled}
                            onChange={(e) => setComplianceLowEnabled(e.target.checked)}
                          />
                          <span className="ns-slider"></span>
                        </label>
                      </div>

                      <div className="ns-row">
                        <div className="ns-info">
                          <span className="ns-row-title">Thông báo cho nhân viên về vấn đề tuân thủ của cá nhân</span>
                        </div>
                        <label className="ns-switch">
                          <input
                            type="checkbox"
                            checked={compliancePersonalEnabled}
                            onChange={(e) => setCompliancePersonalEnabled(e.target.checked)}
                          />
                          <span className="ns-slider"></span>
                        </label>
                      </div>
                    </div>

                    {/* Form Action Buttons */}
                    <div className="ns-actions">
                      <button
                        className="ns-btn-save"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                      </button>
                      <button
                        className="ns-btn-default"
                        onClick={handleResetDefaults}
                        disabled={saving}
                      >
                        Thiết lập mặc định
                      </button>
                    </div>
                  </>
                )}
              </div>

            </div>
          </main>
        </div>
      </div>
      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Khôi phục thiết lập"
        message="Bạn có chắc chắn muốn khôi phục thiết lập mặc định?"
        onConfirm={() => {
          setIsConfirmOpen(false)
          executeResetDefaults()
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  )
}

export default NotificationSettingsPage
