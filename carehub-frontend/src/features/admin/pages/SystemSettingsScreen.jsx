import { useCallback, useEffect, useState } from 'react'
import { ClockCircleOutlined, LoadingOutlined, SaveOutlined } from '@ant-design/icons'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import '../styles/SystemSettingsScreen.css'

const DEFAULT_HOURS = 120

function SystemSettingsScreen() {
  const { showToast } = useToast()
  const [globalTrainingHours, setGlobalTrainingHours] = useState(DEFAULT_HOURS)
  const [version, setVersion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await adminApi.getSystemSettings()
      const settings = response.data?.data
      setGlobalTrainingHours(Number(settings?.globalTrainingHours ?? DEFAULT_HOURS))
      setVersion(settings?.version ?? null)
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không thể tải cấu hình hệ thống.'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const handleSave = async () => {
    if (!Number.isFinite(globalTrainingHours) || globalTrainingHours < 0.5) {
      showToast('Mục tiêu giờ đào tạo phải từ 0,5 giờ trở lên.', 'warning')
      return
    }
    setSaving(true)
    try {
      const response = await adminApi.updateSystemSettings({ globalTrainingHours, version })
      const settings = response.data?.data
      setGlobalTrainingHours(Number(settings.globalTrainingHours))
      setVersion(settings.version)
      showToast('Đã cập nhật mục tiêu giờ đào tạo toàn viện.', 'success')
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không thể lưu cấu hình hệ thống.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={[{ label: 'Hệ thống' }, { label: 'Cấu hình hệ thống' }]} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="ss-page">
              <div className="ss-card">
                <div className="ss-settings-heading">
                  <span className="ss-settings-icon"><ClockCircleOutlined /></span>
                  <div>
                    <h2>Cấu hình giờ đào tạo liên tục</h2>
                    <p className="ss-card__sub">
                      Một mục tiêu chung áp dụng cho toàn bộ nhân viên đang hoạt động trong chu kỳ 5 năm liên tục.
                    </p>
                  </div>
                </div>

                <div className="ss-box">
                  <p className="ss-section-label">MỤC TIÊU TOÀN VIỆN</p>
                  {loading ? (
                    <div className="ss-loading"><LoadingOutlined /> Đang tải cấu hình...</div>
                  ) : (
                    <div className="ss-row">
                      <div className="ss-row__text">
                        <strong>Số giờ đào tạo cần hoàn thành</strong>
                        <span>Nhân viên đạt khi tổng giờ đã nộp trong 5 năm gần nhất bằng hoặc vượt mục tiêu này.</span>
                      </div>
                      <div className="ss-hours-input">
                        <input
                          aria-label="Mục tiêu giờ đào tạo toàn viện"
                          className="ss-num-input"
                          min="0.5"
                          step="0.5"
                          type="number"
                          value={globalTrainingHours}
                          onChange={(event) => setGlobalTrainingHours(Number(event.target.value))}
                        />
                        <span>giờ / 5 năm</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="ss-actions">
                  <button className="ss-btn ss-btn--primary" onClick={handleSave} disabled={saving || loading}>
                    {saving ? <LoadingOutlined /> : <SaveOutlined />} {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                  </button>
                  <button
                    className="ss-btn ss-btn--secondary"
                    onClick={() => setGlobalTrainingHours(DEFAULT_HOURS)}
                    disabled={saving || loading}
                  >
                    Đặt lại 120 giờ
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
