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
  ArrowLeftOutlined,
  SaveOutlined,
  PlusCircleOutlined,
  EditOutlined,
  EyeOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import '../styles/FormMetadataFormPage.css'

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
  const [departments, setDepartments] = useState([])
  const [versions, setVersions] = useState([])
  const [versionsLoading, setVersionsLoading] = useState(Boolean(isEditMode))
  const [errorMessage, setErrorMessage] = useState('')

  // Form states
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subjectType, setSubjectType] = useState('USER')
  const [ownerDepartmentId, setOwnerDepartmentId] = useState('')

  const getErrorMessage = (error, fallback) => (
    error?.response?.data?.message
    || error?.response?.data?.error
    || fallback
  )

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
        setSubjectType(form.subjectType)
        setOwnerDepartmentId(form.ownerDepartment?.id || '')
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
    adminApi.getDepartments()
      .then(res => {
        const departmentData = res.data?.data
        const departmentList = Array.isArray(departmentData)
          ? departmentData
          : departmentData?.content
        setDepartments(Array.isArray(departmentList) ? departmentList : [])
      })
      .catch((error) => {
        console.error('Không thể tải danh sách khoa phòng.', error)
        setDepartments([])
      })

    if (isEditMode) {
      loadFormData()
      loadFormVersions()
    }
  }, [isEditMode, loadFormData, loadFormVersions])

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
      subjectType,
      ownerDepartmentId: ownerDepartmentId ? parseInt(ownerDepartmentId) : null
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
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="form-metadata-page">
              {errorMessage && (
                <div className="fmp-error" role="alert">
                  {errorMessage}
                </div>
              )}
              
              {/* Back Header link */}
              <div className="fmp-back-nav" onClick={() => navigate('/admin/quality/checklists')}>
                <ArrowLeftOutlined /> Quay lại danh sách biểu mẫu
              </div>

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
                            placeholder="Nhập tiêu đề đầy đủ của bảng kiểm..."
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

                        <div className="fmp-form-field">
                          <label>Đối tượng đánh giá chất lượng</label>
                          <select
                            className="fmp-select-control"
                            value={subjectType}
                            onChange={(e) => setSubjectType(e.target.value)}
                          >
                            <option value="USER">Nhân viên (Điều dưỡng/Bác sĩ)</option>
                            <option value="PATIENT">Bệnh nhân</option>
                            <option value="PROCESS">Quy trình chuyên môn</option>
                            <option value="ROOM">Phòng bệnh/Phòng khám</option>
                            <option value="DEPARTMENT">Khoa/Phòng</option>
                          </select>
                        </div>

                        <div className="fmp-form-field">
                          <label>Khoa/Phòng sở hữu</label>
                          <select
                            className="fmp-select-control"
                            value={ownerDepartmentId}
                            onChange={(e) => setOwnerDepartmentId(e.target.value)}
                          >
                            <option value="">Không phân khoa phòng (Áp dụng chung)</option>
                            {departments.map((dept) => (
                              <option key={dept.id} value={dept.id}>
                                {dept.name} ({dept.code})
                              </option>
                            ))}
                          </select>
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
                              <th style={{ width: '25%' }}>Công bố lúc</th>
                              <th style={{ width: '15%' }}>Người công bố</th>
                              <th style={{ width: '15%', textAlign: 'center' }}>Hành động</th>
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
                                          <button
                                            className="fmp-v-btn fmp-v-btn--view"
                                            onClick={() => navigate(`/admin/quality/checklists/${id}/preview?versionId=${v.id}`)}
                                            title="Xem trước cấu trúc form"
                                          >
                                            <EyeOutlined /> Xem trước
                                          </button>
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
