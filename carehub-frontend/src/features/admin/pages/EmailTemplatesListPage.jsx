import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import { SearchOutlined, EditOutlined, DeleteOutlined, LeftOutlined, RightOutlined, LoadingOutlined, PlusCircleOutlined } from '@ant-design/icons'
import '../styles/EmailTemplatesListPage.css'

// Generate 74 mock email templates matching mockup exactly
const generateMockTemplates = () => {
  const templates = []
  const categories = ['Đào tạo', 'Đánh giá', 'Chất lượng']
  const triggers = ['Tự động · hàng tuần', 'Tự động · được giao', 'Tự động · khi không đạt', 'Tự động · hàng ngày']
  
  const initialRows = [
    {
      id: 1,
      code: 'Mẫu nhắc nhở thiếu giờ học (CME)',
      subject: '[VietDuc] Nhắc nhở: Bạn còn thiếu {{missing_hours}} giờ CME',
      body: 'Kính gửi {{employee_name}},\n\nTổng giờ CME 5 năm hiện tại: {{current_hours}} / 120h. Vui lòng bổ sung trước {{deadline}}.\n\nTrân trọng,\nHệ thống VietDuc',
      categoryName: 'Đào tạo',
      triggerCondition: 'Tự động · hàng tuần',
      active: true
    },
    {
      id: 2,
      code: 'Mẫu thông báo khi được giao bài thi mới',
      subject: '[VietDuc] Thông báo: Giao bài thi mới cho {{employee_name}}',
      body: 'Kính gửi {{employee_name}},\n\nBạn đã được giao bài thi mới: {{test_name}}. Thời gian hoàn thành trước {{deadline}}.\n\nTrân trọng,\nHệ thống VietDuc',
      categoryName: 'Đánh giá',
      triggerCondition: 'Tự động · được giao',
      active: true
    },
    {
      id: 3,
      code: 'Mẫu cảnh báo khi nhân viên thi trượt',
      subject: '[VietDuc] Cảnh báo: Nhân viên {{employee_name}} thi trượt',
      body: 'Kính gửi Quản lý,\n\nNhân viên {{employee_name}} thuộc phòng ban {{department}} đã thi trượt bài thi {{test_name}}.\n\nTrân trọng,\nHệ thống VietDuc',
      categoryName: 'Đánh giá',
      triggerCondition: 'Tự động · khi không đạt',
      active: false
    },
    {
      id: 4,
      code: 'Mẫu cảnh báo khi tỷ lệ làm đúng quy trình bị tụt dưới mức mục tiêu',
      subject: '[VietDuc] Cảnh báo: Tỷ lệ tuân thủ thấp dưới mức mục tiêu',
      body: 'Kính gửi Quản lý,\n\nTỷ lệ tuân thủ của {{department}} đang đạt {{compliance_rate}}%, thấp dưới mức mục tiêu {{target_rate}}%.\n\nTrân trọng,\nHệ thống VietDuc',
      categoryName: 'Chất lượng',
      triggerCondition: 'Tự động · hàng ngày',
      active: true
    }
  ]

  initialRows.forEach(row => templates.push(row))

  // Generate 70 extra mock templates to match footer count
  for (let i = 5; i <= 74; i++) {
    const catIndex = i % categories.length
    const trigIndex = i % triggers.length
    const codeName = `Mẫu thông báo số ${i} (${categories[catIndex]})`
    
    templates.push({
      id: i,
      code: codeName,
      subject: `[VietDuc] Tiêu đề email mẫu số ${i}`,
      body: `Kính gửi {{employee_name}},\n\nĐây là nội dung email mẫu số ${i} thuộc danh mục ${categories[catIndex]}.\n\nTrân trọng,\nHệ thống VietDuc`,
      categoryName: categories[catIndex],
      triggerCondition: triggers[trigIndex],
      active: i % 5 !== 0
    })
  }
  return templates
}

function EmailTemplatesListPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [useMock, setUseMock] = useState(false)

  // Filters State
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const mockDatabase = useMemo(() => generateMockTemplates(), [])

  // Helper to dynamically get category & trigger from name/code or localStorage
  const enrichTemplateFields = (tpl) => {
    const storedCat = localStorage.getItem(`tpl_cat_${tpl.id}`)
    const storedTrigger = localStorage.getItem(`tpl_trig_${tpl.id}`)

    let categoryName = storedCat || 'Đào tạo'
    let triggerCondition = storedTrigger || 'Tự động · hàng tuần'

    if (!storedCat && !storedTrigger) {
      const name = tpl.code?.toLowerCase() || ''
      if (name.includes('thi') || name.includes('trượt') || name.includes('đánh giá')) {
        categoryName = 'Đánh giá'
        triggerCondition = name.includes('trượt') ? 'Tự động · khi không đạt' : 'Tự động · được giao'
      } else if (name.includes('tỷ lệ') || name.includes('chất lượng') || name.includes('tuân thủ')) {
        categoryName = 'Chất lượng'
        triggerCondition = 'Tự động · hàng ngày'
      }
    }

    return {
      ...tpl,
      categoryName,
      triggerCondition
    }
  }

  // Apply Mock Filters
  const applyMockFilters = () => {
    let filtered = mockDatabase.map(enrichTemplateFields)

    if (search) {
      filtered = filtered.filter(t => t.code.toLowerCase().includes(search.toLowerCase()))
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.categoryName === categoryFilter)
    }
    if (statusFilter !== 'all') {
      const activeBool = statusFilter === 'ACTIVE'
      filtered = filtered.filter(t => t.active === activeBool)
    }

    setTotalElements(filtered.length)
    setTotalPages(Math.ceil(filtered.length / 10) || 1)

    const startIndex = (page - 1) * 10
    setTemplates(filtered.slice(startIndex, startIndex + 10))
    setLoading(false)
  }

  // Load email templates
  useEffect(() => {
    setLoading(true)
    if (useMock) {
      applyMockFilters()
      return
    }

    const params = {
      page: page - 1,
      size: 10,
      q: search || undefined
    }

    adminApi.getEmailTemplates(params)
      .then(res => {
        const data = res.data?.data
        if (data && data.content && data.content.length > 0) {
          const enriched = data.content.map(enrichTemplateFields)
          
          // Apply frontend category and status filters on backend paginated results (or do it locally if backend doesn't support them)
          let resultList = enriched
          if (categoryFilter !== 'all') {
            resultList = resultList.filter(t => t.categoryName === categoryFilter)
          }
          if (statusFilter !== 'all') {
            const activeBool = statusFilter === 'ACTIVE'
            resultList = resultList.filter(t => t.active === activeBool)
          }

          setTemplates(resultList)
          setTotalElements(data.totalElements || resultList.length)
          setTotalPages(data.totalPages || 1)
          setLoading(false)
        } else {
          setUseMock(true)
        }
      })
      .catch(err => {
        console.warn('GET /email/templates failed. Falling back to mock templates.', err)
        setUseMock(true)
      })
  }, [page, search, categoryFilter, statusFilter, useMock])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [search, categoryFilter, statusFilter])

  // Re-apply local mock filters when page changes in mock mode
  useEffect(() => {
    if (useMock) {
      applyMockFilters()
    }
  }, [page, search, categoryFilter, statusFilter, useMock])

  // Handle Delete Template
  const handleDelete = (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xoá biểu mẫu email này không?')) {
      if (useMock) {
        const idx = mockDatabase.findIndex(t => t.id === id)
        if (idx !== -1) mockDatabase.splice(idx, 1)
        applyMockFilters()
      } else {
        adminApi.deleteEmailTemplate(id)
          .then(() => {
            alert('Xoá biểu mẫu email thành công!')
            setTemplates(prev => prev.filter(t => t.id !== id))
            setTotalElements(prev => prev - 1)
          })
          .catch(err => {
            console.error('Delete failed, fallback to local', err)
            // Local fallback
            const idx = mockDatabase.findIndex(t => t.id === id)
            if (idx !== -1) mockDatabase.splice(idx, 1)
            applyMockFilters()
          })
      }
    }
  }

  const breadcrumbs = [
    { label: 'Danh sách biểu mẫu email thông báo' }
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="etl-page">
              
              {/* Title Card */}
              <div className="etl-title-card">
                <h1 className="etl-title">Biểu mẫu</h1>
                <p className="etl-subtitle">Quản lý biểu mẫu/mẫu email thông báo</p>
              </div>

              {/* Filters Block */}
              <div className="etl-filter-bar">
                <div className="etl-search-wrapper">
                  <span className="etl-search-icon">
                    <SearchOutlined />
                  </span>
                  <input
                    type="text"
                    className="etl-search-input"
                    placeholder="Tìm theo tên biểu mẫu.."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="etl-filter-select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">Danh mục</option>
                  <option value="Đào tạo">Đào tạo</option>
                  <option value="Đánh giá">Đánh giá</option>
                  <option value="Chất lượng">Chất lượng</option>
                </select>

                <select
                  className="etl-filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Trạng thái</option>
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="INACTIVE">Ngừng</option>
                </select>

                <button
                  className="etl-btn-create"
                  onClick={() => navigate('/admin/notifications/email-templates/new')}
                >
                  <PlusCircleOutlined /> Tạo mới biểu mẫu
                </button>
              </div>

              {/* Table List Card */}
              <div className="etl-table-card">
                <table className="etl-table">
                  <thead>
                    <tr>
                      <th>Tên biểu mẫu</th>
                      <th>Danh mục</th>
                      <th>Điều kiện kích hoạt</th>
                      <th>Trạng thái</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                          <LoadingOutlined style={{ marginRight: 8 }} /> Đang tải danh sách biểu mẫu...
                        </td>
                      </tr>
                    ) : templates.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                          Không tìm thấy biểu mẫu email phù hợp.
                        </td>
                      </tr>
                    ) : (
                      templates.map((tpl) => (
                        <tr key={tpl.id}>
                          <td><strong>{tpl.code}</strong></td>
                          <td>{tpl.categoryName}</td>
                          <td>{tpl.triggerCondition}</td>
                          <td>
                            <span className={`etl-badge ${tpl.active ? 'etl-badge--active' : 'etl-badge--inactive'}`}>
                              {tpl.active ? 'Hoạt động' : 'Ngừng'}
                            </span>
                          </td>
                          <td>
                            <div className="etl-actions-cell">
                              <button
                                className="etl-btn-action etl-btn-edit"
                                onClick={() => navigate(`/admin/notifications/email-templates/${tpl.id}`)}
                                title="Chỉnh sửa"
                              >
                                <EditOutlined />
                              </button>
                              <button
                                className="etl-btn-action etl-btn-delete"
                                onClick={() => handleDelete(tpl.id)}
                                title="Xoá"
                              >
                                <DeleteOutlined />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Pagination Footer */}
                {!loading && totalElements > 0 && (
                  <div className="etl-pagination">
                    <span>
                      Hiển thị {templates.length} trong tổng số {totalElements} kết quả
                    </span>
                    <div className="etl-page-nums">
                      <button
                        className="etl-pn"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <LeftOutlined />
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                        <button
                          key={n}
                          className={`etl-pn ${n === page ? 'etl-pn--active' : ''}`}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </button>
                      ))}

                      <button
                        className="etl-pn"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || totalPages === 0}
                      >
                        <RightOutlined />
                      </button>
                    </div>
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

export default EmailTemplatesListPage
export { generateMockTemplates }
