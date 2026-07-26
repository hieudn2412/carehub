import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchOutlined, EyeOutlined, LoadingOutlined } from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { examAssignmentApi } from '../../../../features/evaluation/api/examAssignmentApi'
import { trainingApi } from '../../../training/api/trainingApi'
import SearchableSelect from '../../../../shared/components/SearchableSelect.jsx'
import '../../styles/ManagerPages.css'

function ManagerExamResultsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [professionalFieldId, setProfessionalFieldId] = useState('')
  const [professionalFields, setProfessionalFields] = useState([])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      Promise.all([
        examAssignmentApi.listManagerAssignments({
          q: debouncedSearch || undefined,
          professionalFieldId: professionalFieldId || undefined,
        }),
        trainingApi.getRecordOptions(),
      ])
        .then(([res, optionRes]) => {
          const data = res.data?.data?.content || res.data?.data || []
          setAssignments(Array.isArray(data) ? data : [])
          setProfessionalFields(optionRes.data?.data?.professionalFields || [])
        })
        .catch(err => {
          console.error("Error fetching exam assignments", err)
        })
        .finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [professionalFieldId, debouncedSearch])

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Kết quả thi nhân sự" />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Kết quả thi nhân sự</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              Theo dõi kết quả các kỳ thi năng lực của điều dưỡng trong khoa
            </p>
          </div>

          {/* Search toolbar */}
          <div className="mgr-toolbar">
            <div className="mgr-search-box">
              <input 
                type="text" 
                placeholder="Tìm theo tên kỳ thi..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <SearchOutlined />
            </div>
            <div className="mgr-field-filter">
              <SearchableSelect
                value={professionalFieldId}
                onChange={setProfessionalFieldId}
                options={[
                  { value: '', label: 'Tất cả lĩnh vực chuyên môn' },
                  ...professionalFields.map((field) => ({ value: field.id, label: field.name })),
                ]}
                placeholder="Tất cả lĩnh vực chuyên môn"
                searchPlaceholder="Tìm tên lĩnh vực..."
                ariaLabel="Tìm và chọn lĩnh vực chuyên môn"
              />
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="mgr-card" style={{ textAlign: 'center', padding: 40 }}>
              <LoadingOutlined style={{ fontSize: 24, color: '#6b7280' }} />
              <p style={{ marginTop: 12, color: '#6b7280' }}>Đang tải dữ liệu...</p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="mgr-card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: '#6b7280' }}>Không có kỳ thi nào.</p>
            </div>
          ) : (
          <div className="mgr-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="mgr-table">
              <thead>
                <tr>
                  <th>Tên kỳ thi</th>
                  <th>Lĩnh vực chuyên môn</th>
                  <th>Ngày tạo</th>
                  <th>Trạng thái</th>
                  <th>Hạn nộp</th>
                  <th style={{ width: 80, textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.name || item.title || item.examTitle || `Kỳ thi #${item.id}`}</td>
                    <td>{item.professionalFieldName || '—'}</td>
                    <td style={{ color: '#475569' }}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '--'}
                    </td>
                    <td>
                      <span className={`mgr-badge mgr-badge--${item.status === 'OPEN' ? 'green' : item.status === 'CLOSED' ? 'red' : 'amber'}`}>
                        {item.status === 'OPEN' ? 'Đang mở' : item.status === 'CLOSED' ? 'Đã đóng' : item.status || '--'}
                      </span>
                    </td>
                    <td style={{ color: '#475569' }}>
                      {item.dueAt ? new Date(item.dueAt).toLocaleDateString('vi-VN') : '--'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        onClick={() => navigate(`/manager/exam-results/detail/${item.id}`)}
                        style={{
                          border: '1px solid #e2e8f0',
                          background: '#fff',
                          padding: '6px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          color: '#475569',
                          transition: 'all 0.15s'
                        }}
                        title="Xem kết quả"
                        onMouseOver={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#fff'; }}
                        onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#475569'; }}
                      >
                        <EyeOutlined />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ManagerExamResultsPage
