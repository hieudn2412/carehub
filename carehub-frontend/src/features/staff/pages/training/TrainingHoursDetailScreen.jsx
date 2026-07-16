import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  EditOutlined,
  PaperClipOutlined,
  ArrowLeftOutlined,
  SendOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  DownloadOutlined,
  RollbackOutlined,
} from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import '../../styles/TrainingHours.css'

function TrainingHoursDetailScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [returningToDraft, setReturningToDraft] = useState(false)

  const fetchRecord = () => {
    setLoading(true)
    trainingApi.getRecord(id)
      .then(res => setRecord(res.data?.data))
      .catch(() => showToast("Không thể tải hồ sơ.", "error"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchRecord() }, [id])

  const handleSubmit = () => {
    if (!record) return
    setSubmitting(true)
    trainingApi.submitRecord(id, { version: record.version })
      .then(() => { showToast("Nộp hồ sơ thành công!", "success"); fetchRecord() })
      .catch(() => showToast("Nộp hồ sơ thất bại.", "error"))
      .finally(() => setSubmitting(false))
  }

  const handleDownloadEvidence = async (evidenceId) => {
    try {
      const res = await trainingApi.createEvidenceDownloadUrl(id, evidenceId)
      const url = res.data?.data?.url
      if (url) {
        window.open(url, '_blank')
      }
    } catch (err) {
      showToast("Không thể tải minh chứng.", "error")
    }
  }

  const handleReturnToDraft = async () => {
    if (!window.confirm('Bạn có chắc muốn trả hồ sơ này về nháp?')) return
    setReturningToDraft(true)
    try {
      await trainingApi.returnToDraft(id)
      showToast("Đã trả hồ sơ về nháp!", "success")
      fetchRecord()
    } catch (err) {
      showToast("Không thể trả hồ sơ về nháp.", "error")
    } finally {
      setReturningToDraft(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  }

  const statusCfg = {
    SUBMITTED: { label: 'Đã nộp', cls: 'th-badge--success' },
    DRAFT: { label: 'Nháp', cls: 'th-badge--warning' },
    CANCELLED: { label: 'Đã hủy', cls: 'th-badge--danger' },
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header breadcrumbs={[
          { label: 'Giờ đào tạo', link: '/staff/training' },
          { label: 'Chi tiết' }
        ]} />
        <div className="dashboard-layout__body">
          <div className="training-page">

            {loading ? (
              <div className="th-table-state">Đang tải thông tin...</div>
            ) : !record ? (
              <div className="th-table-state">Không tìm thấy hồ sơ.</div>
            ) : (
              <>
                {/* Back link + Title */}
                <button className="th-back-link" onClick={() => navigate('/staff/training')}>
                  <ArrowLeftOutlined /> Quay lại danh sách
                </button>

                <div className="th-detail-header">
                  <div className="th-detail-header__left">
                    <h1 className="th-detail-title">{record.title}</h1>
                    <div className="th-detail-meta">
                      <span><ClockCircleOutlined /> {formatDate(record.startDate)}</span>
                      {record.provider && <span><EnvironmentOutlined /> {record.provider}</span>}
                      <span className={`th-badge ${(statusCfg[record.workflowStatus] || statusCfg.DRAFT).cls}`}>
                        {(statusCfg[record.workflowStatus] || statusCfg.DRAFT).label}
                      </span>
                    </div>
                  </div>
                  <div className="th-detail-header__right">
                    <div className="th-detail-hours-ring">
                      <span className="th-detail-hours-value">{record.declaredHours}h</span>
                      <span className="th-detail-hours-label">Giờ đào tạo</span>
                    </div>
                    <div className="th-detail-evidence-ring">
                      <span className="th-detail-evidence-value">
                        <PaperClipOutlined /> {record.evidences?.length || 0}
                      </span>
                      <span className="th-detail-evidence-label">Minh chứng</span>
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="th-detail-grid">
                  <div className="th-detail-block">
                    <label className="th-detail-label">Tên khoá đào tạo</label>
                    <div className="th-detail-text">{record.title}</div>
                  </div>
                  <div className="th-detail-block">
                    <label className="th-detail-label">Số giờ đào tạo</label>
                    <div className="th-detail-text th-detail-text--em">{record.declaredHours} giờ</div>
                  </div>
                  <div className="th-detail-block">
                    <label className="th-detail-label">Ngày bắt đầu</label>
                    <div className="th-detail-text">{formatDate(record.startDate)}</div>
                  </div>
                  <div className="th-detail-block">
                    <label className="th-detail-label">Hình thức đào tạo</label>
                    <div className="th-detail-text">{record.activityTypeName || '-'}</div>
                  </div>
                  <div className="th-detail-block">
                    <label className="th-detail-label">Đơn vị tổ chức</label>
                    <div className="th-detail-text">{record.provider || '-'}</div>
                  </div>
                  <div className="th-detail-block th-detail-block--full">
                    <label className="th-detail-label">Ghi chú</label>
                    <div className="th-detail-text">{record.description || 'Không có ghi chú'}</div>
                  </div>
                </div>

                {/* Evidence Preview */}
                {record.evidences && record.evidences.length > 0 && (
                  <div className="th-detail-section">
                    <h3 className="th-detail-section-title">
                      <PaperClipOutlined /> Minh chứng ({record.evidences.length})
                    </h3>
                    <div className="th-evidence-grid">
                      {record.evidences.map(ev => (
                        <div key={ev.id} className="th-evidence-item">
                          <PaperClipOutlined className="th-evidence-item__icon" />
                          <span className="th-evidence-item__name">{ev.originalFilename}</span>
                          <span className={`th-badge th-badge--${
                            ev.moderationStatus === 'PASSED' ? 'success'
                              : ev.moderationStatus === 'FAILED' || ev.moderationStatus === 'ERROR' ? 'danger'
                              : 'warning'
                          } th-badge--sm`}>
                            {ev.moderationStatus === 'PASSED' ? 'Đã duyệt'
                              : ev.moderationStatus === 'FAILED' ? 'Từ chối'
                              : ev.moderationStatus === 'ERROR' ? 'Lỗi'
                              : 'Chờ duyệt'}
                          </span>
                          <button
                            className="th-detail-btn"
                            onClick={() => handleDownloadEvidence(ev.id)}
                            style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '0.8rem' }}
                          >
                            <DownloadOutlined /> Tải
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="th-detail-actions">
                  {record.workflowStatus === 'DRAFT' && (
                    <>
                      <button className="th-detail-btn th-detail-btn--primary" onClick={handleSubmit} disabled={submitting}>
                        <SendOutlined /> {submitting ? 'Đang nộp...' : 'Nộp hồ sơ'}
                      </button>
                      <button className="th-detail-btn" onClick={() => navigate(`/staff/training/${record.id}/edit`)}>
                        <EditOutlined /> Chỉnh sửa
                      </button>
                    </>
                  )}
                  {record.workflowStatus === 'SUBMITTED' && (
                    <button
                      className="th-detail-btn"
                      onClick={handleReturnToDraft}
                      disabled={returningToDraft}
                    >
                      <RollbackOutlined /> {returningToDraft ? 'Đang xử lý...' : 'Trả về nháp'}
                    </button>
                  )}
                  <button className="th-detail-btn" onClick={() => navigate(`/staff/training/${record.id}/evidence`)}>
                    <PaperClipOutlined /> Quản lý minh chứng
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrainingHoursDetailScreen
