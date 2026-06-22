import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
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
import '../styles/FormMetadataFormPage.css'

function FormMetadataFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = id && id !== 'new'

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [departments, setDepartments] = useState([])
  const [versions, setVersions] = useState([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [useMock, setUseMock] = useState(false)

  // Form states
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subjectType, setSubjectType] = useState('USER')
  const [ownerDepartmentId, setOwnerDepartmentId] = useState('')

  const MOCK_DEPARTMENTS = [
    { id: 1, code: 'K-HSTC', name: 'Khoa Hồi sức tích cực' },
    { id: 2, code: 'K-CC', name: 'Khoa Cấp cứu' },
    { id: 3, code: 'K-TM', name: 'Khoa Tim mạch' },
    { id: 4, code: 'K-Ngoai', name: 'Khoa Ngoại tổng hợp' }
  ]

  const MOCK_VERSIONS = [
    {
      id: 101,
      versionNumber: 1,
      status: 'PUBLISHED',
      publishedAt: '2026-06-01T15:30:00Z',
      publishedBy: { name: 'Nguyễn Văn A' },
      createdAt: '2026-05-10T08:00:00Z'
    },
    {
      id: 102,
      versionNumber: 2,
      status: 'DRAFT',
      publishedAt: null,
      publishedBy: null,
      createdAt: '2026-06-22T08:20:00Z'
    }
  ]

  useEffect(() => {
    // Load departments
    adminApi.getDepartments()
      .then(res => {
        if (res.data?.data) {
          setDepartments(res.data.data)
        } else {
          setDepartments(MOCK_DEPARTMENTS)
        }
      })
      .catch(() => {
        setDepartments(MOCK_DEPARTMENTS)
      })

    if (isEditMode) {
      loadFormData()
      loadFormVersions()
    }
  }, [id, useMock])

  const loadFormData = () => {
    setLoading(true)
    adminApi.getFormById(id)
      .then(res => {
        const form = res.data?.data
        if (form) {
          setCode(form.code)
          setTitle(form.title)
          setDescription(form.description || '')
          setSubjectType(form.subjectType)
          setOwnerDepartmentId(form.ownerDepartment?.id || '')
          setLoading(false)
        } else {
          setUseMock(true)
        }
      })
      .catch(() => {
        // Mock fallback
        const mockForm = {
          code: 'HAND_HYGIENE',
          title: 'Tuân thủ vệ sinh tay',
          description: 'Đánh giá quy trình tuân thủ vệ sinh tay của nhân viên y tế tại các khoa lâm sàng',
          subjectType: 'USER',
          ownerDepartment: { id: 1 }
        }
        setCode(mockForm.code)
        setTitle(mockForm.title)
        setDescription(mockForm.description)
        setSubjectType(mockForm.subjectType)
        setOwnerDepartmentId(mockForm.ownerDepartment.id)
        setUseMock(true)
        setLoading(false)
      })
  }

  const loadFormVersions = () => {
    setVersionsLoading(true)
    adminApi.getFormVersions(id)
      .then(res => {
        if (res.data?.data) {
          setVersions(res.data.data)
        } else {
          setVersions(MOCK_VERSIONS)
        }
        setVersionsLoading(false)
      })
      .catch(() => {
        setVersions(MOCK_VERSIONS)
        setVersionsLoading(false)
      })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!code || !title) {
      alert('Vui lòng điền đầy đủ các thông tin bắt buộc.')
      return
    }

    // Validation: Code must be alphanumeric uppercase
    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_.-]/g, '')
    if (cleanCode !== code) {
      alert('Mã biểu mẫu chỉ được chứa chữ cái viết hoa, số và ký tự gạch dưới (_), gạch ngang (-), dấu chấm (.)')
      return
    }

    setSubmitting(true)
    const payload = {
      code: cleanCode,
      title,
      description: description || null,
      subjectType,
      ownerDepartmentId: ownerDepartmentId ? parseInt(ownerDepartmentId) : null
    }

    if (isEditMode) {
      adminApi.updateForm(id, payload)
        .then(() => {
          alert('Cập nhật thông tin biểu mẫu thành công!')
          setSubmitting(false)
          navigate('/admin/quality/checklists')
        })
        .catch(err => {
          setSubmitting(false)
          console.error(err)
          alert(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật biểu mẫu.')
        })
    } else {
      adminApi.createForm(payload)
        .then(res => {
          alert('Tạo biểu mẫu thành công!')
          setSubmitting(false)
          const newFormId = res.data?.data?.id
          if (newFormId) {
            navigate(`/admin/quality/checklists/${newFormId}/edit`)
          } else {
            navigate('/admin/quality/checklists')
          }
        })
        .catch(err => {
          setSubmitting(false)
          console.error(err)
          alert(err.response?.data?.message || 'Có lỗi xảy ra khi tạo mới biểu mẫu.')
        })
    }
  }

  // Versions Management Actions
  const handleCreateDraft = () => {
    setVersionsLoading(true)
    adminApi.createFormVersion(id, {})
      .then(() => {
        alert('Tạo bản nháp phiên bản mới thành công!')
        loadFormVersions()
      })
      .catch(err => {
        setVersionsLoading(false)
        if (err.response?.status === 409) {
          alert('Không thể tạo bản nháp mới: Biểu mẫu này đang có sẵn một phiên bản DRAFT nháp chưa được công bố. Vui lòng thiết kế tiếp hoặc xóa bản nháp cũ.')
        } else {
          console.error(err)
          // local mockup fallback
          const newId = Date.now()
          const nextNo = versions.length + 1
          setVersions(prev => [...prev, {
            id: newId,
            versionNumber: nextNo,
            status: 'DRAFT',
            publishedAt: null,
            publishedBy: null,
            createdAt: new Date().toISOString()
          }])
          alert('Tạo bản nháp mới thành công! (Chế độ giả lập)')
        }
      })
  }

  const handlePublishVersion = (versionId) => {
    if (window.confirm('Bạn có chắc chắn muốn công bố (Publish) phiên bản này không? Sau khi công bố, phiên bản này sẽ hoạt động chính thức và KHÔNG THỂ chỉnh sửa.')) {
      setVersionsLoading(true)
      adminApi.publishFormVersion(id, versionId)
        .then(() => {
          alert('Công bố phiên bản thành công!')
          loadFormVersions()
        })
        .catch(err => {
          setVersionsLoading(false)
          console.error(err)
          // local mock fallback
          setVersions(prev => prev.map(v => {
            if (v.id === versionId) return { ...v, status: 'PUBLISHED', publishedAt: new Date().toISOString(), publishedBy: { name: 'Quản trị viên' } }
            if (v.status === 'PUBLISHED') return { ...v, status: 'RETIRED' }
            return v
          }))
          alert('Công bố phiên bản thành công! (Chế độ giả lập)')
        })
    }
  }

  const handleDeleteVersion = (versionId) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bản nháp này không? Thao tác này sẽ xóa vĩnh viễn cấu trúc câu hỏi nháp.')) {
      setVersionsLoading(true)
      adminApi.deleteFormVersion(id, versionId)
        .then(() => {
          alert('Đã xóa bản nháp thành công!')
          loadFormVersions()
        })
        .catch(err => {
          setVersionsLoading(false)
          console.error(err)
          // local mock fallback
          setVersions(prev => prev.filter(v => v.id !== versionId))
          alert('Đã xóa bản nháp thành công! (Chế độ giả lập)')
        })
    }
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
                            placeholder="Ví dụ: DONG_PHUC_Y_TE"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            disabled={isEditMode}
                            required
                          />
                          <span className="fmp-input-hint">
                            Mã duy nhất, viết hoa, không dấu, không khoảng trắng (chỉ cho phép chữ, số, `_`, `-`, `.`).
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
    </div>
  )
}

export default FormMetadataFormPage
