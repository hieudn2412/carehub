import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import {
  ArrowLeftOutlined,
  LoadingOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import '../styles/FormImportWizardPage.css'

function FormImportWizardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryBatchId = searchParams.get('batchId')

  const [loading, setLoading] = useState(Boolean(queryBatchId))
  const [submitting, setSubmitting] = useState(false)
  const [batchId, setBatchId] = useState(queryBatchId || null)
  const [batchDetail, setBatchDetail] = useState(null)
  const [useMock, setUseMock] = useState(false)

  // Input states
  const [code, setCode] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [displayOrder, setDisplayOrder] = useState(0)

  const MOCK_BATCH_VALIDATED = useMemo(() => ({
    id: 101,
    status: 'VALIDATED',
    rowTotal: 1,
    rowSuccess: 1,
    rowErrors: 0,
    rows: [
      {
        id: 201,
        code: 'PATIENT_SAFETY',
        sourceUrl: 'https://docs.google.com/forms/d/e/1FAIpQLS.../viewform',
        status: 'READY',
        messages: [
          { severity: 'WARNING', message: 'Hệ số điểm chưa được cấu hình. Mặc định hệ số = 1.' }
        ]
      }
    ]
  }), [])

  const MOCK_BATCH_APPLIED = useMemo(() => ({
    id: 101,
    status: 'APPLIED',
    rowTotal: 1,
    rowSuccess: 1,
    rowErrors: 0,
    rows: [
      {
        id: 201,
        code: 'PATIENT_SAFETY',
        sourceUrl: 'https://docs.google.com/forms/d/e/1FAIpQLS.../viewform',
        status: 'IMPORTED',
        messages: [
          { severity: 'INFO', message: 'Import hoàn tất: Đã tạo biểu mẫu DRAFT.' }
        ]
      }
    ]
  }), [])

  const loadBatchDetail = useCallback(() => {
    adminApi.getFormImportBatchById(batchId)
      .then((res) => {
        if (res.data?.data) {
          setBatchDetail(res.data.data)
        } else {
          setUseMock(true)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.warn('GET import batch detail failed. Falling back to mockup state.', err)
        setBatchDetail(MOCK_BATCH_VALIDATED)
        setUseMock(true)
        setLoading(false)
      })
  }, [batchId, MOCK_BATCH_VALIDATED])

  useEffect(() => {
    if (batchId) {
      loadBatchDetail()
    }
  }, [batchId, loadBatchDetail])

  const handleValidate = (e) => {
    e.preventDefault()
    if (!code.trim() || !sourceUrl.trim()) {
      alert('Vui lòng nhập đầy đủ mã code và liên kết Google Form.')
      return
    }

    if (!sourceUrl.startsWith('https://docs.google.com/forms')) {
      alert('Liên kết phải bắt đầu bằng https://docs.google.com/forms')
      return
    }

    setSubmitting(true)
    const payload = {
      forms: [
        {
          code: code.trim().toUpperCase(),
          sourceUrl: sourceUrl.trim(),
          displayOrder: parseInt(displayOrder) || 0
        }
      ]
    }

    if (useMock) {
      setTimeout(() => {
        setBatchId('101')
        setBatchDetail(MOCK_BATCH_VALIDATED)
        setSubmitting(false)
      }, 600)
      return
    }

    adminApi.createFormImportBatch(payload)
      .then((res) => {
        const batch = res.data?.data
        if (batch) {
          setBatchId(batch.id)
          alert('Tạo đợt import thành công. Đang phân tích dữ liệu form...')
        } else {
          setUseMock(true)
          setBatchId('101')
        }
        setSubmitting(false)
      })
      .catch((err) => {
        console.warn('POST import batch failed, using mock.', err)
        setUseMock(true)
        setBatchId('101')
        setBatchDetail(MOCK_BATCH_VALIDATED)
        setSubmitting(false)
      })
  }

  const handleApply = () => {
    setSubmitting(true)
    if (useMock) {
      setTimeout(() => {
        setBatchDetail(MOCK_BATCH_APPLIED)
        setSubmitting(false)
        alert('Áp dụng import thành công! Đã tạo biểu mẫu DRAFT trong hệ thống.')
      }, 500)
      return
    }

    adminApi.applyFormImportBatch(batchId)
      .then(() => {
        alert('Áp dụng import thành công!')
        setLoading(true)
        loadBatchDetail()
        setSubmitting(false)
      })
      .catch((err) => {
        setSubmitting(false)
        console.error(err)
        alert(err.response?.data?.message || 'Có lỗi xảy ra khi áp dụng import.')
      })
  }

  const getRowStatusText = (status) => {
    const map = {
      READY: 'Sẵn sàng',
      WARNING: 'Có cảnh báo',
      BLOCKED: 'Không hỗ trợ',
      IMPORTED: 'Đã import',
      SKIPPED: 'Bỏ qua',
      CONFLICT: 'Xung đột',
      FAILED: 'Lỗi'
    }
    return map[status] || status
  }

  const getRowStatusClass = (status) => {
    switch (status) {
      case 'READY':
      case 'IMPORTED':
        return 'row-badge--success'
      case 'WARNING':
        return 'row-badge--warning'
      case 'BLOCKED':
      case 'CONFLICT':
      case 'FAILED':
        return 'row-badge--danger'
      default:
        return 'row-badge--gray'
    }
  }

  const canApply = batchDetail && 
    (batchDetail.status === 'VALIDATED' || batchDetail.status === 'PARTIAL') &&
    batchDetail.rows?.some(r => r.status === 'READY' || r.status === 'WARNING')

  const breadcrumbs = [
    { label: 'Quản lý chất lượng' },
    { label: 'Danh sách checklist', route: '/admin/quality/checklists' },
    { label: batchId ? `Chi tiết lô #${batchId}` : 'Import biểu mẫu mới' }
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="form-import-wizard-page">
              
              {/* Back Nav */}
              <div className="fiw-back" onClick={() => navigate('/admin/quality/checklists')}>
                <ArrowLeftOutlined /> Quay lại danh sách checklist
              </div>

              {!batchId ? (
                /* Step 1: Input URL */
                <div className="fiw-card">
                  <h2 className="fiw-card-title">Nhập liên kết Google Form cần Import</h2>
                  <p className="fiw-card-desc">
                    Hệ thống hỗ trợ parse câu hỏi trắc nghiệm, hộp kiểm, câu hỏi mở và cấu trúc thang điểm từ Google Form công khai.
                  </p>

                  <form onSubmit={handleValidate} className="fiw-form">
                    <div className="fiw-form-grid">
                      <div className="fiw-field">
                        <label>Mã biểu mẫu (Unique Code) <span className="fiw-req">*</span></label>
                        <input
                          type="text"
                          className="fiw-input"
                          placeholder="Ví dụ: VS_TAY_LAM_SANG"
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          required
                        />
                        <span className="fiw-hint">Mã viết hoa, không dấu, phân biệt các mẫu đánh giá.</span>
                      </div>

                      <div className="fiw-field">
                        <label>Thứ tự hiển thị (Display Order)</label>
                        <input
                          type="number"
                          className="fiw-input"
                          value={displayOrder}
                          onChange={(e) => setDisplayOrder(e.target.value)}
                        />
                      </div>

                      <div className="fiw-field fiw-span-2">
                        <label>Liên kết Google Form công khai (Public URL) <span className="fiw-req">*</span></label>
                        <input
                          type="url"
                          className="fiw-input"
                          placeholder="https://docs.google.com/forms/d/e/1FAIpQLS.../viewform"
                          value={sourceUrl}
                          onChange={(e) => setSourceUrl(e.target.value)}
                          required
                        />
                        <span className="fiw-hint">Liên kết dạng /viewform công khai (không yêu cầu đăng nhập tài khoản tổ chức).</span>
                      </div>
                    </div>

                    <div className="fiw-actions">
                      <button type="submit" className="fiw-btn-submit" disabled={submitting}>
                        {submitting ? <LoadingOutlined /> : <><CloudUploadOutlined /> Gửi phân tích & Validate</>}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                /* Step 2: Show Batch Validation & Apply */
                <div className="fiw-container">
                  
                  {/* Status Banner */}
                  <div className="fiw-card fiw-status-banner">
                    <div className="fiw-status-info">
                      <span className="fiw-batch-label">LÔ IMPORT #{batchDetail?.id}</span>
                      <h3 className="fiw-status-title">
                        Trạng thái đợt: <strong>{batchDetail?.status}</strong>
                      </h3>
                      <p className="fiw-status-desc">
                        Tổng số Form: {batchDetail?.totalForms ?? batchDetail?.rowTotal ?? 0} · Thành công: {batchDetail?.successForms ?? batchDetail?.rowSuccess ?? 0} · Lỗi: {batchDetail?.failedForms ?? batchDetail?.rowErrors ?? 0}
                      </p>
                    </div>

                    {canApply && (
                      <button
                        className="fiw-btn-apply"
                        onClick={handleApply}
                        disabled={submitting}
                      >
                        {submitting ? <LoadingOutlined /> : 'Lưu kết quả & Áp dụng Import'}
                      </button>
                    )}
                  </div>

                  {/* Rows validation details */}
                  <div className="fiw-card">
                    <h2 className="fiw-card-title">Kết quả phân tích câu hỏi</h2>
                    <p className="fiw-card-desc">Danh sách các form và trạng thái câu hỏi ghi nhận:</p>

                    <div className="fiw-rows-list">
                      {loading ? (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                          <LoadingOutlined /> Đang tải kết quả...
                        </div>
                      ) : (
                        batchDetail?.rows?.map((row, idx) => (
                          <div key={row.id || idx} className="fiw-row-card">
                            
                            <div className="fiw-row-header">
                              <div>
                                <span className="fiw-row-code">{row.code}</span>
                                <span className="fiw-row-url" title={row.sourceUrl}>
                                  {row.sourceUrl.substring(0, 50)}...
                                </span>
                              </div>
                              <span className={`row-badge ${getRowStatusClass(row.status)}`}>
                                {getRowStatusText(row.status)}
                              </span>
                            </div>

                            {/* Warnings/Infos list */}
                            {row.messages && row.messages.length > 0 && (
                              <div className="fiw-row-messages">
                                {row.messages.map((msg, mIdx) => (
                                  <div key={mIdx} className={`fiw-msg fiw-msg--${msg.severity.toLowerCase()}`}>
                                    {msg.severity === 'WARNING' && <WarningOutlined />}
                                    {msg.severity === 'ERROR' && <CloseCircleOutlined />}
                                    {msg.severity === 'INFO' && <CheckCircleOutlined />}
                                    <span className="fiw-msg-text">{msg.message}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                          </div>
                        ))
                      )}
                    </div>

                    {canApply && (
                      <div className="fiw-bottom-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          className="fiw-btn-apply"
                          onClick={handleApply}
                          disabled={submitting}
                        >
                          {submitting ? <LoadingOutlined /> : 'Lưu kết quả & Áp dụng Import'}
                        </button>
                      </div>
                    )}

                    {batchDetail?.status === 'APPLIED' && (
                      <div className="fiw-completed-banner" style={{ marginTop: '20px' }}>
                        <CheckCircleOutlined /> Import thành công! Các biểu mẫu đã được tạo dưới dạng bản nháp (**DRAFT**). 
                        Vui lòng quay lại danh sách [Quản lý Checklist](/admin/quality/checklists) để thiết kế nâng cao hoặc cấu hình thang điểm và xuất bản (Publish).
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default FormImportWizardPage
