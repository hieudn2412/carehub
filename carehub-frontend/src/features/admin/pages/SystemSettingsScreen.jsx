import { useCallback, useEffect, useState } from 'react'
import { ClockCircleOutlined, LoadingOutlined, SaveOutlined } from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import { adminApi } from '../api/adminApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import '../styles/SystemSettingsScreen.css'

const DEFAULT_HOURS = 120
const DEFAULT_YEARS = 5

function SystemSettingsScreen() {
  const { showToast } = useToast()
  const [globalTrainingHours, setGlobalTrainingHours] = useState(DEFAULT_HOURS)
  const [trainingWindowYears, setTrainingWindowYears] = useState(DEFAULT_YEARS)
  const [version, setVersion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await adminApi.getSystemSettings()
      const settings = response.data?.data
      setGlobalTrainingHours(Number(settings?.globalTrainingHours ?? DEFAULT_HOURS))
      setTrainingWindowYears(Number(settings?.trainingWindowYears ?? DEFAULT_YEARS))
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
    if (!Number.isInteger(trainingWindowYears) || trainingWindowYears < 1 || trainingWindowYears > 100) {
      showToast('Chu kỳ đào tạo phải là số nguyên từ 1 đến 100 năm.', 'warning')
      return
    }
    setSaving(true)
    try {
      const response = await adminApi.updateSystemSettings({ globalTrainingHours, trainingWindowYears, version })
      const settings = response.data?.data
      setGlobalTrainingHours(Number(settings.globalTrainingHours))
      setTrainingWindowYears(Number(settings.trainingWindowYears))
      setVersion(settings.version)
      showToast('Đã cập nhật cấu hình giờ đào tạo toàn viện.', 'success')
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Không thể lưu cấu hình hệ thống.'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell breadcrumbs={[{ label: 'Hệ thống' }, { label: 'Cấu hình hệ thống' }]}>
            <div className="ss-page">
              <div className="ss-card">
                <div className="ss-settings-heading">
                  <span className="ss-settings-icon"><ClockCircleOutlined /></span>
                  <div>
                    <h2>Cấu hình giờ đào tạo liên tục</h2>
                    <p className="ss-card__sub">
                      Một mục tiêu chung áp dụng cho toàn bộ nhân viên đang hoạt động trong chu kỳ {trainingWindowYears} năm liên tục.
                    </p>
                  </div>
                </div>

                <div className="ss-box">
                  <p className="ss-section-label">MỤC TIÊU TOÀN VIỆN</p>
                  {loading ? (
                    <div className="ss-loading"><LoadingOutlined /> Đang tải cấu hình...</div>
                  ) : (
                    <div>
                      <div className="ss-row">
                        <div className="ss-row__text">
                          <strong>Số giờ đào tạo cần hoàn thành</strong>
                          <span>Nhân viên đạt khi tổng giờ hợp lệ bằng hoặc vượt mục tiêu này.</span>
                        </div>
                        <div className="ss-value-input">
                          <input
                            aria-label="Mục tiêu giờ đào tạo toàn viện"
                            className="ss-num-input"
                            min="0.5"
                            step="0.5"
                            type="number"
                            value={globalTrainingHours}
                            onChange={(event) => setGlobalTrainingHours(Number(event.target.value))}
                          />
                          <span>giờ</span>
                        </div>
                      </div>
                      <div className="ss-row">
                        <div className="ss-row__text">
                          <strong>Chu kỳ tính giờ đào tạo</strong>
                          <span>Chỉ cộng các hồ sơ trong {trainingWindowYears} năm gần nhất đến ngày hiện tại.</span>
                        </div>
                        <div className="ss-value-input">
                          <input
                            aria-label="Chu kỳ tính giờ đào tạo"
                            className="ss-num-input"
                            min="1"
                            max="100"
                            step="1"
                            type="number"
                            value={trainingWindowYears}
                            onChange={(event) => setTrainingWindowYears(Number(event.target.value))}
                          />
                          <span>năm</span>
                        </div>
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
                    onClick={() => {
                      setGlobalTrainingHours(DEFAULT_HOURS)
                      setTrainingWindowYears(DEFAULT_YEARS)
                    }}
                    disabled={saving || loading}
                  >
                    Đặt lại mặc định
                  </button>
                </div>
              </div>
            </div>
    </AppShell>
  )
}

export default SystemSettingsScreen
