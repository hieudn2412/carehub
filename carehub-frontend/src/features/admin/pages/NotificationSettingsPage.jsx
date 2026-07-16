import { useCallback, useEffect, useState } from 'react'
import { LoadingOutlined } from '@ant-design/icons'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { adminApi } from '../api/adminApi'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import '../styles/NotificationSettingsPage.css'

const EVENT = {
  cme: 'CME_HOURS_BELOW_REQUIREMENT',
  examAssigned: 'EXAM_ASSIGNED',
  qualityLow: 'QUALITY_COMPLIANCE_BELOW_TARGET',
  personalCompliance: 'PERSONAL_COMPLIANCE_ISSUE',
}

const SECTIONS = [
  {
    title: 'Đào tạo',
    items: [{
      eventType: EVENT.cme,
      title: 'Cảnh báo khi số giờ đào tạo thấp dưới ngưỡng quy định',
      description: 'Thông báo cho cả nhân viên và quản lý.',
      cadence: true,
    }],
  },
  {
    title: 'Đánh giá năng lực',
    items: [{
      eventType: EVENT.examAssigned,
      title: 'Thông báo cho nhân viên khi được giao bài thi',
    }],
  },
  {
    title: 'Chất lượng',
    items: [
      {
        eventType: EVENT.qualityLow,
        title: 'Cảnh báo khi tỷ lệ tuân thủ thấp dưới mức mục tiêu',
        cadence: true,
        threshold: true,
      },
      {
        eventType: EVENT.personalCompliance,
        title: 'Thông báo cho nhân viên về vấn đề tuân thủ của cá nhân',
      },
    ],
  },
]

function NotificationSettingsPage() {
  const { showToast } = useToast()
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const response = await adminApi.getNotificationConfig()
      setPolicies(response.data?.data?.policies || [])
    } catch (error) {
      console.error('Không thể tải cấu hình thông báo', error)
      showToast('Không thể tải cấu hình thông báo.', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    const timer = window.setTimeout(() => loadConfig(), 0)
    return () => window.clearTimeout(timer)
  }, [loadConfig])

  const policyFor = (eventType) => policies.find((policy) => policy.eventType === eventType)

  const updatePolicy = (eventType, changes) => {
    setPolicies((current) => current.map((policy) => (
      policy.eventType === eventType ? { ...policy, ...changes } : policy
    )))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await adminApi.updateNotificationConfig({ policies })
      setPolicies(response.data?.data?.policies || policies)
      showToast('Lưu cấu hình thông báo thành công!', 'success')
    } catch (error) {
      console.error('Không thể lưu cấu hình thông báo', error)
      showToast(error.response?.data?.message || 'Không thể lưu cấu hình thông báo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const executeResetDefaults = async () => {
    setSaving(true)
    try {
      const response = await adminApi.resetNotificationConfig()
      setPolicies(response.data?.data?.policies || [])
      showToast('Đã khôi phục thiết lập mặc định!', 'success')
    } catch (error) {
      console.error('Không thể khôi phục cấu hình', error)
      showToast('Không thể khôi phục thiết lập mặc định.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={[{ label: 'Cấu hình thông báo' }]} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="ns-page">
              <div className="ns-title-card">
                <h1 className="ns-title">Cấu hình thông báo</h1>
                <p className="ns-subtitle">Cấu hình thời điểm và kênh gửi cảnh báo đến nhân viên và quản lý.</p>
              </div>

              <div className="ns-card">
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                    <LoadingOutlined style={{ marginRight: 8 }} /> Đang tải cấu hình thông báo...
                  </div>
                ) : SECTIONS.map((section) => (
                  <div className="ns-section" key={section.title}>
                    <h3 className="ns-section-title">{section.title}</h3>
                    {section.items.map((item) => {
                      const policy = policyFor(item.eventType)
                      if (!policy) return null
                      return (
                        <div key={item.eventType}>
                          <div className="ns-row">
                            <div className="ns-info">
                              <span className="ns-row-title">{item.title}</span>
                              {item.description && <span className="ns-row-desc">{item.description}</span>}
                            </div>
                            <label className="ns-switch">
                              <input
                                type="checkbox"
                                checked={policy.enabled}
                                onChange={(event) => updatePolicy(item.eventType, { enabled: event.target.checked })}
                              />
                              <span className="ns-slider" />
                            </label>
                          </div>

                          {item.cadence && (
                            <div className="ns-row">
                              <div className="ns-info">
                                <span className="ns-row-title">Tần suất cảnh báo</span>
                                <span className="ns-row-desc">Hệ thống gửi lại nếu điều kiện cảnh báo vẫn còn tồn tại.</span>
                              </div>
                              <select
                                className="ns-select"
                                value={policy.cadence}
                                onChange={(event) => updatePolicy(item.eventType, { cadence: event.target.value })}
                              >
                                <option value="DAILY">Hàng ngày</option>
                                <option value="WEEKLY">Hàng tuần</option>
                                <option value="MONTHLY">Hàng tháng</option>
                              </select>
                            </div>
                          )}

                          {item.threshold && (
                            <div className="ns-row">
                              <div className="ns-info">
                                <span className="ns-row-title">Mức tuân thủ mục tiêu (%)</span>
                              </div>
                              <input
                                className="ns-select"
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={policy.thresholdPercent ?? 90}
                                onChange={(event) => updatePolicy(item.eventType, {
                                  thresholdPercent: Number(event.target.value),
                                })}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}

                {!loading && (
                  <div className="ns-actions">
                    <button className="ns-btn-save" onClick={handleSave} disabled={saving}>
                      {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                    </button>
                    <button className="ns-btn-default" onClick={() => setIsConfirmOpen(true)} disabled={saving}>
                      Thiết lập mặc định
                    </button>
                  </div>
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
