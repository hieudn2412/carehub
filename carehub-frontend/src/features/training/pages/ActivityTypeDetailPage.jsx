import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import AppShell from '../../../shared/components/AppShell.jsx'
import LoadingState from '../../../shared/components/LoadingState.jsx'
import '../styles/training.css'

function ActivityTypeDetailPage() {
  const { id } = useParams()
  const [activityType, setActivityType] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const fetchDetail = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const response = await trainingApi.getActivityType(id)
      setActivityType(response.data.data)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Không tải được chi tiết cách thức đào tạo'))
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

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
    { label: 'Cách thức đào tạo', link: '/admin/training/activity-types' },
    { label: 'Chi tiết cách thức đào tạo' }
  ]

  return (
    <AppShell back={{ to: '/admin/training/activity-types', label: 'Quay lại' }} breadcrumbs={breadcrumbs}>
            <div className="training-detail-page-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Header Panel */}
              <div className="atl-title-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 className="atl-title">Chi tiết cách thức đào tạo</h1>
                  <p className="atl-subtitle">Thông tin chi tiết và lịch sử sử dụng của cách thức đào tạo</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
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
                <LoadingState label="Đang tải thông tin chi tiết..." />
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
                      <dt>Mã cách thức</dt>
                      <dd>{activityType.code}</dd>
                      <dt>Tên cách thức</dt>
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
                    <h2>Cấu hình & Minh chứng</h2>
                    <dl className="training-definition">
                      <dt>Yêu cầu minh chứng</dt>
                      <dd>{activityType.requiresEvidence ? 'Bắt buộc' : 'Không bắt buộc'}</dd>
                      <dt>Thứ tự hiển thị</dt>
                      <dd>{activityType.sortOrder}</dd>
                    </dl>
                  </article>

                  <article className="training-panel">
                    <h2>Thống kê sử dụng</h2>
                    <p className="training-stat" style={{ fontSize: 32, fontWeight: 700, color: '#2563eb', margin: '12px 0 4px 0' }}>
                      {activityType.usageCount}
                    </p>
                    <p style={{ margin: 0, color: '#64748b', fontSize: 13.5 }}>hồ sơ đào tạo đang áp dụng cách thức này</p>
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
                      <p style={{ color: '#94a3b8', margin: '12px 0 0 0' }}>Chưa có hồ sơ đào tạo nào áp dụng cách thức này.</p>
                    ) : (
                      <div className="training-table-wrap" style={{ marginTop: 12 }}>
                      <table className="training-table">
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
                      </div>
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
    </AppShell>
  )
}

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('vi-VN')
}

export default ActivityTypeDetailPage
