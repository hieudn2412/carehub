import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import {
  ArrowLeftOutlined,
  SearchOutlined,
  LoadingOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import '../styles/FormPreviewPage.css'

function FormPreviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const versionId = searchParams.get('versionId')

  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [version, setVersion] = useState(null)
  const [useMock, setUseMock] = useState(false)

  // Subject lookup state
  const [employeeCode, setEmployeeCode] = useState('')
  const [subjectDetails, setSubjectDetails] = useState(null)
  const [subjectLoading, setSubjectLoading] = useState(false)

  // Dummy form states for rendering preview controls
  const [formAnswers, setFormAnswers] = useState({})

  const MOCK_PREVIEW = {
    form: {
      id: 1,
      code: 'HAND_HYGIENE',
      title: 'Tuân thủ vệ sinh tay',
      description: 'Bảng kiểm đánh giá sự tuân thủ vệ sinh tay',
      subjectType: 'USER',
      status: 'PUBLISHED',
    },
    version: {
      id: 101,
      versionNumber: 1,
      status: 'PUBLISHED',
      title: 'Đánh giá vệ sinh tay lâm sàng',
      description: 'Áp dụng cho mọi vị trí tiếp xúc trực tiếp bệnh nhân',
      settings: {
        subjectSelector: {
          lookupBy: 'employeeCode',
          required: true,
          displayFields: ['employeeCode', 'fullName', 'position', 'department'],
          readOnly: true,
        },
      },
      sections: [
        {
          id: 10,
          title: 'I. Thông tin chung',
          description: 'Phần điền thông tin hành chính',
          displayOrder: 0,
          items: [
            {
              id: 21,
              itemType: 'INSTRUCTION',
              displayOrder: 0,
              description: 'Nhập mã số nhân viên cần đánh giá vào ô Tra cứu để tự động điền hồ sơ.',
            },
          ],
        },
        {
          id: 11,
          title: 'II. Nội dung đánh giá',
          description: 'Hãy tích chọn đạt hoặc không đạt cho từng hành động sau:',
          displayOrder: 1,
          items: [
            {
              id: 22,
              itemType: 'QUESTION',
              displayOrder: 0,
              question: {
                id: 30,
                questionKey: 'q1',
                code: 'VS_TAY_01',
                title: 'Vệ sinh tay trước khi tiếp xúc người bệnh?',
                helpText: 'Dùng xà phòng sát khuẩn hoặc dung dịch cồn',
                fieldType: 'SINGLE_CHOICE',
                required: true,
                critical: true,
                excludeFromScore: false,
                weight: 1,
                options: [
                  { id: 40, value: 'YES', label: 'Có (Đạt)', scoreValue: 1, compliant: true },
                  { id: 41, value: 'NO', label: 'Không (Không đạt)', scoreValue: 0, compliant: false },
                ],
              },
            },
            {
              id: 23,
              itemType: 'QUESTION',
              displayOrder: 1,
              question: {
                id: 31,
                questionKey: 'q2',
                code: 'VS_TAY_02',
                title: 'Vệ sinh tay sau khi tiếp xúc dịch tiết cơ thể?',
                helpText: 'Bắt buộc dùng xà phòng nước',
                fieldType: 'SINGLE_CHOICE',
                required: true,
                critical: true,
                excludeFromScore: false,
                weight: 1,
                options: [
                  { id: 42, value: 'YES', label: 'Có (Đạt)', scoreValue: 1, compliant: true },
                  { id: 43, value: 'NO', label: 'Không (Không đạt)', scoreValue: 0, compliant: false },
                ],
              },
            },
            {
              id: 24,
              itemType: 'QUESTION',
              displayOrder: 2,
              question: {
                id: 32,
                questionKey: 'q3',
                code: 'NHAN_XET',
                title: 'Ý kiến nhận xét khác (nếu có):',
                helpText: 'Ghi rõ hành động hoặc hạn chế',
                fieldType: 'LONG_TEXT',
                required: false,
                critical: false,
                excludeFromScore: true,
                options: [],
              },
            },
          ],
        },
      ],
    },
  }

  useEffect(() => {
    loadPreviewData()
  }, [id, versionId, useMock])

  const loadPreviewData = () => {
    setLoading(true)
    const params = versionId ? { versionId } : {}
    adminApi.getFormPreviewById(id, params)
      .then((res) => {
        const preview = res.data?.data
        if (preview && preview.form && preview.version) {
          setForm(preview.form)
          setVersion(preview.version)
          setLoading(false)
        } else {
          setUseMock(true)
        }
      })
      .catch((err) => {
        console.warn('GET preview details failed. Fallback to local preview layout.', err)
        setForm(MOCK_PREVIEW.form)
        setVersion(MOCK_PREVIEW.version)
        setUseMock(true)
        setLoading(false)
      })
  }

  const handleSubjectLookup = () => {
    if (!employeeCode.trim()) {
      alert('Vui lòng nhập mã nhân viên để tra cứu.')
      return
    }

    setSubjectLoading(true)
    adminApi.findFormSubject({ employeeCode: employeeCode.trim() })
      .then((res) => {
        if (res.data?.data) {
          setSubjectDetails(res.data.data)
        } else {
          alert('Không tìm thấy nhân viên hoặc không có quyền truy cập.')
        }
        setSubjectLoading(false)
      })
      .catch(() => {
        // Mock fallback
        if (employeeCode.trim().toUpperCase() === 'NV001') {
          setSubjectDetails({
            employeeCode: 'NV001',
            fullName: 'Nguyễn Văn A',
            position: 'Điều dưỡng',
            department: 'Khoa Hồi sức tích cực',
          })
        } else {
          setSubjectDetails({
            employeeCode: employeeCode.toUpperCase(),
            fullName: 'Trần Thị B',
            position: 'Bác sĩ',
            department: 'Khoa Cấp cứu',
          })
        }
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
                /> {opt.label} {opt.scoreValue !== null && `(${opt.scoreValue}đ)`}
              </label>
            ))}
          </div>
        )
      case 'MULTIPLE_CHOICE':
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
                    <span className="fpp-form-code">{form?.code}</span>
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
                      onClick={() => alert('Đây là chế độ xem trước (Preview). Kết quả đánh giá không thể lưu thực sự vào hệ thống.')}
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
