import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import '../styles/training.css'

function ActivityTypeDetailPage() {
  const { id } = useParams()
  const [activityType, setActivityType] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const fetchDetail = async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const response = await trainingApi.getActivityType(id)
      setActivityType(response.data.data)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không tải được chi tiết loại đào tạo'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDetail()
  }, [id])

  const toggleStatus = async () => {
    if (!activityType) return
    const nextStatus = !activityType.active
    const label = nextStatus ? 'kích hoạt' : 'ngừng kích hoạt'
    if (!window.confirm(`Bạn muốn ${label} loại "${activityType.name}"?`)) {
      return
    }

    try {
      await trainingApi.updateActivityTypeStatus(activityType.id, {
        active: nextStatus,
        version: activityType.version,
      })
      fetchDetail()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không cập nhật được trạng thái'))
    }
  }

  const breadcrumbs = [
    { label: 'Các hình thức đào tạo', link: '/admin/training/activity-types' },
    { label: 'Chi tiết hình thức đào tạo' }
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="training-detail-page-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Header Panel */}
              <div className="atl-title-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 className="atl-title">Chi tiết hình thức đào tạo</h1>
                  <p className="atl-subtitle">Thông tin chi tiết và lịch sử sử dụng của hình thức đào tạo</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Link className="training-button" to="/admin/training/activity-types" style={{ textDecoration: 'none' }}>
                    Quay lại
                  </Link>
                  {activityType && (
                    <>
                      <Link className="training-button training-button--primary" to={`/admin/training/activity-types/${activityType.id}/edit`} style={{ textDecoration: 'none' }}>
                        Chỉnh sửa
                      </Link>
                      <button className="training-button" onClick={toggleStatus} type="button">
                        {activityType.active ? 'Ngưng hoạt động' : 'Kích hoạt'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isLoading && (
                <div className="training-panel training-skeleton" style={{ textAlign: 'center', padding: 40 }}>
                  Đang tải thông tin chi tiết...
                </div>
              )}

              {errorMessage && (
                <div className="training-panel training-message training-message--error" style={{ padding: '12px 16px', background: '#ffebeb', color: '#d32f2f', borderRadius: 8 }}>
                  <p>{errorMessage}</p>
                  <button className="training-button" onClick={fetchDetail} type="button">
                    Thử lại
                  </button>
                </div>
              )}

              {activityType && (
                <div className="training-detail-grid">
                  <article className="training-panel">
                    <h2>Thông tin chung</h2>
                    <dl className="training-definition">
                      <dt>Mã hình thức</dt>
                      <dd>{activityType.code}</dd>
                      <dt>Tên hình thức</dt>
                      <dd>{activityType.name}</dd>
                      <dt>Mô tả</dt>
                      <dd>{activityType.description || '-'}</dd>
                      <dt>Trạng thái</dt>
                      <dd>
                        <span className={`training-badge ${activityType.active ? 'is-active' : 'is-inactive'}`}>
                          {activityType.active ? 'Hoạt động' : 'Ngưng sử dụng'}
                        </span>
                      </dd>
                    </dl>
                  </article>

                  <article className="training-panel">
                    <h2>Quy tắc tính giờ & Minh chứng</h2>
                    <dl className="training-definition">
                      <dt>Đơn vị tính thời gian</dt>
                      <dd>{durationUnitLabel(activityType.defaultDurationUnit)}</dd>
                      <dt>Yêu cầu minh chứng</dt>
                      <dd>{activityType.requiresEvidence ? 'Bắt buộc' : 'Không bắt buộc'}</dd>
                      <dt>Số giờ tích lũy tối đa / hồ sơ</dt>
                      <dd>{activityType.maxCreditedHoursPerRecord ?? 'Không giới hạn'}</dd>
                      <dt>Thứ tự hiển thị</dt>
                      <dd>{activityType.sortOrder}</dd>
                    </dl>
                  </article>

                  <article className="training-panel">
                    <h2>Thống kê sử dụng</h2>
                    <p className="training-stat" style={{ fontSize: 32, fontWeight: 700, color: '#2563eb', margin: '12px 0 4px 0' }}>
                      {activityType.usageCount}
                    </p>
                    <p style={{ margin: 0, color: '#64748b', fontSize: 13.5 }}>hồ sơ đào tạo đang áp dụng hình thức này</p>
                  </article>

                  <article className="training-panel">
                    <h2>Thông tin hệ thống</h2>
                    <dl className="training-definition">
                      <dt>Ngày tạo</dt>
                      <dd>{formatDateTime(activityType.createdAt)}</dd>
                      <dt>Cập nhật lần cuối</dt>
                      <dd>{formatDateTime(activityType.updatedAt)}</dd>
                      <dt>Phiên bản</dt>
                      <dd>{activityType.version}</dd>
                    </dl>
                  </article>

                  <article className="training-panel training-panel--wide">
                    <h2>Các hồ sơ đào tạo gần đây</h2>
                    {activityType.recentRecords.length === 0 ? (
                      <p style={{ color: '#94a3b8', margin: '12px 0 0 0' }}>Chưa có hồ sơ đào tạo nào áp dụng hình thức này.</p>
                    ) : (
                      <table className="training-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                        <thead>
                          <tr>
                            <th>Tên chuyên đề / Khóa học</th>
                            <th>Nhân viên</th>
                            <th>Ngày bắt đầu</th>
                            <th>Số giờ khai báo</th>
                            <th>Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityType.recentRecords.map((record) => (
                            <tr key={record.id}>
                              <td>{record.title}</td>
                              <td>{record.employeeCode} - {record.employeeName}</td>
                              <td>{record.startDate}</td>
                              <td>{record.declaredHours ?? '-'}</td>
                              <td>{record.workflowStatus}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </article>

                  <article className="training-panel training-panel--wide">
                    <h2>Lịch sử thay đổi</h2>
                    {activityType.auditTimeline.length === 0 ? (
                      <p style={{ color: '#94a3b8', margin: '12px 0 0 0' }}>Chưa có lịch sử thay đổi nào được lưu lại.</p>
                    ) : (
                      <ul className="training-timeline" style={{ paddingLeft: 20, marginTop: 12 }}>
                        {activityType.auditTimeline.map((event) => (
                          <li key={event.id} style={{ marginBottom: 10 }}>
                            <strong style={{ color: '#0f172a' }}>{event.changeType}</strong>{' '}
                            <span style={{ color: '#64748b', fontSize: 12 }}>({formatDateTime(event.changedAt)})</span> -{' '}
                            <span style={{ color: '#475569' }}>Thực hiện bởi: {event.changedByName || event.changedByUserId || '—'}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function durationUnitLabel(unit) {
  const map = {
    HOUR: 'Tính theo giờ', LESSON: 'Tính theo tiết học', CREDIT: 'Tính theo tín chỉ',
    DAY: 'Tính theo ngày', MONTH: 'Tính theo tháng', YEAR: 'Tính theo năm', OTHER: 'Khác'
  }
  return map[unit] || unit || '-'
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('vi-VN')
}

export default ActivityTypeDetailPage
