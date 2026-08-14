import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CalendarOutlined,
  SaveOutlined,
  PaperClipOutlined,
  SearchOutlined,
  DownOutlined,
  CloseOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import { useToast } from '../../../../shared/context/ToastContext.jsx'
import { getApiErrorMessage } from '../../../../features/auth/utils/apiError.js'
import { formatEvidenceStorageSummary, getEvidenceFileError } from '../../../../features/training/utils/evidenceFile.js'
import { getTrainingHoursValidationError, MAX_TRAINING_HOURS } from './utils/trainingHoursValidation.js'
import '../../styles/TrainingHours.css'

const formatCompactSize = (bytes) => {
  const value = Number(bytes || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(2)} MB`
}

const todayIso = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

const getDateParts = (value) => {
  const [year, month, day] = String(value || todayIso()).split('-').map(Number)
  return { year, month, day }
}

const formatDisplayDate = (value) => {
  const { year, month, day } = getDateParts(value)
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
}

function SearchableDropdown({
  options = [],
  value = '',
  onChange = () => {},
  placeholder = 'Chọn...',
  error = false,
  showCustomOption = false,
  onSelectCustomOption = null,
  customValue = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = options.filter(opt =>
    (opt.name || '').toLowerCase().includes(search.toLowerCase())
  )

  const selectedOption = options.find(opt => String(opt.id) === String(value))

  const displayLabel = customValue && value === 'OTHER'
    ? customValue
    : selectedOption
    ? selectedOption.name
    : placeholder;

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsOpen(!isOpen)
          }
        }}
        style={{
          width: '100%',
          padding: '10px 14px',
          border: `1px solid ${error ? '#ef4444' : '#e5e7eb'}`,
          borderRadius: 8,
          fontSize: 14,
          color: (selectedOption || (customValue && value === 'OTHER')) ? '#111827' : '#9ca3af',
          background: '#fff',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxSizing: 'border-box',
          minHeight: 42,
        }}
      >
        <span>{displayLabel}</span>
        <DownOutlined style={{ fontSize: 12, color: '#6b7280' }} />
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width: '100%',
            marginTop: 4,
            background: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            zIndex: 1000,
            maxHeight: 200,
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              padding: 8,
              borderBottom: '1px solid #f3f4f6',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxSizing: 'border-box',
            }}
          >
            <SearchOutlined style={{ color: '#9ca3af', fontSize: 14 }} />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                fontSize: 13,
                color: '#374151',
                padding: '4px 0',
              }}
            />
            {search && (
              <CloseOutlined
                onClick={(e) => {
                  e.stopPropagation()
                  setSearch('')
                }}
                style={{ color: '#9ca3af', cursor: 'pointer', fontSize: 12 }}
              />
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div
                  key={opt.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onChange(String(opt.id))
                    setIsOpen(false)
                    setSearch('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onChange(String(opt.id))
                      setIsOpen(false)
                      setSearch('')
                    }
                  }}
                  style={{
                    padding: '8px 14px',
                    fontSize: 13,
                    color: '#374151',
                    cursor: 'pointer',
                    background: String(opt.id) === String(value) ? '#f3f4f6' : 'transparent',
                    boxSizing: 'border-box',
                  }}
                >
                  {opt.name}
                </div>
              ))
            ) : (
              <div style={{ padding: '8px 14px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                Không tìm thấy kết quả
              </div>
            )}

            {showCustomOption && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setIsOpen(false)
                  setSearch('')
                  if (onSelectCustomOption) onSelectCustomOption()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsOpen(false)
                    setSearch('')
                    if (onSelectCustomOption) onSelectCustomOption()
                  }
                }}
                style={{
                  padding: '8px 14px',
                  fontSize: 13,
                  color: '#2563eb',
                  fontWeight: 500,
                  cursor: 'pointer',
                  borderTop: '1px solid #f3f4f6',
                  background: 'transparent',
                  boxSizing: 'border-box',
                }}
              >
                + Khác (Tự đề xuất lĩnh vực mới)
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TrainingHoursFormScreen() {
  const { id } = useParams() // empty if creating, exists if editing
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isEditMode = !!id

  const [form, setForm] = useState({
    name: '',
    date: todayIso(),
    hours: '',
    type: '',
    professionalFieldId: '',
    customProfessionalField: '',
    notes: '',
  })
  const [activityTypes, setActivityTypes] = useState([])
  const [professionalFields, setProfessionalFields] = useState([])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recordVersion, setRecordVersion] = useState(null)
  const [trainingWindowYears, setTrainingWindowYears] = useState(null)
  const [mobileStep, setMobileStep] = useState(0)

  // Evidence states
  const fileInputRef = useRef(null)
  const previewUrlsRef = useRef(new Set())
  const [selectedFiles, setSelectedFiles] = useState([])
  const [existingEvidences, setExistingEvidences] = useState([])
  const [evidencesToDelete, setEvidencesToDelete] = useState([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileError, setFileError] = useState('')

  // Custom professional field modal states
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [tempCustomName, setTempCustomName] = useState('')
  const [tempCustomNameError, setTempCustomNameError] = useState('')
  const [mobileDateOpen, setMobileDateOpen] = useState(false)
  const [mobileDateDraft, setMobileDateDraft] = useState(() => getDateParts(todayIso()))

  const openMobileDatePicker = () => {
    setMobileDateDraft(getDateParts(form.date))
    setMobileDateOpen(true)
  }

  const updateMobileDateDraft = (changes) => {
    setMobileDateDraft(currentDraft => {
      const nextDraft = { ...currentDraft, ...changes }
      const maxDay = new Date(nextDraft.year, nextDraft.month, 0).getDate()
      return { ...nextDraft, day: Math.min(nextDraft.day, maxDay) }
    })
  }

  const applyMobileDate = () => {
    const { year, month, day } = mobileDateDraft
    const value = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setForm(currentForm => ({ ...currentForm, date: value }))
    setErrors(currentErrors => {
      const nextErrors = { ...currentErrors }
      delete nextErrors.date
      return nextErrors
    })
    setMobileDateOpen(false)
  }

  useEffect(() => () => {
    previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    previewUrlsRef.current.clear()
  }, [])

  const handleOpenCustomModal = () => {
    setTempCustomName(form.professionalFieldId === 'OTHER' ? form.customProfessionalField : '')
    setTempCustomNameError('')
    setCustomModalOpen(true)
  }

  const handleConfirmCustomModal = () => {
    if (!tempCustomName || !tempCustomName.trim()) {
      setTempCustomNameError('Vui lòng nhập tên lĩnh vực chuyên môn mới')
      return
    }
    if (tempCustomName.trim().length > 255) {
      setTempCustomNameError('Lĩnh vực chuyên môn không được vượt quá 255 ký tự')
      return
    }
    setForm(prev => ({
      ...prev,
      professionalFieldId: 'OTHER',
      customProfessionalField: tempCustomName.trim()
    }))
    setCustomModalOpen(false)
  }

  const handleCancelCustomModal = () => {
    setCustomModalOpen(false)
  }

  // Fetch options (activity types) on mount
  useEffect(() => {

    setLoading(true)
    trainingApi.getRecordOptions()
      .then(res => {
        setActivityTypes(res.data?.data?.activityTypes || [])
        setProfessionalFields(res.data?.data?.professionalFields || [])
      })
      .catch(err => {
        console.error("Error fetching options", err)
      })
      .finally(() => {
        if (!isEditMode) setLoading(false)
      })
  }, [isEditMode])

  useEffect(() => {
    trainingApi.getMyTrainingStatus()
      .then(res => {
        const years = Number(res.data?.data?.cycleYears)
        setTrainingWindowYears(Number.isInteger(years) && years > 0 ? years : null)
      })
      .catch(() => setTrainingWindowYears(null))
  }, [])

  // Fetch record detail if in edit mode
  useEffect(() => {
    if (isEditMode) {

      setLoading(true)
      trainingApi.getRecord(id)
        .then(res => {
          const record = res.data?.data
          if (record) {
            if (record.workflowStatus !== 'DRAFT') {
              showToast("Chỉ có thể chỉnh sửa hồ sơ ở trạng thái Bản nháp.", "warning")
              navigate('/staff/training')
              return
            }
            setForm({
              name: record.title || '',
              date: record.startDate || '',
              hours: record.declaredHours ? String(record.declaredHours) : '',
              type: record.activityTypeId ? String(record.activityTypeId) : '',
              professionalFieldId: record.professionalFieldId ? String(record.professionalFieldId) : '',
              customProfessionalField: '',
              notes: record.description || '',
            })
            setRecordVersion(record.version)
            // Fetch existing evidence
            trainingApi.listEvidence(id)
              .then(res => {
                setExistingEvidences(res.data?.data || [])
              })
              .catch(() => {})
          }
        })
        .catch(err => {
          console.error("Error fetching record for editing", err)
          showToast("Không thể tải thông tin hồ sơ để chỉnh sửa.", "error")
          navigate('/staff/training')
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [id, isEditMode, navigate, showToast])

  const required = ['name', 'date', 'hours', 'type']

  const validate = (shouldSubmit) => {
    const e = {}
    required.forEach(k => {
      if (!form[k]) e[k] = true
    })

    const hoursError = getTrainingHoursValidationError(form.hours)
    if (hoursError) e.hours = hoursError

    if (shouldSubmit && form.date && trainingWindowYears) {
      const recordDate = new Date(form.date)
      const windowStart = new Date()
      windowStart.setFullYear(windowStart.getFullYear() - trainingWindowYears)
      windowStart.setHours(0, 0, 0, 0)
      recordDate.setHours(0, 0, 0, 0)
      if (recordDate < windowStart) {
        e.date = `Hồ sơ đào tạo quá ${trainingWindowYears} năm không được phép nộp.`
      }
    }

    if (form.professionalFieldId === 'OTHER') {
      if (!form.customProfessionalField || !form.customProfessionalField.trim()) {
        e.customProfessionalField = 'Vui lòng nhập tên lĩnh vực chuyên môn khác'
      } else if (form.customProfessionalField.trim().length > 255) {
        e.customProfessionalField = 'Lĩnh vực chuyên môn không được vượt quá 255 ký tự'
      }
    }

    setErrors(e)
    if (Object.keys(e).length > 0) {
      if (e.name || e.date || e.hours) setMobileStep(0)
      else if (e.type || e.professionalFieldId || e.customProfessionalField) setMobileStep(1)
    }
    return Object.keys(e).length === 0;
  }

  const goToNextMobileStep = () => {
    const stepErrors = {}

    if (mobileStep === 0) {
      if (!form.name) stepErrors.name = true
      if (!form.date) stepErrors.date = true
      const hoursError = getTrainingHoursValidationError(form.hours)
      if (hoursError) stepErrors.hours = hoursError
    }

    if (mobileStep === 1) {
      if (!form.type) stepErrors.type = true
      if (form.professionalFieldId === 'OTHER' && !form.customProfessionalField.trim()) {
        stepErrors.customProfessionalField = 'Vui lòng nhập tên lĩnh vực chuyên môn khác'
      }
    }

    if (Object.keys(stepErrors).length > 0) {
      setErrors(currentErrors => ({ ...currentErrors, ...stepErrors }))
      return
    }

    setErrors(currentErrors => {
      const nextErrors = { ...currentErrors }
      const resolvedKeys = mobileStep === 0
        ? ['name', 'date', 'hours']
        : ['type', 'professionalFieldId', 'customProfessionalField']
      resolvedKeys.forEach(key => delete nextErrors[key])
      return nextErrors
    })
    setMobileStep(currentStep => Math.min(2, currentStep + 1))
  }

  const saveRecord = async (shouldSubmit) => {
    if (!validate(shouldSubmit)) return

    setSaving(true)

    // Bước 1: Lưu/cập nhật bản nháp
    let savedRecord, recordId, recordVer
    try {
      const payload = {
        title: form.name,
        startDate: form.date,
        declaredHours: parseFloat(form.hours),
        activityTypeId: form.type ? parseInt(form.type, 10) : null,
        professionalFieldId: form.professionalFieldId && form.professionalFieldId !== 'OTHER' ? Number(form.professionalFieldId) : null,
        customProfessionalField: form.professionalFieldId === 'OTHER' ? form.customProfessionalField.trim() : null,
        description: form.notes || null,
        durationValue: parseFloat(form.hours),
        durationUnit: 'HOUR',
        version: isEditMode ? recordVersion : undefined,
      }

      const res = isEditMode
        ? await trainingApi.updateRecord(id, payload)
        : await trainingApi.createRecord(payload)

      savedRecord = res.data?.data
      recordId = savedRecord?.id || id
      recordVer = savedRecord?.version
    } catch (saveErr) {
      console.error("Error saving record", saveErr)
      showToast(getApiErrorMessage(saveErr, "Lưu biểu mẫu thất bại. Vui lòng kiểm tra lại thông tin."), "error")
      setSaving(false)
      return
    }

    // Bước 2: Xử lý minh chứng (evidence)
    let failedDeletes = 0
    for (const ev of evidencesToDelete) {
      try { await trainingApi.deleteEvidence(recordId, ev.id) } catch { failedDeletes++ }
    }

    let failedUploads = 0
    if (selectedFiles.length > 0) {
      for (const selectedFile of selectedFiles) {
        try { await trainingApi.uploadEvidence(recordId, selectedFile.file) } catch { failedUploads++ }
      }
    }

    // Bước 3: Nộp hồ sơ nếu cần
    if (shouldSubmit) {
      try {
        const detail = await trainingApi.getRecord(recordId)
        recordVer = detail.data?.data?.version
        await trainingApi.submitRecord(recordId, { version: recordVer })

        if (failedUploads > 0) {
          showToast(`Nộp hồ sơ thành công! (${failedUploads} file minh chứng tải lên thất bại)`, "warning")
        } else {
          showToast("Nộp hồ sơ thành công!", "success")
        }
        navigate('/staff/training')
      } catch (submitErr) {
        console.error("Error submitting record", submitErr)
        // Bản nháp đã được lưu, nhưng nộp thất bại
        const reason = getApiErrorMessage(submitErr, "lỗi không xác định")
        showToast(
          `Đã lưu bản nháp nhưng nộp hồ sơ thất bại: ${reason}. Vui lòng thử lại từ danh sách hồ sơ.`,
          "error"
        )
        navigate('/staff/training')
      }
    } else {
      const uploadedCount = selectedFiles.length - failedUploads
      if (failedUploads > 0 || failedDeletes > 0) {
        showToast(`Đã lưu bản nháp (${uploadedCount} file tải lên, ${failedUploads + failedDeletes} thất bại)`, "warning")
      } else {
        showToast(isEditMode ? "Cập nhật bản nháp thành công!" : "Lưu bản nháp thành công!", "success")
      }
      navigate('/staff/training')
    }

    setSaving(false)
  }

  const handleSaveDraft = () => saveRecord(false)
  const handleSaveAndSubmit = () => saveRecord(true)

  // ── Evidence handlers ──
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true) }
  const handleDragLeave = () => setIsDragOver(false)
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }
  const handleFileSelect = (e) => {
    addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const addFiles = (files) => {
    setFileError('')
    const valid = []
    for (const file of files) {
      const validationError = getEvidenceFileError(file)
      if (validationError) {
        setFileError(validationError)
        continue
      }
      let previewUrl = ''
      if (file.type?.startsWith('image/') && typeof URL.createObjectURL === 'function') {
        previewUrl = URL.createObjectURL(file)
        previewUrlsRef.current.add(previewUrl)
      }
      valid.push({ file, previewUrl })
    }
    setSelectedFiles(prev => [...prev, ...valid])
  }

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => {
      const removed = prev[index]
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl)
        previewUrlsRef.current.delete(removed.previewUrl)
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const removeExistingEvidence = (ev) => {
    setExistingEvidences(prev => prev.filter(e => e.id !== ev.id))
    setEvidencesToDelete(prev => [...prev, ev])
  }

  const fieldStyle = (key) => ({
    width: '100%',
    padding: '10px 14px',
    border: `1px solid ${errors[key] ? '#ef4444' : '#e5e7eb'}`,
    borderRadius: 8,
    fontSize: 14,
    color: '#111827',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fff',
    transition: 'border-color 0.15s',
  })

  return (
    <AppShell
      className="training-hours-form-shell"
      back={{ to: isEditMode && id ? `/staff/training/${id}` : '/staff/training', label: 'Quay lại' }}
      breadcrumbs={[
        { label: 'Giờ đào tạo', link: '/staff/training' },
        { label: isEditMode ? 'Chỉnh sửa' : 'Cập nhật giờ đào tạo' }
      ]}
    >
      <div className="training-page training-page--form">

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Đang tải thông tin biểu mẫu...</div>
            ) : (
              <div className="th-form-content">
                <div className="th-page-heading">
                  <h1 className="th-page-title">
                    {isEditMode ? 'Chỉnh sửa hồ sơ đào tạo' : 'Thêm hồ sơ đào tạo'}
                  </h1>
                  <p className="th-page-subtitle">
                    Nhập thông tin chi tiết của hoạt động đào tạo đã hoàn thành
                  </p>
                </div>

                <div className="detail-card">
                  <div className="th-mobile-form-topbar">
                    <button
                      type="button"
                      className="th-mobile-form-back"
                      onClick={() => navigate(isEditMode && id ? `/staff/training/${id}` : '/staff/training')}
                      aria-label="Quay lại danh sách giờ đào tạo"
                    >
                      <LeftOutlined />
                    </button>
                  <nav className="th-mobile-form-steps" aria-label="Các bước thêm hồ sơ đào tạo">
                    {['Thông tin', 'Phân loại', 'Minh chứng'].map((label, index) => (
                      <button
                        key={label}
                        type="button"
                        className={mobileStep === index ? 'is-active' : mobileStep > index ? 'is-complete' : ''}
                        onClick={() => setMobileStep(index)}
                        aria-current={mobileStep === index ? 'step' : undefined}
                      >
                        <span>{index + 1}</span>
                        <small>{label}</small>
                      </button>
                    ))}
                  </nav>
                  </div>

                  <div className={`th-form-step-panel${mobileStep === 0 ? ' is-active' : ''}`}>
                  {/* Name */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Nội dung đào tạo <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="Ví dụ: Hồi sức cấp cứu cơ bản"
                      style={fieldStyle('name')}
                    />
                    {errors.name && <span style={{ color: '#ef4444', fontSize: 12 }}>Bắt buộc nhập</span>}
                  </div>

                  {/* Date + Hours */}
                  <div className="th-form-grid">
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                        Ngày đào tạo liên tục <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <div className="th-desktop-date-picker" style={{ position: 'relative' }}>
                        <input
                          type="date"
                          value={form.date}
                          onChange={e => setForm({ ...form, date: e.target.value })}
                          style={{ ...fieldStyle('date'), paddingLeft: 38 }}
                        />
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                          <CalendarOutlined style={{ color: '#9ca3af' }} />
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`th-mobile-date-trigger${errors.date ? ' has-error' : ''}`}
                        onClick={openMobileDatePicker}
                        aria-label={`Chọn ngày đào tạo, hiện tại ${formatDisplayDate(form.date)}`}
                      >
                        <CalendarOutlined aria-hidden="true" />
                        <span>{formatDisplayDate(form.date)}</span>
                        <DownOutlined aria-hidden="true" />
                      </button>
                      {errors.date && (
                        <span style={{ color: '#ef4444', fontSize: 12 }}>
                          {typeof errors.date === 'string' ? errors.date : 'Bắt buộc chọn ngày'}
                        </span>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                        Số giờ đào tạo <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0.5"
                        max={MAX_TRAINING_HOURS}
                        step="0.5"
                        value={form.hours}
                        onChange={e => {
                          const nextHours = e.target.value
                          setForm(current => ({ ...current, hours: nextHours }))
                          setErrors(current => {
                            if (!current.hours) return current
                            const nextError = getTrainingHoursValidationError(nextHours)
                            const nextErrors = { ...current }
                            if (nextError) nextErrors.hours = nextError
                            else delete nextErrors.hours
                            return nextErrors
                          })
                        }}
                        placeholder="Ví dụ: 1.5, 8, 12.5"
                        aria-invalid={Boolean(errors.hours)}
                        aria-describedby="training-hours-help"
                        style={fieldStyle('hours')}
                      />
                      {errors.hours ? (
                        <span id="training-hours-help" role="alert" style={{ color: '#ef4444', fontSize: 12 }}>
                          {typeof errors.hours === 'string' ? errors.hours : 'Bắt buộc nhập số giờ'}
                        </span>
                      ) : (
                        <span id="training-hours-help" style={{ color: '#6b7280', fontSize: 11, marginTop: 4, display: 'block' }}>
                          Nhập số thập phân từ 0.5 đến {MAX_TRAINING_HOURS} giờ
                        </span>
                      )}
                    </div>
                  </div>
                  </div>

                  {/* Type + ProfessionalField */}
                  <div className={`th-form-step-panel${mobileStep === 1 ? ' is-active' : ''}`}>
                  <div className="th-form-grid">
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                        Hình thức đào tạo <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <SearchableDropdown
                        options={activityTypes}
                        value={form.type}
                        onChange={val => setForm({ ...form, type: val })}
                        placeholder="Chọn hình thức"
                        error={errors.type}
                      />
                      {errors.type && <span style={{ color: '#ef4444', fontSize: 12 }}>Bắt buộc chọn hình thức</span>}
                    </div>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                        Lĩnh vực chuyên môn
                      </label>
                      <SearchableDropdown
                        options={professionalFields}
                        value={form.professionalFieldId}
                        onChange={val => setForm({ ...form, professionalFieldId: val })}
                        placeholder="Chọn lĩnh vực chuyên môn"
                        error={errors.professionalFieldId}
                        showCustomOption={true}
                        onSelectCustomOption={handleOpenCustomModal}
                        customValue={form.professionalFieldId === 'OTHER' ? `Khác: ${form.customProfessionalField}` : ''}
                      />
                      {form.professionalFieldId === 'OTHER' && form.customProfessionalField && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#2563eb' }}>
                          Lĩnh vực đề xuất: <strong>{form.customProfessionalField}</strong> (click dropdown chọn Khác để sửa)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Ghi chú / Mô tả
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      placeholder="Mô tả ngắn gọn về nội dung..."
                      rows={4}
                      style={{ ...fieldStyle('notes'), resize: 'vertical' }}
                    />
                  </div>
                  </div>

                  {/* Evidence Section */}
                  <div className={`th-form-step-panel${mobileStep === 2 ? ' is-active' : ''}`}>
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                      <PaperClipOutlined style={{ marginRight: 6 }} />Minh chứng đào tạo
                    </label>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>
                      Kéo thả file vào đây hoặc click để chọn. Hỗ trợ PDF, JPG, PNG (đầu vào tối đa 20 MB; lưu tối đa 5 MB/file)
                    </p>

                    {/* Existing evidences (edit mode) */}
                    {existingEvidences.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                          File đã tải lên ({existingEvidences.length}):
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {existingEvidences.map(ev => (
                            <div key={ev.id} className="evidence-chip">
                              <PaperClipOutlined style={{ fontSize: 12 }} />
                              <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ev.originalFilename}
                              </span>
                              <span style={{ color: '#6b7280', fontSize: 11 }}>
                                {formatEvidenceStorageSummary(ev, formatCompactSize)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeExistingEvidence(ev)}
                                className="evidence-chip__remove"
                                title="Xoá"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New files preview */}
                    {selectedFiles.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                          File sẽ tải lên ({selectedFiles.length}):
                        </p>
                        <div className="evidence-selection-grid">
                          {selectedFiles.map(({ file, previewUrl }, i) => (
                            <article key={`${file.name}-${file.lastModified}-${i}`} className="evidence-selection-card">
                              {previewUrl ? (
                                <img
                                  className="evidence-selection-card__image"
                                  src={previewUrl}
                                  alt={`Ảnh minh chứng ${file.name}`}
                                />
                              ) : (
                                <div className="evidence-selection-card__file">
                                  <PaperClipOutlined />
                                  <span>PDF</span>
                                </div>
                              )}
                              <div className="evidence-selection-card__info">
                                <span className="evidence-selection-card__name" title={file.name}>
                                  {file.name}
                                </span>
                                <span>{formatCompactSize(file.size)}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeSelectedFile(i)}
                                className="evidence-selection-card__remove"
                                aria-label={`Xóa tệp ${file.name}`}
                                title="Xóa tệp"
                              >
                                <CloseOutlined />
                              </button>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dropzone */}
                    <div
                      className={`evidence-dropzone${isDragOver ? ' evidence-dropzone--active' : ''}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          fileInputRef.current?.click()
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label="Chọn tệp minh chứng"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png"
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                      />
                      <PaperClipOutlined style={{ fontSize: 22, color: isDragOver ? '#1aaa84' : '#9ca3af', marginBottom: 8 }} />
                      <p style={{ margin: 0, fontSize: 13, color: isDragOver ? '#1aaa84' : '#6b7280' }}>
                        Kéo thả file hoặc <span style={{ color: '#2563eb', fontWeight: 500 }}>click để chọn</span>
                      </p>
                    </div>
                    {fileError && (
                      <span style={{ color: '#ef4444', fontSize: 12, marginTop: 6, display: 'block' }}>{fileError}</span>
                    )}
                  </div>
                  </div>

                  {/* Form Actions */}
                  <div className="th-form-actions">
                    <button type="button" className="th-btn-cancel" onClick={() => navigate('/staff/training')} disabled={saving}>
                      Huỷ bỏ
                    </button>
                    <button type="button" className="th-btn-secondary" onClick={handleSaveDraft} disabled={saving}>
                      <SaveOutlined /> {saving ? 'Đang lưu...' : 'Lưu nháp'}
                    </button>
                    <button type="button" className="th-btn-primary" onClick={handleSaveAndSubmit} disabled={saving}>
                      <SaveOutlined /> {saving ? 'Đang lưu...' : 'Lưu và nộp'}
                    </button>
                  </div>

                  <div className="th-mobile-form-actions">
                    <button
                      type="button"
                      className="th-mobile-form-actions__back"
                      onClick={() => setMobileStep(currentStep => Math.max(0, currentStep - 1))}
                      disabled={mobileStep === 0 || saving}
                    >
                      <LeftOutlined /> Trước
                    </button>
                    <span>{mobileStep + 1}/3</span>
                    {mobileStep < 2 ? (
                      <button type="button" className="th-mobile-form-actions__next" onClick={goToNextMobileStep}>
                        Tiếp theo <RightOutlined />
                      </button>
                    ) : (
                      <div>
                        <button type="button" onClick={handleSaveDraft} disabled={saving}>
                          <SaveOutlined /> Nháp
                        </button>
                        <button type="button" className="th-mobile-form-actions__submit" onClick={handleSaveAndSubmit} disabled={saving}>
                          <SaveOutlined /> Nộp
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="th-form-bottom-space" aria-hidden="true" />
              </div>
            )}
      </div>

      {mobileDateOpen && (
        <div className="th-mobile-date-backdrop" onClick={() => setMobileDateOpen(false)}>
          <section
            className="th-mobile-date-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="th-mobile-date-title"
            onClick={event => event.stopPropagation()}
          >
            <header>
              <div>
                <small>Ngày đào tạo liên tục</small>
                <strong id="th-mobile-date-title">
                  {String(mobileDateDraft.day).padStart(2, '0')}/
                  {String(mobileDateDraft.month).padStart(2, '0')}/
                  {mobileDateDraft.year}
                </strong>
              </div>
              <button type="button" onClick={() => setMobileDateOpen(false)} aria-label="Đóng bộ chọn ngày">
                <CloseOutlined />
              </button>
            </header>

            <div className="th-mobile-date-fields">
              <label>
                <span>Ngày</span>
                <select
                  value={mobileDateDraft.day}
                  onChange={event => updateMobileDateDraft({ day: Number(event.target.value) })}
                >
                  {Array.from(
                    { length: new Date(mobileDateDraft.year, mobileDateDraft.month, 0).getDate() },
                    (_, index) => index + 1,
                  ).map(day => <option key={day} value={day}>{day}</option>)}
                </select>
              </label>
              <label>
                <span>Tháng</span>
                <select
                  value={mobileDateDraft.month}
                  onChange={event => updateMobileDateDraft({ month: Number(event.target.value) })}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1)
                    .map(month => <option key={month} value={month}>Tháng {month}</option>)}
                </select>
              </label>
              <label>
                <span>Năm</span>
                <select
                  value={mobileDateDraft.year}
                  onChange={event => updateMobileDateDraft({ year: Number(event.target.value) })}
                >
                  {Array.from({ length: 22 }, (_, index) => new Date().getFullYear() + 1 - index)
                    .map(year => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
            </div>

            <footer>
              <button
                type="button"
                className="th-mobile-date-today"
                onClick={() => setMobileDateDraft(getDateParts(todayIso()))}
              >
                Hôm nay
              </button>
              <button type="button" className="th-mobile-date-apply" onClick={applyMobileDate}>
                Chọn ngày
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* Modal đề xuất lĩnh vực mới */}
      {customModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: '100%',
              maxWidth: 450,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              boxSizing: 'border-box',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
              Đề xuất lĩnh vực chuyên môn mới
            </h2>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 18px' }}>
              Lĩnh vực chuyên môn này sẽ được gửi đến Admin phê duyệt sau khi bạn nộp hồ sơ.
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                Tên lĩnh vực chuyên môn <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Chăm sóc giảm nhẹ nhi khoa..."
                value={tempCustomName}
                onChange={e => setTempCustomName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: `1px solid ${tempCustomNameError ? '#ef4444' : '#e5e7eb'}`,
                  borderRadius: 8,
                  fontSize: 14,
                  color: '#111827',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {tempCustomNameError && (
                <span style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>
                  {tempCustomNameError}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={handleCancelCustomModal}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#fff',
                  color: '#374151',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmCustomModal}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 6,
                  background: '#1aaa84',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

export default TrainingHoursFormScreen
