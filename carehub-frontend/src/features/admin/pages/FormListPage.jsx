import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import {
  SearchOutlined,
  PlusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  LoadingOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import '../styles/FormListPage.css'

function FormListPage() {
  const navigate = useNavigate()
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [useMock, setUseMock] = useState(false)

  // Filter state
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('all')
  const [subjectType, setSubjectType] = useState('all')

  const MOCK_FORMS = [
    {
      id: 1,
      code: 'HAND_HYGIENE',
      title: 'Tuân thủ vệ sinh tay',
      description: 'Đánh giá quy trình tuân thủ vệ sinh tay của nhân viên y tế tại các khoa lâm sàng',
      subjectType: 'USER',
      status: 'PUBLISHED',
      ownerDepartment: { id: 1, code: 'K-HSTC', name: 'Khoa Hồi sức tích cực' },
      currentPublishedVersion: { id: 101, versionNumber: 1 },
      createdAt: '2026-05-10T08:00:00Z',
      updatedAt: '2026-06-01T15:30:00Z',
    },
    {
      id: 2,
      code: 'PATIENT_IDENTIFICATION',
      title: 'Xác định đúng danh tính người bệnh',
      description: 'Kiểm tra quy định đối chiếu thông tin người bệnh trước khi tiêm truyền hoặc làm thủ thuật',
      subjectType: 'PATIENT',
      status: 'PUBLISHED',
      ownerDepartment: { id: 2, code: 'K-CC', name: 'Khoa Cấp cứu' },
      currentPublishedVersion: { id: 102, versionNumber: 2 },
      createdAt: '2026-05-15T09:12:00Z',
      updatedAt: '2026-06-18T10:45:00Z',
    },
    {
      id: 3,
      code: 'IV_INJECTION',
      title: 'Kỹ thuật tiêm tĩnh mạch',
      description: 'Bảng kiểm đánh giá tay nghề thực hành tiêm tĩnh mạch của điều dưỡng',
      subjectType: 'USER',
      status: 'DRAFT',
      ownerDepartment: null,
      currentPublishedVersion: null,
      createdAt: '2026-06-20T14:00:00Z',
      updatedAt: '2026-06-22T08:20:00Z',
    },
    {
      id: 4,
      code: 'VAP_BUNDLE',
      title: 'Dự phòng viêm phổi liên quan máy thở',
      description: 'Care bundle giám sát tuân thủ dự phòng VAP cho bệnh nhân thở máy',
      subjectType: 'PROCESS',
      status: 'RETIRED',
      ownerDepartment: { id: 1, code: 'K-HSTC', name: 'Khoa Hồi sức tích cực' },
      currentPublishedVersion: { id: 99, versionNumber: 1 },
      createdAt: '2025-12-01T07:00:00Z',
      updatedAt: '2026-04-10T11:00:00Z',
    }
  ]

  const loadForms = () => {
    setLoading(true)
    if (useMock) {
      setTimeout(() => {
        let filtered = [...MOCK_FORMS]
        if (keyword) {
          filtered = filtered.filter(f =>
            f.title.toLowerCase().includes(keyword.toLowerCase()) ||
            f.code.toLowerCase().includes(keyword.toLowerCase())
          )
        }
        if (status !== 'all') {
          filtered = filtered.filter(f => f.status === status)
        }
        if (subjectType !== 'all') {
          filtered = filtered.filter(f => f.subjectType === subjectType)
        }
        setForms(filtered)
        setTotalElements(filtered.length)
        setTotalPages(1)
        setLoading(false)
      }, 300)
      return
    }

    const params = {
      page: page - 1,
      size: 10,
      keyword: keyword || undefined,
      status: status !== 'all' ? status : undefined,
      subjectType: subjectType !== 'all' ? subjectType : undefined,
    }

    adminApi.getForms(params)
      .then(res => {
        const pageData = res.data?.data
        if (pageData && pageData.content) {
          setForms(pageData.content)
          setTotalElements(pageData.totalElements)
          setTotalPages(pageData.totalPages || 1)
          setLoading(false)
        } else {
          setUseMock(true)
        }
      })
      .catch(err => {
        console.warn('GET /forms failed. Falling back to mockup data.', err)
        setUseMock(true)
      })
  }

  useEffect(() => {
    loadForms()
  }, [page, keyword, status, subjectType, useMock])

  const handleDelete = (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa (ngừng hoạt động) biểu mẫu này không? (Trạng thái sẽ chuyển về RETIRED)')) {
      if (useMock) {
        setForms(prev => prev.map(f => f.id === id ? { ...f, status: 'RETIRED' } : f))
        alert('Đã xóa mềm biểu mẫu (chuyển sang RETIRED) thành công!')
      } else {
        adminApi.deleteForm(id)
          .then(() => {
            alert('Đã xóa mềm biểu mẫu thành công!')
            loadForms()
          })
          .catch(err => {
            console.error('Delete form failed, fallback to local', err)
            setForms(prev => prev.map(f => f.id === id ? { ...f, status: 'RETIRED' } : f))
          })
      }
    }
  }

  const translateSubjectType = (type) => {
    const map = {
      USER: 'Nhân viên',
      PATIENT: 'Bệnh nhân',
      PROCESS: 'Quy trình',
      ROOM: 'Phòng bệnh',
      DEPARTMENT: 'Khoa phòng'
    }
    return map[type] || type
  }

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'PUBLISHED':
        return 'form-badge--published'
      case 'DRAFT':
        return 'form-badge--draft'
      case 'RETIRED':
        return 'form-badge--retired'
      default:
        return 'form-badge--gray'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'PUBLISHED':
        return 'Hoạt động'
      case 'DRAFT':
        return 'Bản nháp'
      case 'RETIRED':
        return 'Ngừng hoạt động'
      default:
        return status
    }
  }

  const breadcrumbs = [{ label: 'Quản lý chất lượng' }, { label: 'Quản lý checklist' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="form-list-page">
              
              {/* Title Header Card */}
              <div className="flp-header-card">
                <div className="flp-header-info">
                  <h1 className="flp-title">Danh sách biểu mẫu checklist</h1>
                  <p className="flp-subtitle">
                    Thiết kế và quản trị các bảng kiểm đánh giá chất lượng lâm sàng & an toàn người bệnh
                  </p>
                </div>
                <div className="flp-header-actions">
                  <button
                    className="flp-btn-create"
                    onClick={() => navigate('/admin/quality/checklists/new')}
                  >
                    <PlusCircleOutlined /> Tạo biểu mẫu mới
                  </button>
                </div>
              </div>

              {/* Toolbar filters */}
              <div className="flp-toolbar">
                <div className="flp-search-box">
                  <span className="flp-search-icon">
                    <SearchOutlined />
                  </span>
                  <input
                    type="text"
                    className="flp-search-input"
                    placeholder="Tìm kiếm theo mã, tiêu đề biểu mẫu..."
                    value={keyword}
                    onChange={(e) => {
                      setKeyword(e.target.value)
                      setPage(1)
                    }}
                  />
                </div>

                <div className="flp-filters">
                  <div className="flp-filter-group">
                    <label>Đối tượng:</label>
                    <select
                      className="flp-select"
                      value={subjectType}
                      onChange={(e) => {
                        setSubjectType(e.target.value)
                        setPage(1)
                      }}
                    >
                      <option value="all">Tất cả đối tượng</option>
                      <option value="USER">Nhân viên</option>
                      <option value="PATIENT">Bệnh nhân</option>
                      <option value="PROCESS">Quy trình</option>
                      <option value="ROOM">Phòng bệnh</option>
                      <option value="DEPARTMENT">Khoa phòng</option>
                    </select>
                  </div>

                  <div className="flp-filter-group">
                    <label>Trạng thái:</label>
                    <select
                      className="flp-select"
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value)
                        setPage(1)
                      }}
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="PUBLISHED">Hoạt động</option>
                      <option value="DRAFT">Bản nháp</option>
                      <option value="RETIRED">Ngừng hoạt động</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Table Card */}
              <div className="flp-table-card">
                <table className="flp-table">
                  <thead>
                    <tr>
                      <th style={{ width: '15%' }}>Mã biểu mẫu</th>
                      <th style={{ width: '35%' }}>Tiêu đề biểu mẫu</th>
                      <th style={{ width: '12%' }}>Đối tượng</th>
                      <th style={{ width: '15%' }}>Đơn vị sở hữu</th>
                      <th style={{ width: '10%' }}>Phiên bản hiện tại</th>
                      <th style={{ width: '13%' }}>Trạng thái</th>
                      <th style={{ width: '10%', textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="flp-table-empty">
                          <LoadingOutlined /> Đang tải dữ liệu...
                        </td>
                      </tr>
                    ) : forms.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="flp-table-empty">
                          Không tìm thấy biểu mẫu checklist phù hợp.
                        </td>
                      </tr>
                    ) : (
                      forms.map((form) => (
                        <tr key={form.id}>
                          <td>
                            <span className="flp-form-code">{form.code}</span>
                          </td>
                          <td>
                            <div className="flp-form-title-wrapper">
                              <span className="flp-form-title">{form.title}</span>
                              {form.description && (
                                <span className="flp-form-desc">{form.description}</span>
                              )}
                            </div>
                          </td>
                          <td>{translateSubjectType(form.subjectType)}</td>
                          <td>
                            {form.ownerDepartment ? (
                              <span className="flp-dept-tag" title={form.ownerDepartment.name}>
                                {form.ownerDepartment.code}
                              </span>
                            ) : (
                              <span className="flp-text-muted">—</span>
                            )}
                          </td>
                          <td>
                            {form.currentPublishedVersion ? (
                              <span className="flp-version-badge">
                                v{form.currentPublishedVersion.versionNumber}
                              </span>
                            ) : (
                              <span className="flp-text-muted">Chưa có</span>
                            )}
                          </td>
                          <td>
                            <span className={`form-badge ${getStatusBadgeClass(form.status)}`}>
                              {getStatusText(form.status)}
                            </span>
                          </td>
                          <td>
                            <div className="flp-actions-cell">
                              <button
                                className="flp-btn-action flp-btn-edit"
                                onClick={() => navigate(`/admin/quality/checklists/${form.id}/edit`)}
                                title="Chi tiết & Phiên bản"
                              >
                                <EditOutlined /> Chi tiết
                              </button>
                              {form.status !== 'RETIRED' && (
                                <button
                                  className="flp-btn-action flp-btn-delete"
                                  onClick={() => handleDelete(form.id)}
                                  title="Xóa mềm"
                                >
                                  <DeleteOutlined />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {!loading && totalElements > 0 && (
                  <div className="flp-pagination">
                    <span className="flp-pagination-summary">
                      Hiển thị <strong>{forms.length}</strong> trên tổng số <strong>{totalElements}</strong> kết quả
                    </span>
                    {totalPages > 1 && (
                      <div className="flp-pagination-buttons">
                        <button
                          className="flp-pg-btn"
                          disabled={page === 1}
                          onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                        >
                          Trước
                        </button>
                        {[...Array(totalPages)].map((_, i) => (
                          <button
                            key={i + 1}
                            className={`flp-pg-btn ${page === i + 1 ? 'active' : ''}`}
                            onClick={() => setPage(i + 1)}
                          >
                            {i + 1}
                          </button>
                        ))}
                        <button
                          className="flp-pg-btn"
                          disabled={page === totalPages}
                          onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                        >
                          Sau
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default FormListPage
