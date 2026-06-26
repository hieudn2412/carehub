import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import { legacyGoogleFormImports } from '../data/legacyGoogleFormImports.js'
import {
  getChecklistDisplayCode,
  normalizeVietnameseFormCode,
} from '../utils/formCode.js'
import {
  ArrowLeftOutlined,
  LoadingOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  NumberOutlined,
} from '@ant-design/icons'
import '../styles/FormImportWizardPage.css'

const BATCH_STATUS_TEXT = {
  PENDING: 'Đang chờ xử lý',
  PROCESSING: 'Đang phân tích',
  VALIDATED: 'Đã kiểm tra, sẵn sàng import',
  PARTIAL: 'Một phần sẵn sàng import',
  FAILED: 'Kiểm tra thất bại',
  APPLYING: 'Đang ghi dữ liệu',
  APPLIED: 'Đã import thành công',
  APPLIED_PARTIAL: 'Đã import một phần',
}

const ROW_STATUS_TEXT = {
  PENDING: 'Đang chờ xử lý',
  READY: 'Sẵn sàng',
  WARNING: 'Có cảnh báo',
  BLOCKED: 'Không hỗ trợ',
  IMPORTED: 'Đã import',
  SKIPPED: 'Không có thay đổi',
  CONFLICT: 'Xung đột',
  FAILED: 'Lỗi',
}

const getApiErrorMessage = (error, fallback) => (
  error?.response?.data?.message
  || error?.response?.data?.error
  || fallback
)

const getImportMessageText = (message) => {
  const text = message?.trim() || ''

  if (/form code already exists/i.test(text)) {
    return 'Mã biểu mẫu đã tồn tại trong hệ thống.'
  }

  return text
}

const createImportSource = (index) => ({
  id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
  code: '',
  sourceUrl: '',
  displayOrder: index,
})

const LEGACY_IMPORT_PRESET = 'legacy-18'

const createInitialImportSources = (useLegacyPreset) => {
  if (!useLegacyPreset) {
    return [createImportSource(0)]
  }

  return legacyGoogleFormImports.map((source, index) => ({
    ...createImportSource(index),
    ...source,
  }))
}

function FormImportWizardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryBatchId = searchParams.get('batchId')
  const hasLegacyPreset = searchParams.get('preset') === LEGACY_IMPORT_PRESET

  const [loading, setLoading] = useState(Boolean(queryBatchId))
  const [submitting, setSubmitting] = useState(false)
  const [batchId, setBatchId] = useState(queryBatchId || null)
  const [batchDetail, setBatchDetail] = useState(null)
  const [batchVerified, setBatchVerified] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [importSources, setImportSources] = useState(() => createInitialImportSources(hasLegacyPreset))

  const switchImportPreset = (useLegacyPreset) => {
    setErrorMessage('')
    setBatchId(null)
    setBatchDetail(null)
    setBatchVerified(false)
    setLoading(false)
    setImportSources(createInitialImportSources(useLegacyPreset))
    navigate(useLegacyPreset
      ? `/admin/form-imports/new?preset=${LEGACY_IMPORT_PRESET}`
      : '/admin/form-imports/new')
  }

  const loadBatchDetail = useCallback(() => {
    adminApi.getFormImportBatchById(batchId)
      .then((res) => {
        const batch = res.data?.data
        if (!batch) {
          throw new Error('Phản hồi chi tiết lô import không hợp lệ.')
        }

        setBatchDetail(batch)
        setBatchVerified(true)
        setErrorMessage('')
        setLoading(false)
      })
      .catch((err) => {
        console.error('Không thể tải chi tiết lô import.', err)
        setBatchDetail(null)
        setBatchVerified(false)
        setErrorMessage(getApiErrorMessage(err, 'Không thể tải kết quả kiểm tra lô import.'))
        setLoading(false)
      })
  }, [batchId])

  useEffect(() => {
    if (batchId) {
      loadBatchDetail()
    }
  }, [batchId, loadBatchDetail])

  const updateImportSource = (sourceId, field, value) => {
    setImportSources((current) => current.map((source) => (
      source.id === sourceId ? { ...source, [field]: value } : source
    )))
  }

  const addImportSource = () => {
    if (importSources.length >= 25) {
      setErrorMessage('Mỗi lô import chỉ được chứa tối đa 25 Google Form.')
      return
    }

    setImportSources((current) => {
      const nextDisplayOrder = current.reduce((highest, source) => {
        const order = Number.parseInt(source.displayOrder, 10)
        return Number.isInteger(order) ? Math.max(highest, order) : highest
      }, -1) + 1

      return [...current, createImportSource(nextDisplayOrder)]
    })
  }

  const removeImportSource = (sourceId) => {
    if (importSources.length === 1) {
      return
    }

    setImportSources((current) => current.filter((source) => source.id !== sourceId))
  }

  const handleValidate = (e) => {
    e.preventDefault()
    const normalizedSources = importSources.map((source) => ({
      ...source,
      code: normalizeVietnameseFormCode(source.code),
      sourceUrl: source.sourceUrl.trim(),
      displayOrder: Number.parseInt(source.displayOrder, 10),
    }))
    const codes = normalizedSources.map((source) => source.code)
    const displayOrders = normalizedSources.map((source) => source.displayOrder)

    if (normalizedSources.some((source) => source.code.length < 2 || !source.sourceUrl)) {
      setErrorMessage('Vui lòng nhập đầy đủ mã và liên kết cho mọi Google Form.')
      return
    }

    if (normalizedSources.some((source) => (
      !source.sourceUrl.startsWith('https://docs.google.com/forms')
    ))) {
      setErrorMessage('Mọi liên kết phải bắt đầu bằng https://docs.google.com/forms.')
      return
    }

    if (normalizedSources.some((source) => (
      !Number.isInteger(source.displayOrder) || source.displayOrder < 0
    ))) {
      setErrorMessage('Thứ tự hiển thị phải là số nguyên không âm.')
      return
    }

    if (new Set(codes).size !== codes.length) {
      setErrorMessage('Mã biểu mẫu không được trùng nhau trong cùng một lô import.')
      return
    }

    if (new Set(displayOrders).size !== displayOrders.length) {
      setErrorMessage('Thứ tự hiển thị không được trùng nhau trong cùng một lô import.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    const payload = {
      forms: normalizedSources.map(({ code, sourceUrl, displayOrder }) => ({
        code,
        sourceUrl,
        displayOrder,
      })),
    }

    adminApi.createFormImportBatch(payload)
      .then((res) => {
        const batch = res.data?.data
        if (!batch?.id) {
          throw new Error('Phản hồi tạo lô import không hợp lệ.')
        }

        setImportSources(normalizedSources)
        setBatchDetail(batch)
        setBatchVerified(false)
        setLoading(true)
        setBatchId(String(batch.id))
        navigate(`/admin/form-imports/new?batchId=${batch.id}`, { replace: true })
        setSubmitting(false)
      })
      .catch((err) => {
        console.error('Không thể tạo lô import.', err)
        setErrorMessage(getApiErrorMessage(err, 'Không thể gửi Google Form để kiểm tra.'))
        setSubmitting(false)
      })
  }

  const handleApply = () => {
    if (!batchVerified) {
      setErrorMessage('Cần tải và kiểm tra chi tiết lô import trước khi áp dụng.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    adminApi.applyFormImportBatch(batchId)
      .then((res) => {
        const appliedBatch = res.data?.data
        if (appliedBatch) {
          setBatchDetail(appliedBatch)
          setBatchVerified(true)
        } else {
          setBatchVerified(false)
          setLoading(true)
          loadBatchDetail()
        }
        setSubmitting(false)
      })
      .catch((err) => {
        setSubmitting(false)
        console.error(err)
        setErrorMessage(getApiErrorMessage(err, 'Có lỗi xảy ra khi ghi biểu mẫu vào hệ thống.'))
      })
  }

  const getRowStatusText = (status) => {
    return ROW_STATUS_TEXT[status] || status
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

  const canApply = batchVerified && batchDetail &&
    (batchDetail.status === 'VALIDATED' || batchDetail.status === 'PARTIAL') &&
    batchDetail.rows?.some(r => r.status === 'READY' || r.status === 'WARNING')
  const isApplied = batchDetail?.status === 'APPLIED' || batchDetail?.status === 'APPLIED_PARTIAL'
  const successfulForms = Number(batchDetail?.successForms) || 0
  const failedForms = Number(batchDetail?.failedForms) || 0
  const applyOutcome = !isApplied
    ? null
    : successfulForms === 0 && failedForms > 0
      ? 'failed'
      : failedForms > 0 || batchDetail?.status === 'APPLIED_PARTIAL'
        ? 'partial'
        : 'success'

  const appliedStatusText = applyOutcome === 'failed'
    ? 'Import thất bại'
    : applyOutcome === 'partial'
      ? 'Đã import một phần'
      : BATCH_STATUS_TEXT[batchDetail?.status] || batchDetail?.status

  const inputStepTitle = hasLegacyPreset
    ? `Import ${legacyGoogleFormImports.length} Google Form cũ`
    : 'Nhập liên kết Google Form cần Import'
  const inputStepDescription = hasLegacyPreset
    ? `Danh sách ${legacyGoogleFormImports.length} biểu mẫu cũ đã được nạp sẵn. Bạn vẫn có thể rà lại mã, thứ tự và liên kết trước khi gửi backend kiểm tra.`
    : 'Thêm tối đa 25 Google Form công khai. Hệ thống sẽ gửi tất cả liên kết trong một lô để kiểm tra trước khi ghi vào cơ sở dữ liệu.'
  const activeStep = isApplied ? 3 : batchId ? 2 : 1
  const batchRows = batchDetail?.rows || []
  const metricCards = [
    { label: 'Tổng form', value: batchDetail?.totalForms ?? importSources.length, tone: 'neutral' },
    { label: isApplied ? 'Đã import' : 'Có thể import', value: batchDetail?.successForms ?? 0, tone: 'success' },
    { label: 'Cảnh báo', value: batchDetail?.warningForms ?? 0, tone: 'warning' },
    { label: 'Lỗi', value: batchDetail?.failedForms ?? 0, tone: 'danger' },
  ]
  const importModeTitle = hasLegacyPreset ? 'Bộ 18 form cũ' : 'Import tùy chỉnh'
  const importModeDesc = hasLegacyPreset
    ? 'Dữ liệu cũ đã được nạp sẵn, chỉ cần kiểm tra rồi gửi backend.'
    : 'Tự thêm từng Google Form công khai bằng mã biểu mẫu và URL.'

  const getStepClass = (stepNumber) => {
    if (activeStep === stepNumber) {
      return 'is-current'
    }

    return activeStep > stepNumber ? 'is-done' : ''
  }

  const breadcrumbs = [
    { label: 'Quản lý chất lượng' },
    { label: 'Danh sách checklist', route: '/admin/quality/checklists' },
    {
      label: batchId
        ? `Chi tiết lô #${batchId}`
        : hasLegacyPreset
          ? 'Import 18 form cũ'
          : 'Import biểu mẫu mới',
    }
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="form-import-wizard-page">
              <section className="fiw-hero">
                <div className="fiw-hero-top">
                  <button
                    className="fiw-back"
                    onClick={() => navigate('/admin/quality/checklists')}
                    type="button"
                  >
                    <ArrowLeftOutlined /> Quay lại danh sách checklist
                  </button>
                  <span className="fiw-mode-chip">{importModeTitle}</span>
                </div>

                <div className="fiw-hero-main">
                  <div>
                    <span className="fiw-eyebrow">Import Google Form</span>
                    <h1>{inputStepTitle}</h1>
                    <p>{inputStepDescription}</p>
                  </div>
                  {!batchId && (
                    <button
                      className="fiw-mode-switch"
                      onClick={() => switchImportPreset(!hasLegacyPreset)}
                      type="button"
                    >
                      {hasLegacyPreset ? 'Chuyển sang import mới' : 'Nạp 18 form cũ'}
                    </button>
                  )}
                </div>

                <div className="fiw-steps" aria-label="Tiến trình import">
                  <div className={`fiw-step ${getStepClass(1)}`}>
                    <span>1</span>
                    <strong>Nhập nguồn</strong>
                  </div>
                  <div className={`fiw-step ${getStepClass(2)}`}>
                    <span>2</span>
                    <strong>Kiểm tra</strong>
                  </div>
                  <div className={`fiw-step ${getStepClass(3)}`}>
                    <span>3</span>
                    <strong>Áp dụng</strong>
                  </div>
                </div>
              </section>

              {errorMessage && (
                <div className="fiw-error" role="alert">
                  <CloseCircleOutlined />
                  <span>{errorMessage}</span>
                  {batchId && !batchVerified && (
                    <button
                      type="button"
                      onClick={() => {
                        setLoading(true)
                        setErrorMessage('')
                        loadBatchDetail()
                      }}
                    >
                      Thử tải lại
                    </button>
                  )}
                </div>
              )}

              {!batchId ? (
                /* Step 1: Input URL */
                <div className="fiw-import-layout">
                  <aside className="fiw-side-panel">
                    <div className="fiw-side-card">
                      <span className="fiw-side-icon">
                        <FileTextOutlined />
                      </span>
                      <strong>{importModeTitle}</strong>
                      <p>{importModeDesc}</p>
                      <div className="fiw-side-count">
                        <span>{importSources.length}</span>
                        <small>biểu mẫu trong lô</small>
                      </div>
                    </div>

                    <div className="fiw-side-card fiw-side-card--tips">
                      <strong>
                        <InfoCircleOutlined />
                        Lưu ý trước khi gửi
                      </strong>
                      <ul>
                        <li>Mỗi mã biểu mẫu phải là duy nhất trong cùng một lô.</li>
                        <li>Link cần là Google Form công khai và bắt đầu bằng HTTPS.</li>
                        <li>Sau bước kiểm tra, hệ thống mới ghi form vào danh sách checklist.</li>
                      </ul>
                    </div>
                  </aside>

                  <div className="fiw-card fiw-import-card">
                    <div className="fiw-card-heading">
                      <div>
                        <h2 className="fiw-card-title">Danh sách Google Form</h2>
                        <p className="fiw-card-desc">
                          Rà lại mã, thứ tự hiển thị và đường dẫn trước khi gửi backend kiểm tra.
                        </p>
                      </div>
                      <span className="fiw-source-total">{importSources.length}/25 form</span>
                    </div>

                    <form onSubmit={handleValidate} className="fiw-form">
                      <div className="fiw-source-list">
                        {importSources.map((source, index) => (
                          <div className="fiw-source-card" key={source.id}>
                            <div className="fiw-source-header">
                              <span className="fiw-source-number">
                                {String(index + 1).padStart(2, '0')}
                              </span>
                              <div>
                                <strong>Google Form {index + 1}</strong>
                                <small>{source.code || 'Chưa có mã biểu mẫu'}</small>
                              </div>
                              {importSources.length > 1 && (
                                <button
                                  aria-label={`Xóa Google Form ${index + 1}`}
                                  className="fiw-source-remove"
                                  onClick={() => removeImportSource(source.id)}
                                  type="button"
                                >
                                  <DeleteOutlined />
                                </button>
                              )}
                            </div>

                            <div className="fiw-form-grid">
                              <div className="fiw-field">
                                <label>
                                  <FileTextOutlined />
                                  Mã biểu mẫu <span className="fiw-req">*</span>
                                </label>
                                <input
                                  className="fiw-input"
                                  maxLength={50}
                                  minLength={2}
                                  onChange={(event) => updateImportSource(
                                    source.id,
                                    'code',
                                    event.target.value,
                                  )}
                                  onBlur={(event) => updateImportSource(
                                    source.id,
                                    'code',
                                    normalizeVietnameseFormCode(event.target.value),
                                  )}
                                  placeholder="Ví dụ: VE_SINH_TAY_LAM_SANG"
                                  required
                                  type="text"
                                  value={source.code}
                                />
                              </div>

                              <div className="fiw-field">
                                <label>
                                  <NumberOutlined />
                                  Thứ tự
                                </label>
                                <input
                                  className="fiw-input"
                                  min="0"
                                  onChange={(event) => updateImportSource(
                                    source.id,
                                    'displayOrder',
                                    event.target.value,
                                  )}
                                  required
                                  type="number"
                                  value={source.displayOrder}
                                />
                              </div>

                              <div className="fiw-field fiw-span-2">
                                <label>
                                  <LinkOutlined />
                                  Liên kết Google Form công khai
                                  <span className="fiw-req"> *</span>
                                </label>
                                <input
                                  className="fiw-input"
                                  onChange={(event) => updateImportSource(
                                    source.id,
                                    'sourceUrl',
                                    event.target.value,
                                  )}
                                  placeholder="https://docs.google.com/forms/d/e/.../viewform"
                                  required
                                  type="url"
                                  value={source.sourceUrl}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="fiw-actions">
                        <button
                          className="fiw-btn-add-source"
                          disabled={submitting || importSources.length >= 25}
                          onClick={addImportSource}
                          type="button"
                        >
                          <PlusOutlined /> Thêm Google Form
                        </button>
                        <button type="submit" className="fiw-btn-submit" disabled={submitting}>
                          {submitting ? (
                            <LoadingOutlined />
                          ) : (
                            <>
                              <CloudUploadOutlined />
                              Kiểm tra {importSources.length} biểu mẫu
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : (
                /* Step 2: Show Batch Validation & Apply */
                <div className="fiw-container">
                  
                  {/* Status Banner */}
                  <div className="fiw-card fiw-status-banner">
                    <div className="fiw-status-info">
                      <span className="fiw-batch-label">LÔ IMPORT #{batchDetail?.id}</span>
                      <h2 className="fiw-status-title">{appliedStatusText}</h2>
                      <p className="fiw-status-desc">
                        Đây là kết quả backend trả về sau khi phân tích các Google Form trong lô.
                        Kiểm tra lỗi/cảnh báo trước khi áp dụng import vào danh sách checklist.
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

                  <div className="fiw-metrics-grid">
                    {metricCards.map((metric) => (
                      <div className={`fiw-metric-card fiw-metric-card--${metric.tone}`} key={metric.label}>
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                      </div>
                    ))}
                  </div>

                  {/* Rows validation details */}
                  <div className="fiw-card">
                    <div className="fiw-card-heading">
                      <div>
                        <h2 className="fiw-card-title">Kết quả phân tích câu hỏi</h2>
                        <p className="fiw-card-desc">
                          Danh sách form, trạng thái từng form và lỗi/cảnh báo backend ghi nhận.
                        </p>
                      </div>
                    </div>

                    <div className="fiw-rows-list">
                      {loading ? (
                        <div className="fiw-loading-state">
                          <LoadingOutlined /> Đang tải kết quả...
                        </div>
                      ) : (
                        batchRows.length === 0 ? (
                          <div className="fiw-empty-state">
                            Chưa có dữ liệu phân tích cho lô import này.
                          </div>
                        ) : batchRows.map((row, idx) => (
                          <div key={row.id || idx} className="fiw-row-card">
                            
                            <div className="fiw-row-header">
                              <div>
                                <span
                                  className="fiw-row-code"
                                  title={`Mã hệ thống: ${row.code}`}
                                >
                                  {getChecklistDisplayCode(row.code)}
                                </span>
                                <span className="fiw-row-url" title={row.sourceUrl}>
                                  {row.sourceUrl?.length > 50 ? `${row.sourceUrl.substring(0, 50)}...` : row.sourceUrl}
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
                                  <div key={mIdx} className={`fiw-msg fiw-msg--${msg.severity?.toLowerCase() || 'info'}`}>
                                    {msg.severity === 'WARNING' && <WarningOutlined />}
                                    {msg.severity === 'ERROR' && <CloseCircleOutlined />}
                                    {msg.severity === 'INFO' && <CheckCircleOutlined />}
                                    <span className="fiw-msg-text">
                                      {getImportMessageText(msg.message)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                          </div>
                        ))
                      )}
                    </div>

                    {canApply && (
                      <div className="fiw-bottom-actions">
                        <button
                          className="fiw-btn-apply"
                          onClick={handleApply}
                          disabled={submitting}
                        >
                          {submitting ? <LoadingOutlined /> : 'Lưu kết quả & Áp dụng Import'}
                        </button>
                      </div>
                    )}

                    {isApplied && (
                      <div
                        className={`fiw-completed-banner fiw-completed-banner--${applyOutcome}`}
                        style={{ marginTop: '20px' }}
                        role={applyOutcome === 'failed' ? 'alert' : 'status'}
                      >
                        {applyOutcome === 'success' && <CheckCircleOutlined />}
                        {applyOutcome === 'partial' && <WarningOutlined />}
                        {applyOutcome === 'failed' && <CloseCircleOutlined />}
                        <div>
                          {applyOutcome === 'success' && (
                            <>
                              <strong>Import hoàn tất.</strong> {successfulForms} biểu mẫu đã
                              được tạo dưới dạng bản nháp.
                            </>
                          )}
                          {applyOutcome === 'partial' && (
                            <>
                              <strong>Import hoàn tất một phần.</strong> {successfulForms} biểu
                              mẫu đã được tạo, {failedForms} biểu mẫu lỗi không được import.
                            </>
                          )}
                          {applyOutcome === 'failed' && (
                            <>
                              <strong>Import thất bại.</strong> Không có biểu mẫu nào được tạo.
                              Vui lòng kiểm tra lỗi bên trên và sử dụng mã biểu mẫu khác.
                            </>
                          )}
                          <button
                            type="button"
                            className="fiw-completed-link"
                            onClick={() => navigate('/admin/quality/checklists')}
                          >
                            Xem danh sách checklist
                          </button>
                        </div>
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
