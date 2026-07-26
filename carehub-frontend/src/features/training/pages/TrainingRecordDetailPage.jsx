import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ClockCircleOutlined, EditOutlined, PaperClipOutlined, RollbackOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { trainingApi } from '../api/trainingApi.js'
import { getApiErrorMessage } from '../../auth/utils/apiError.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import EvidenceGallery from '../components/EvidenceGallery.jsx'
import '../../staff/styles/TrainingHours.css'

const statusCfg = {
  SUBMITTED: { label: 'Đã nộp', cls: 'th-badge--success' },
  DRAFT: { label: 'Bản nháp', cls: 'th-badge--warning' },
  CANCELLED: { label: 'Đã hủy', cls: 'th-badge--danger' },
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`))
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
  const [returning, setReturning] = useState(false)

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

  const returnToDraft = async () => {
    if (!window.confirm('Bạn có chắc muốn trả hồ sơ này về nháp?')) return
    setReturning(true)
    try {
      await trainingApi.returnToDraft(id)
      showToast('Đã trả hồ sơ về bản nháp.', 'success')
      await load()
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError, 'Không thể trả hồ sơ về bản nháp.'), 'error')
    } finally {
      setReturning(false)
    }
  }

  const status = statusCfg[record?.workflowStatus] || { label: record?.workflowStatus || '-', cls: 'th-badge--warning' }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader
          back={{ onClick: goBack, label: 'Quay lại' }}
          breadcrumbs={[
            { label: 'Giờ đào tạo liên tục', link: '/training/employees' },
            { label: record?.employeeName || 'Nhân viên', link: record?.employeeId ? `/training/employees/${record.employeeId}` : '/training/employees' },
            { label: 'Chi tiết hồ sơ' },
          ]}
        />
        <div className="dashboard-layout__body">
          <main className="training-page">
            {loading ? <div className="th-table-state">Đang tải thông tin hồ sơ...</div> : null}
            {error ? (
              <div className="th-table-state" role="alert">
                <p>{error}</p>
                <button type="button" className="th-detail-btn" onClick={load}>Thử lại</button>
              </div>
            ) : null}
            {!loading && record ? (
              <>
                <div className="th-detail-header">
                  <div className="th-detail-header__left">
                    <h1 className="th-detail-title">{record.title}</h1>
                    <div className="th-detail-meta">
                      <span><ClockCircleOutlined /> {formatDate(record.startDate)}</span>
                      <span className={`th-badge ${status.cls}`}>{status.label}</span>
                    </div>
                  </div>
                  <div className="th-detail-header__right">
                    <div className="th-detail-hours-ring"><span className="th-detail-hours-value">{record.declaredHours || 0}h</span><span className="th-detail-hours-label">Giờ đào tạo</span></div>
                    <div className="th-detail-evidence-ring"><span className="th-detail-evidence-value"><PaperClipOutlined /> {record.evidences?.length || 0}</span><span className="th-detail-evidence-label">Minh chứng</span></div>
                  </div>
                </div>

                <section id="evidence" ref={evidenceRef} className="th-detail-section">
                  <h3 className="th-detail-section-title"><PaperClipOutlined /> Minh chứng ({record.evidences?.length || 0})</h3>
                  <EvidenceGallery recordId={record.id} evidences={record.evidences || []} onError={message => showToast(message, 'error')} />
                </section>

                <div className="th-detail-actions">
                  {record.workflowStatus === 'DRAFT' ? <button type="button" className="th-detail-btn" onClick={() => navigate(`/training/records/${record.id}/edit`)}><EditOutlined /> Chỉnh sửa thông tin</button> : null}
                  {record.workflowStatus === 'SUBMITTED' ? <button type="button" className="th-detail-btn" onClick={returnToDraft} disabled={returning}><RollbackOutlined /> {returning ? 'Đang xử lý...' : 'Trả về nháp'}</button> : null}
                </div>
              </>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  )
}
