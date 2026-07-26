import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import {
  getChecklistDisplayCode,
  normalizeVietnameseFormCode,
} from '../utils/formCode.js'
import {
  SaveOutlined,
  PlusCircleOutlined,
  EditOutlined,
  EyeOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  LoadingOutlined,
  InfoCircleOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import '../styles/FormMetadataFormPage.css'

const DEFAULT_FORM_SUBJECT_TYPE = 'USER'

function isValidPassingScore(value) {
  const text = String(value).trim()
  const parsed = Number(text)
  return /^\d+(\.\d)?$/.test(text) && parsed >= 0 && parsed <= 10
}

function formatWeight(value) {
  if (value === null || value === undefined || value === '') return '—'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return `${Number.isInteger(parsed) ? parsed : parsed.toFixed(1)}%`
}

function formatScore(value) {
  if (value === null || value === undefined || value === '') return '—'
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toFixed(1) : '—'
}

function FormMetadataFormPage() {
  const { showToast } = useToast()
  const { id } = useParams()

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    danger: false
  })
  const navigate = useNavigate()
  const isEditMode = id && id !== 'new'

  const [loading, setLoading] = useState(Boolean(isEditMode))
  const [submitting, setSubmitting] = useState(false)
  const [versions, setVersions] = useState([])
  const [versionsLoading, setVersionsLoading] = useState(Boolean(isEditMode))
  const [errorMessage, setErrorMessage] = useState('')
  const [scoringVersion, setScoringVersion] = useState(null)
  const [passingScore, setPassingScore] = useState('')
  const [scoringError, setScoringError] = useState('')
  const [savingScore, setSavingScore] = useState(false)
  const [loadingScoring, setLoadingScoring] = useState(false)
  const [scoreConfigurable, setScoreConfigurable] = useState(false)
  const [scoringReady, setScoringReady] = useState(false)

  // Form states
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const getErrorMessage = (error, fallback) => {
    const data = error?.response?.data
    if (data) {
      if (Array.isArray(data.details)) {
        const detailsMsg = data.details.map(d => `${d.field}: ${d.message}`).join('; ')
        if (detailsMsg) {
          return `${data.message || 'Lỗi kiểm duyệt'}: ${detailsMsg}`
        }
      }
      return data.message || data.error || fallback
    }
    return fallback
  }

  const loadFormData = useCallback(() => {
    adminApi.getFormById(id)
      .then(res => {
        const form = res.data?.data
        if (!form) {
          throw new Error('Phản hồi thông tin biểu mẫu không hợp lệ.')
        }

        setCode(getChecklistDisplayCode(form.code))
        setTitle(form.title)
        setDescription(form.description || '')
      })
      .catch((error) => {
        console.error('Không thể tải thông tin biểu mẫu.', error)
        setErrorMessage(getErrorMessage(error, 'Không thể tải thông tin biểu mẫu.'))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id])

  const loadFormVersions = useCallback(() => {
    adminApi.getFormVersions(id, { page: 0, size: 100 })
      .then(res => {
        const pageData = res.data?.data
        if (!Array.isArray(pageData?.content)) {
          throw new Error('Phản hồi danh sách phiên bản không hợp lệ.')
        }

        setVersions(pageData.content)
      })
      .catch((error) => {
        console.error('Không thể tải danh sách phiên bản.', error)
        setVersions([])
        setErrorMessage(getErrorMessage(error, 'Không thể tải danh sách phiên bản.'))
      })
      .finally(() => {
        setVersionsLoading(false)
      })
  }, [id])

  useEffect(() => {
    if (isEditMode) {
      loadFormData()
      loadFormVersions()
    }
  }, [isEditMode, loadFormData, loadFormVersions])

  useEffect(() => {
    if (!scoringVersion) return undefined

    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !savingScore) setScoringVersion(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [savingScore, scoringVersion])

  const openScoringModal = async (version) => {
    setScoringVersion(version)
    setPassingScore(String(version.passingScoreOverride ?? version.passingScore ?? ''))
    setScoringError('')
    setScoreConfigurable(false)
    setScoringReady(false)
    setLoadingScoring(true)

    try {
      const response = await adminApi.getFormScoringConfiguration(id, version.id)
      const configuration = response.data?.data
      if (!configuration) throw new Error('Phản hồi cấu hình điểm không hợp lệ.')
      setScoringVersion((current) => current?.id === version.id
        ? { ...current, ...configuration, id: configuration.versionId }
        : current)
      setPassingScore(String(configuration.passingScoreOverride ?? configuration.passingScore ?? ''))
      setScoringReady(true)
    } catch (error) {
      setScoringError(getErrorMessage(error, 'Không thể tải cấu hình điểm của phiên bản.'))
    } finally {
      setLoadingScoring(false)
    }
  }

  const updatePassingScore = async () => {
    if (!scoringVersion || savingScore || loadingScoring || !scoringReady || !scoreConfigurable) return
    if (!isValidPassingScore(passingScore)) {
      setScoringError('Điểm sàn phải từ 0 đến 10 và có tối đa một chữ số thập phân.')
      return
    }

    try {
      setSavingScore(true)
      setScoringError('')
      const response = await adminApi.updateFormScoringConfiguration(id, scoringVersion.id, {
        passingScore: { mode: 'CUSTOM', value: Number(passingScore) },
        lockVersion: scoringVersion.lockVersion,
      })
      const result = response.data?.data
      showToast(
        result?.recalculationScheduled
          ? 'Đã tiếp nhận thay đổi điểm sàn và tạo tác vụ tính lại kết quả.'
          : 'Đã thay đổi điểm sàn thành công.',
        'success',
      )
      setScoringVersion(null)
      setVersionsLoading(true)
      loadFormVersions()
    } catch (error) {
      setScoringError(getErrorMessage(error, 'Không thể thay đổi điểm sàn.'))
    } finally {
      setSavingScore(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!code || !title) {
      showToast('Vui lòng điền đầy đủ các thông tin bắt buộc.', 'warning')
      return
    }

    // Validation: Code must be alphanumeric uppercase
    const cleanCode = normalizeVietnameseFormCode(code)
    if (cleanCode.length < 2) {
      showToast('Mã biểu mẫu cần có ít nhất 2 ký tự.', 'warning')
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    const metadataPayload = {
      title,
      description: description || null,
      subjectType: DEFAULT_FORM_SUBJECT_TYPE,
      ownerDepartmentId: null
    }

    if (isEditMode) {
      adminApi.updateForm(id, metadataPayload)
        .then(() => {
          showToast('Cập nhật thông tin biểu mẫu thành công!', 'success')
          setSubmitting(false)
          navigate('/admin/quality/checklists')
        })
        .catch(err => {
          console.error(err)
          setErrorMessage(getErrorMessage(err, 'Có lỗi xảy ra khi cập nhật biểu mẫu.'))
        })
        .finally(() => {
          setSubmitting(false)
        })
    } else {
      adminApi.createForm({
        code: cleanCode,
        ...metadataPayload,
      })
        .then(res => {
          showToast('Tạo biểu mẫu thành công!', 'success')
          setSubmitting(false)
          const newFormId = res.data?.data?.id
          if (newFormId) {
            navigate(`/admin/quality/checklists/${newFormId}/edit`)
          } else {
            navigate('/admin/quality/checklists')
          }
        })
        .catch(err => {
          console.error(err)
          setErrorMessage(getErrorMessage(err, 'Có lỗi xảy ra khi tạo mới biểu mẫu.'))
        })
        .finally(() => {
          setSubmitting(false)
        })
    }
  }

  // Versions Management Actions
  const handleCreateDraft = () => {
    setVersionsLoading(true)
    setErrorMessage('')
    adminApi.createFormVersion(id, {})
      .then(() => {
        showToast('Tạo bản nháp phiên bản mới thành công!', 'success')
        loadFormVersions()
      })
      .catch(err => {
        if (err.response?.status === 409) {
          setErrorMessage('Biểu mẫu đang có một bản nháp chưa công bố. Hãy tiếp tục thiết kế hoặc xóa bản nháp cũ.')
        } else {
          console.error(err)
          setErrorMessage(getErrorMessage(err, 'Không thể tạo bản nháp mới.'))
        }
        setVersionsLoading(false)
      })
  }

  const handlePublishVersion = (versionId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Công bố phiên bản',
      message: 'Bạn có chắc chắn muốn công bố (Publish) phiên bản này không? Sau khi công bố, phiên bản này sẽ hoạt động chính thức và KHÔNG THỂ chỉnh sửa.',
      danger: false,
      onConfirm: () => {
        setVersionsLoading(true)
        setErrorMessage('')
        adminApi.publishFormVersion(id, versionId)
          .then(() => {
            showToast('Công bố phiên bản thành công!', 'success')
            loadFormVersions()
          })
          .catch(err => {
            setVersionsLoading(false)
            console.error(err)
            setErrorMessage(getErrorMessage(err, 'Không thể công bố phiên bản. Hãy kiểm tra cấu hình câu hỏi và điểm số.'))
          })
      }
    })
  }

  const handleDeleteVersion = (versionId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xóa bản nháp',
      message: 'Bạn có chắc chắn muốn xóa bản nháp này không? Thao tác này sẽ xóa vĩnh viễn cấu trúc câu hỏi nháp.',
      danger: true,
      onConfirm: () => {
        setVersionsLoading(true)
        setErrorMessage('')
        adminApi.deleteFormVersion(id, versionId)
          .then(() => {
            showToast('Đã xóa bản nháp thành công!', 'success')
            loadFormVersions()
          })
          .catch(err => {
            setVersionsLoading(false)
            console.error(err)
            setErrorMessage(getErrorMessage(err, 'Không thể xóa bản nháp.'))
          })
      }
    })
  }

  const breadcrumbs = [
    { label: 'Quản lý chất lượng' },
    { label: 'Quản lý checklist', route: '/admin/quality/checklists' },
    { label: isEditMode ? 'Cập nhật biểu mẫu' : 'Tạo mới biểu mẫu' }
  ]

  const getVersionStatusBadge = (status) => {
    switch (status) {
      case 'PUBLISHED':
        return <span className="v-status v-status--published">Hoạt động</span>
      case 'DRAFT':
        return <span className="v-status v-status--draft">Bản nháp</span>
      case 'RETIRED':
        return <span className="v-status v-status--retired">Lịch sử</span>
      default:
        return <span className="v-status">{status}</span>
    }
  }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader back={{ to: '/admin/quality/checklists', label: 'Quay lại' }} breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="form-metadata-page">
              {errorMessage && (
                <div className="fmp-error" role="alert">
                  {errorMessage}
                </div>
              )}

              {loading ? (
                <div className="fmp-loading-card">
                  <LoadingOutlined /> Đang tải thông tin biểu mẫu...
                </div>
              ) : (
                <div className="fmp-sections-container">

                  {/* Metadata Card */}
                  <div className="fmp-card">
                    <h2 className="fmp-section-title">
                      {isEditMode ? 'Thông tin cấu hình biểu mẫu' : 'Đăng ký biểu mẫu mới'}
                    </h2>

                    <form onSubmit={handleSubmit} className="fmp-form">
                      <div className="fmp-form-grid">
                        <div className="fmp-form-field">
                          <label>
                            Mã biểu mẫu <span className="fmp-req">*</span>
                          </label>
                          <input
                            type="text"
                            className="fmp-input"
                            maxLength={50}
                            placeholder="Ví dụ: VE_SINH_TAY_LAM_SANG"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            onBlur={(e) => setCode(
                              normalizeVietnameseFormCode(e.target.value),
                            )}
                            disabled={isEditMode}
                            required
                          />
                          <span className="fmp-input-hint">
                            Có thể nhập tiếng Việt. Hệ thống tự chuyển thành chữ hoa
                            không dấu và nối bằng gạch dưới.
                          </span>
                        </div>

                        <div className="fmp-form-field">
                          <label>
                            Tiêu đề biểu mẫu <span className="fmp-req">*</span>
                          </label>
                          <input
                            type="text"
                            className="fmp-input"
                            placeholder="Nhập tiêu đề đầy đủ của quy trình..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                          />
                        </div>

                        <div className="fmp-form-field fmp-span-2">
                          <label>Mô tả ngắn</label>
                          <textarea
                            className="fmp-textarea"
                            placeholder="Nhập mục đích hoặc hướng dẫn áp dụng biểu mẫu..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                          />
                        </div>

                      </div>

                      <div className="fmp-form-actions">
                        <button
                          type="button"
                          className="fmp-btn-cancel"
                          onClick={() => navigate('/admin/quality/checklists')}
                        >
                          Hủy bỏ
                        </button>
                        <button type="submit" className="fmp-btn-save" disabled={submitting}>
                          {submitting ? (
                            <LoadingOutlined />
                          ) : (
                            <>
                              <SaveOutlined /> {isEditMode ? 'Lưu cấu hình' : 'Tạo biểu mẫu'}
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Versions History Card (Only in edit mode) */}
                  {isEditMode && (
                    <div className="fmp-card">
                      <div className="fmp-versions-header">
                        <h2 className="fmp-section-title">Danh sách phiên bản câu hỏi</h2>
                        <button className="fmp-btn-add-version" onClick={handleCreateDraft}>
                          <PlusCircleOutlined /> Tạo bản nháp mới (Draft)
                        </button>
                      </div>

                      <div className="fmp-versions-table-wrapper">
                        <table className="fmp-v-table">
                          <thead>
                            <tr>
                              <th style={{ width: '10%' }}>Phiên bản</th>
                              <th style={{ width: '15%' }}>Trạng thái</th>
                              <th style={{ width: '20%' }}>Ngày khởi tạo</th>
                              <th style={{ width: '21%' }}>Công bố lúc</th>
                              <th style={{ width: '15%' }}>Người công bố</th>
                              <th style={{ width: '19%', textAlign: 'center' }}>Hành động</th>
                            </tr>
                          </thead>
                          <tbody>
                            {versionsLoading ? (
                              <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '24px 0' }}>
                                  <LoadingOutlined /> Đang tải danh sách phiên bản...
                                </td>
                              </tr>
                            ) : versions.length === 0 ? (
                              <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '32px 0', color: '#64748b' }}>
                                  Biểu mẫu chưa có phiên bản nào. Hãy nhấn <strong>"Tạo bản nháp mới"</strong> để thiết kế.
                                </td>
                              </tr>
                            ) : (
                              [...versions]
                                .sort((a, b) => b.versionNumber - a.versionNumber)
                                .map((v) => (
                                  <tr key={v.id}>
                                    <td>
                                      <strong>v{v.versionNumber}</strong>
                                    </td>
                                    <td>{getVersionStatusBadge(v.status)}</td>
                                    <td>
                                      {v.createdAt ? new Date(v.createdAt).toLocaleDateString('vi-VN') : '—'}
                                    </td>
                                    <td>
                                      {v.publishedAt ? new Date(v.publishedAt).toLocaleString('vi-VN') : '—'}
                                    </td>
                                    <td>
                                      {v.publishedBy ? v.publishedBy.name : '—'}
                                    </td>
                                    <td>
                                      <div className="fmp-v-actions">
                                        {v.status === 'DRAFT' ? (
                                          <>
                                            <button
                                              className="fmp-v-btn fmp-v-btn--edit"
                                              onClick={() => navigate(`/admin/quality/checklists/${id}/builder/${v.id}`)}
                                              title="Thiết kế câu hỏi"
                                            >
                                              <EditOutlined /> Thiết kế
                                            </button>
                                            <button
                                              className="fmp-v-btn fmp-v-btn--publish"
                                              onClick={() => handlePublishVersion(v.id)}
                                              title="Công bố chính thức"
                                            >
                                              <SafetyCertificateOutlined /> Công bố
                                            </button>
                                            <button
                                              className="fmp-v-btn fmp-v-btn--delete"
                                              onClick={() => handleDeleteVersion(v.id)}
                                              title="Xóa bản nháp"
                                            >
                                              <DeleteOutlined />
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <button
                                              className="fmp-v-btn fmp-v-btn--edit"
                                              onClick={() => openScoringModal(v)}
                                              title="Thay đổi điểm sàn"
                                            >
                                              <EditOutlined /> Cấu hình điểm
                                            </button>
                                            <button
                                              className="fmp-v-btn fmp-v-btn--view"
                                              onClick={() => navigate(`/admin/quality/checklists/${id}/preview?versionId=${v.id}`)}
                                              title="Xem trước cấu trúc form"
                                            >
                                              <EyeOutlined /> Xem trước
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          </main>
        </div>
      </div>

      {scoringVersion && (
        <div
          className="fmp-scoring-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingScore) setScoringVersion(null)
          }}
        >
          <section
            className="fmp-scoring-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fmp-scoring-title"
          >
            <header className="fmp-scoring-modal__header">
              <div>
                <span>Cấu hình điểm sàn</span>
                <h2 id="fmp-scoring-title">{title} · v{scoringVersion.versionNumber}</h2>
              </div>
              <button
                aria-label="Đóng cấu hình điểm sàn"
                disabled={savingScore}
                onClick={() => setScoringVersion(null)}
                type="button"
              >
                <CloseOutlined />
              </button>
            </header>

            <div className="fmp-scoring-notice">
              <InfoCircleOutlined />
              <div>
                <strong>Phiên bản đang publish chỉ được sửa điểm sàn.</strong>
                <p>Tỷ lệ câu trọng yếu và câu thường đã được khóa để bảo toàn cấu trúc phiên bản.</p>
              </div>
            </div>

            <div className="fmp-scoring-weights" aria-label="Tỷ lệ nhóm câu hỏi">
              <div>
                <span>Câu trọng yếu</span>
                <strong>{loadingScoring ? <LoadingOutlined spin /> : formatWeight(scoringVersion.criticalWeightPercent)}</strong>
              </div>
              <div>
                <span>Câu thường</span>
                <strong>{loadingScoring ? <LoadingOutlined spin /> : formatWeight(scoringVersion.normalWeightPercent)}</strong>
              </div>
            </div>

            <div className="fmp-scoring-mode">
              <div className="fmp-scoring-current">
                <span>Điểm sàn hiện tại</span>
                <strong>
                  {loadingScoring
                    ? <LoadingOutlined spin />
                    : `${formatScore(scoringVersion.passingScore)}/10`}
                </strong>
              </div>
              <div className="fmp-scoring-switch">
                <span className={!scoreConfigurable ? 'is-active' : ''}>Cố định</span>
                <button
                  aria-checked={scoreConfigurable}
                  aria-label="Bật cấu hình điểm sàn"
                  disabled={loadingScoring || savingScore || !scoringReady}
                  onClick={() => {
                    setScoreConfigurable((current) => {
                      const next = !current
                      if (!next) {
                        setPassingScore(String(scoringVersion.passingScoreOverride ?? scoringVersion.passingScore ?? ''))
                      }
                      return next
                    })
                    setScoringError('')
                  }}
                  role="switch"
                  type="button"
                >
                  <i />
                </button>
                <span className={scoreConfigurable ? 'is-active' : ''}>Cấu hình</span>
              </div>
            </div>

            {scoreConfigurable && (
              <label className="fmp-scoring-field">
                <span>Điểm sàn mới</span>
                <div>
                  <input
                    autoFocus
                    disabled={savingScore}
                    max="10"
                    min="0"
                    onChange={(event) => {
                      setPassingScore(event.target.value)
                      setScoringError('')
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') updatePassingScore()
                    }}
                    step="0.1"
                    type="number"
                    value={passingScore}
                  />
                  <strong>/10</strong>
                </div>
                <small>Chấp nhận giá trị từ 0 đến 10, tối đa một chữ số thập phân.</small>
              </label>
            )}

            {scoringError && <div className="fmp-scoring-error" role="alert">{scoringError}</div>}

            <div className="fmp-scoring-recalculation-note">
              Khi điểm sàn thay đổi, các kết quả đã nộp của phiên bản này sẽ được hệ thống tính lại.
            </div>

            <footer className="fmp-scoring-modal__footer">
              <button disabled={savingScore} onClick={() => setScoringVersion(null)} type="button">
                Hủy
              </button>
              <button
                className="is-primary"
                disabled={savingScore || loadingScoring || !scoringReady || !scoreConfigurable}
                onClick={updatePassingScore}
                type="button"
              >
                {savingScore ? <LoadingOutlined spin /> : <SaveOutlined />}
                Thay đổi điểm sàn
              </button>
            </footer>
          </section>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
        onConfirm={() => {
          confirmModal.onConfirm()
          setConfirmModal(prev => ({ ...prev, isOpen: false }))
        }}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}

export default FormMetadataFormPage
