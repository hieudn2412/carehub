import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ClockCircleOutlined,
  InfoCircleOutlined,
  PaperClipOutlined,
  UserOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../../shared/api/apiError.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import EvidenceGallery from '../components/EvidenceGallery.jsx'
import '../styles/TrainingHours.css'

const statusCfg = {
  SUBMITTED: { label: 'Đã nộp', cls: 'th-badge--success' },
  DRAFT: { label: 'Bản nháp', cls: 'th-badge--warning' },
  CANCELLED: { label: 'Đã hủy', cls: 'th-badge--danger' },
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`))
}

function formatDateTime(value) {
  if (!value) return '-'
  const d = new Date(value)
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export default function TrainingRecordDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  const evidenceRef = useRef(null)
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await trainingApi.getRecord(id)
      setRecord(response.data?.data || null)
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Không thể tải hồ sơ đào tạo.'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (!loading && record && location.hash === '#evidence') {
      window.setTimeout(() => evidenceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
    }
  }, [loading, location.hash, record])

  const goBack = () => navigate(record?.employeeId ? `/training/employees/${record.employeeId}` : '/training/employees')

  const status = statusCfg[record?.workflowStatus] || { label: record?.workflowStatus || '-', cls: 'th-badge--warning' }

  return (
    <AppShell
      className="dashboard-layout"
      back={{ onClick: goBack, label: 'Quay lại' }}
      breadcrumbs={[
        { label: 'Giờ đào tạo liên tục', link: '/training/employees' },
        {
          label: record?.employeeName || 'Nhân viên',
          link: record?.employeeId ? `/training/employees/${record.employeeId}` : '/training/employees',
        },
        { label: 'Chi tiết hồ sơ' },
      ]}
    >
      <div className="training-page">
            {loading ? <div className="th-table-state">Đang tải thông tin hồ sơ...</div> : null}
            {error ? (
              <div className="th-table-state" role="alert">
                <p>{error}</p>
                <button type="button" className="th-detail-btn" onClick={load}>
                  Thử lại
                </button>
              </div>
            ) : null}
            {!loading && record ? (
              <>
                {/* Header Card */}
                <div className="th-detail-header">
                  <div className="th-detail-header__left">
                    <h1 className="th-detail-title">{record.title}</h1>
                    <div className="th-detail-meta">
                      {record.employeeName && (
                        <span className="th-detail-meta__field" style={{ color: '#0284c7', fontWeight: 600 }}>
                          <UserOutlined /> {record.employeeName} {record.employeeCode ? `(${record.employeeCode})` : ''}
                        </span>
                      )}
                      <span>
                        <ClockCircleOutlined /> {formatDate(record.startDate)}
                      </span>
                      <span className={`th-badge ${status.cls}`}>{status.label}</span>
                    </div>
                  </div>
                  <div className="th-detail-header__right">
                    <div className="th-detail-hours-ring">
                      <span className="th-detail-hours-value">{record.declaredHours || 0}h</span>
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

                {/* Section 1: Detailed Information Grid */}
                <section className="th-detail-section" style={{ marginBottom: '24px' }}>
                  <h3 className="th-detail-section-title">
                    <InfoCircleOutlined /> Thông tin chi tiết hồ sơ
                  </h3>
                  <div className="th-detail-grid">
                    <div className="th-detail-block">
                      <label className="th-detail-label">Nhân viên khai báo</label>
                      <div className="th-detail-text" style={{ fontWeight: 600, color: '#0f172a' }}>
                        {record.employeeName} {record.employeeCode ? `(${record.employeeCode})` : ''}
                      </div>
                    </div>
                    <div className="th-detail-block">
                      <label className="th-detail-label">Tên khóa / Nội dung đào tạo</label>
                      <div className="th-detail-text" style={{ fontWeight: 600 }}>{record.title}</div>
                    </div>
                    <div className="th-detail-block">
                      <label className="th-detail-label">Số giờ quy đổi</label>
                      <div className="th-detail-text th-detail-text--em">{record.declaredHours || 0} giờ</div>
                    </div>
                    <div className="th-detail-block">
                      <label className="th-detail-label">Ngày bắt đầu</label>
                      <div className="th-detail-text">{formatDate(record.startDate)}</div>
                    </div>
                    <div className="th-detail-block">
                      <label className="th-detail-label">Ngày kết thúc</label>
                      <div className="th-detail-text">{formatDate(record.endDate || record.startDate)}</div>
                    </div>
                    <div className="th-detail-block">
                      <label className="th-detail-label">Hình thức đào tạo</label>
                      <div className="th-detail-text">{record.activityTypeName || '-'}</div>
                    </div>
                    <div className="th-detail-block">
                      <label className="th-detail-label">Lĩnh vực chuyên môn</label>
                      <div className="th-detail-text">{record.professionalFieldName || '-'}</div>
                    </div>
                    <div className="th-detail-block">
                      <label className="th-detail-label">Thời gian nộp hồ sơ</label>
                      <div className="th-detail-text">{formatDateTime(record.submittedAt || record.createdAt)}</div>
                    </div>
                    <div className="th-detail-block th-detail-block--full">
                      <label className="th-detail-label">Ghi chú / Mô tả chi tiết</label>
                      <div className="th-detail-text">{record.description || 'Không có ghi chú'}</div>
                    </div>
                  </div>
                </section>

                {/* Section 2: Evidences Gallery */}
                <section id="evidence" ref={evidenceRef} className="th-detail-section">
                  <h3 className="th-detail-section-title">
                    <PaperClipOutlined /> Hình ảnh minh chứng ({record.evidences?.length || 0})
                  </h3>
                  <EvidenceGallery recordId={record.id} evidences={record.evidences || []} onError={(message) => showToast(message, 'error')} />
                </section>
              </>
            ) : null}
      </div>
    </AppShell>
  )
}
