import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import { getChecklistDisplayCode } from '../utils/formCode.js'
import {
  ArrowLeftOutlined,
  SearchOutlined,
  LoadingOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import '../styles/FormPreviewPage.css'

function FormPreviewPage() {
  const { showToast } = useToast()
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const versionId = searchParams.get('versionId')

  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [version, setVersion] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  // Subject lookup state
  const [employeeCode, setEmployeeCode] = useState('')
  const [subjectDetails, setSubjectDetails] = useState(null)
  const [subjectLoading, setSubjectLoading] = useState(false)
  const [subjectError, setSubjectError] = useState('')

  // Dummy form states for rendering preview controls
  const [formAnswers, setFormAnswers] = useState({})

  const loadPreviewData = useCallback(() => {
    const params = versionId ? { versionId } : {}
    adminApi.getFormPreviewById(id, params)
      .then((res) => {
        const preview = res.data?.data
        if (!preview?.form || !preview?.version) {
          throw new Error('Phản hồi xem trước biểu mẫu không hợp lệ.')
        }

        setForm(preview.form)
        setVersion(preview.version)
        setErrorMessage('')
      })
      .catch((err) => {
        console.error('Không thể tải dữ liệu xem trước.', err)
        setForm(null)
        setVersion(null)
        setErrorMessage(
          err.response?.data?.message || 'Không thể tải dữ liệu xem trước biểu mẫu.',
        )
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id, versionId])

  useEffect(() => {
    loadPreviewData()
  }, [loadPreviewData])

  const handleSubjectLookup = () => {
    if (!employeeCode.trim()) {
      showToast('Vui lòng nhập mã nhân viên để tra cứu.', 'warning')
      return
    }

    setSubjectLoading(true)
    setSubjectError('')
    setSubjectDetails(null)
    adminApi.findFormSubject({ employeeCode: employeeCode.trim() })
      .then((res) => {
        if (res.data?.data) {
          setSubjectDetails(res.data.data)
        } else {
          setSubjectError('Không tìm thấy nhân viên hoặc bạn không có quyền truy cập.')
        }
      })
      .catch((error) => {
        console.error('Không thể tra cứu nhân viên.', error)
        setSubjectError(
          error.response?.data?.message || 'Không thể tra cứu nhân viên.',
        )
      })
      .finally(() => {
        setSubjectLoading(false)
      })
  }

  const handleAnswerChange = (qKey, value) => {
    setFormAnswers((prev) => ({
      ...prev,
      [qKey]: value,
    }))
  }

  // Sorting helper
  const getSortedSections = () => {
    if (!version || !version.sections) return []
    return [...version.sections].sort((a, b) => a.displayOrder - b.displayOrder)
  }

  const getSortedItems = (sec) => {
    if (!sec || !sec.items) return []
    return [...sec.items].sort((a, b) => a.displayOrder - b.displayOrder)
  }

  const getSortedOptions = (q) => {
    if (!q || !q.options) return []
    return [...q.options].sort((a, b) => a.displayOrder - b.displayOrder)
  }

  // --- Dynamic Renderer ---

  const renderQuestionField = (item) => {
    const q = item.question
    if (!q) return null

    const sortedOpts = getSortedOptions(q)
    const val = formAnswers[q.questionKey] || ''

    switch (q.fieldType) {
      case 'SHORT_TEXT':
        return (
          <input
            type="text"
            className="fpp-input"
            value={val}
            onChange={(e) => handleAnswerChange(q.questionKey, e.target.value)}
            placeholder="Nhập câu trả lời ngắn..."
          />
        )
      case 'LONG_TEXT':
        return (
          <textarea
            className="fpp-textarea"
            value={val}
            onChange={(e) => handleAnswerChange(q.questionKey, e.target.value)}
            placeholder="Nhập ý kiến nhận xét chi tiết..."
          />
        )
      case 'NUMBER':
        return (
          <input
            type="number"
            className="fpp-input"
            style={{ width: '150px' }}
            value={val}
            onChange={(e) => handleAnswerChange(q.questionKey, e.target.value)}
            placeholder="Nhập số..."
          />
        )
      case 'BOOLEAN':
        return (
          <div className="fpp-radio-group">
            <label className="fpp-radio-label">
              <input
                type="radio"
                name={q.questionKey}
                checked={val === 'true'}
                onChange={() => handleAnswerChange(q.questionKey, 'true')}
              /> Có (Đạt)
            </label>
            <label className="fpp-radio-label">
              <input
                type="radio"
                name={q.questionKey}
                checked={val === 'false'}
                onChange={() => handleAnswerChange(q.questionKey, 'false')}
              /> Không (Không đạt)
            </label>
          </div>
        )
      case 'SINGLE_CHOICE':
      case 'DROPDOWN':
        if (q.fieldType === 'DROPDOWN') {
          return (
            <select
              className="fpp-select"
              value={val}
              onChange={(e) => handleAnswerChange(q.questionKey, e.target.value)}
            >
              <option value="">-- Chọn một lựa chọn --</option>
              {sortedOpts.map((opt) => (
                <option key={opt.id || opt.optionKey} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )
        }
        return (
          <div className="fpp-radio-column">
            {sortedOpts.map((opt) => (
              <label key={opt.id || opt.optionKey} className="fpp-radio-label">
                <input
                  type="radio"
                  name={q.questionKey}
                  value={opt.value}
                  checked={val === opt.value}
                  onChange={() => handleAnswerChange(q.questionKey, opt.value)}
                /> {opt.label}
              </label>
            ))}
          </div>
        )
      case 'MULTIPLE_CHOICE': {
        const checkedList = Array.isArray(val) ? val : []
        const toggleCheckbox = (optVal) => {
          const next = checkedList.includes(optVal)
            ? checkedList.filter((v) => v !== optVal)
            : [...checkedList, optVal]
          handleAnswerChange(q.questionKey, next)
        }
        return (
          <div className="fpp-checkbox-column">
            {sortedOpts.map((opt) => (
              <label key={opt.id || opt.optionKey} className="fpp-checkbox-label">
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={checkedList.includes(opt.value)}
                  onChange={() => toggleCheckbox(opt.value)}
                /> {opt.label}
              </label>
            ))}
          </div>
        )
      }
      case 'DATE':
        return (
          <input
            type="date"
            className="fpp-input"
            style={{ width: '200px' }}
            value={val}
            onChange={(e) => handleAnswerChange(q.questionKey, e.target.value)}
          />
        )
      case 'DATETIME':
        return (
          <input
            type="datetime-local"
            className="fpp-input"
            style={{ width: '250px' }}
            value={val}
            onChange={(e) => handleAnswerChange(q.questionKey, e.target.value)}
          />
        )
      default:
        return (
          <input
            type="text"
            className="fpp-input"
            value={val}
            onChange={(e) => handleAnswerChange(q.questionKey, e.target.value)}
            placeholder={`Trường nhập dữ liệu (${q.fieldType})`}
          />
        )
    }
  }

  const breadcrumbs = [
    { label: 'Quản lý chất lượng' },
    { label: 'Quản lý checklist', route: '/admin/quality/checklists' },
    { label: 'Cấu hình', route: `/admin/quality/checklists/${id}/edit` },
    { label: 'Xem trước biểu mẫu' },
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="form-preview-page">
              
              {/* Back to metadata */}
              <div className="fpp-back-nav" onClick={() => navigate(`/admin/quality/checklists/${id}/edit`)}>
                <ArrowLeftOutlined /> Quay lại cấu hình
              </div>

              {loading ? (
                <div className="fpp-loading">
                  <LoadingOutlined /> Đang tải giao diện xem trước...
                </div>
              ) : !form || !version ? (
                <div className="fpp-error" role="alert">
                  <span>{errorMessage || 'Không thể hiển thị bản xem trước.'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true)
                      setErrorMessage('')
                      loadPreviewData()
                    }}
                  >
                    Thử tải lại
                  </button>
                </div>
              ) : (
                <div className="fpp-container">
                  
                  {/* Warning banner preview */}
                  <div className="fpp-banner-preview">
                    <ExclamationCircleOutlined /> Đây là giao diện xem trước (Preview) cho 
                    <strong> Phiên bản v{version?.versionNumber} ({version?.status})</strong>. 
                    Mọi hành động nhập liệu và nộp bài ở đây chỉ để thử nghiệm hiển thị và không lưu vào dữ liệu.
                  </div>

                  {/* Header Form card */}
                  <div className="fpp-head-card">
                    <span
                      className="fpp-form-code"
                      title={`Mã hệ thống: ${form?.code}`}
                    >
                      {getChecklistDisplayCode(form?.code)}
                    </span>
                    <h1 className="fpp-form-title">{form?.title}</h1>
                    {form?.description && <p className="fpp-form-desc">{form?.description}</p>}
                  </div>

                  {/* Subject Selector LookUp */}
                  {version?.settings?.subjectSelector && (
                    <div className="fpp-card fpp-subject-lookup-card">
                      <h3 className="fpp-card-title">I. Tra cứu đối tượng đánh giá</h3>
                      <p className="fpp-card-desc">Nhập mã nhân viên để tự động tải thông tin hồ sơ y tế:</p>
                      
                      <div className="fpp-lookup-row">
                        <div className="fpp-search-wrapper">
                          <input
                            type="text"
                            className="fpp-input"
                            value={employeeCode}
                            onChange={(e) => setEmployeeCode(e.target.value)}
                            placeholder="Nhập mã nhân viên (ví dụ: NV001)..."
                          />
                        </div>
                        <button
                          type="button"
                          className="fpp-btn-lookup"
                          onClick={handleSubjectLookup}
                          disabled={subjectLoading}
                        >
                          {subjectLoading ? <LoadingOutlined /> : <><SearchOutlined /> Tra cứu</>}
                        </button>
                      </div>

                      {subjectError && (
                        <div className="fpp-subject-error" role="alert">
                          {subjectError}
                        </div>
                      )}

                      {/* Display fields read-only */}
                      {subjectDetails && (
                        <div className="fpp-subject-details-grid">
                          <div>
                            <span className="fpp-meta-label">MÃ NHÂN VIÊN</span>
                            <span className="fpp-meta-value">{subjectDetails.employeeCode}</span>
                          </div>
                          <div>
                            <span className="fpp-meta-label">HỌ VÀ TÊN</span>
                            <span className="fpp-meta-value">{subjectDetails.fullName}</span>
                          </div>
                          <div>
                            <span className="fpp-meta-label">CHỨC VỤ</span>
                            <span className="fpp-meta-value">{subjectDetails.position}</span>
                          </div>
                          <div>
                            <span className="fpp-meta-label">KHOA PHÒNG</span>
                            <span className="fpp-meta-value">{subjectDetails.department}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Render sections list */}
                  {getSortedSections().map((sec, secIdx) => (
                    <div key={sec.id || secIdx} className="fpp-card fpp-section-card">
                      <h2 className="fpp-sec-title">{sec.title}</h2>
                      {sec.description && <p className="fpp-sec-desc">{sec.description}</p>}

                      {/* Items */}
                      <div className="fpp-items-list">
                        {getSortedItems(sec).map((item, itemIdx) => (
                          <div key={item.id || itemIdx} className="fpp-item-row">
                            
                            {item.itemType === 'INSTRUCTION' && (
                              <div className="fpp-instruction-box">
                                {item.description}
                              </div>
                            )}

                            {item.itemType === 'TITLE_DESCRIPTION' && (
                              <div className="fpp-title-desc-box">
                                {item.title && <h4 className="fpp-td-title">{item.title}</h4>}
                                {item.description && <p className="fpp-td-desc">{item.description}</p>}
                              </div>
                            )}

                            {item.itemType === 'IMAGE' && (
                              <div className="fpp-image-box">
                                {item.mediaUrl && <img src={item.mediaUrl} alt={item.title || 'Preview image'} className="fpp-img" />}
                                {item.title && <div className="fpp-img-caption">{item.title}</div>}
                              </div>
                            )}

                            {item.itemType === 'QUESTION' && item.question && (
                              <div className="fpp-question-box">
                                <div className="fpp-question-header">
                                  <span className="fpp-q-title">
                                    {item.question.title} 
                                    {item.question.required && <span className="fpp-req-star"> *</span>}
                                  </span>
                                  <div className="fpp-q-badges">
                                    {item.question.critical && (
                                      <span className="fpp-q-badge fpp-q-badge--critical">
                                        Trọng yếu
                                      </span>
                                    )}
                                    {item.question.excludeFromScore && (
                                      <span className="fpp-q-badge fpp-q-badge--exclude">
                                        Không tính điểm
                                      </span>
                                    )}
                                    {!item.question.excludeFromScore && item.question.weight && (
                                      <span className="fpp-q-badge fpp-q-badge--weight">
                                        Hệ số {item.question.weight}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {item.question.helpText && (
                                  <div className="fpp-q-help">{item.question.helpText}</div>
                                ) }

                                <div className="fpp-q-input-wrapper">
                                  {renderQuestionField(item)}
                                </div>
                              </div>
                            )}

                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Bottom test submit action */}
                  <div className="fpp-actions-footer">
                    <button
                      type="button"
                      className="fpp-btn-submit-mock"
                      onClick={() => showToast('Đây là chế độ xem trước (Preview). Kết quả đánh giá không thể lưu thực sự vào hệ thống.', 'info')}
                    >
                      Gửi kết quả (Thử nghiệm)
                    </button>
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

export default FormPreviewPage
