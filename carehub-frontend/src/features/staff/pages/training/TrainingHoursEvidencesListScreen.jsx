import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  EyeOutlined, 
  UploadOutlined, 
  LoadingOutlined,
  FileDoneOutlined,
  FileExclamationOutlined,
  SearchOutlined
} from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import '../../styles/TrainingHours.css'

function TrainingHoursEvidencesListScreen() {
  const navigate = useNavigate()
  
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    trainingApi.listRecords({ size: 1000, keyword: '%' })
      .then((res) => {
        setRecords(res.data?.data?.content || [])
      })
      .catch((err) => {
        console.error("Error loading records", err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const filteredRecords = records.filter(r => {
    const matchesSearch = r.title?.toLowerCase().includes(search.toLowerCase())
    if (statusFilter === 'all') return matchesSearch
    if (statusFilter === 'has_evidence') return matchesSearch && r.evidenceCount > 0
    if (statusFilter === 'no_evidence') return matchesSearch && (!r.evidenceCount || r.evidenceCount === 0)
    return matchesSearch
  })

  const getStatusLabel = (status) => {
    switch (status) {
      case 'SUBMITTED': return 'Đã nộp'
      case 'CANCELLED': return 'Đã hủy'
      case 'DRAFT': return 'Bản nháp'
      default: return status
    }
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'SUBMITTED': return 'training-badge--approved'
      case 'CANCELLED': return 'training-badge--rejected'
      case 'DRAFT': return 'training-badge--pending'
      default: return 'training-badge--pending'
    }
  }

  return (
    <AppShell breadcrumbs={[{ label: 'Minh chứng của tôi' }]}>
      <div className="training-page">
            <div className="th-page-heading">
              <div>
                <h1 className="th-page-title">Quản lý minh chứng</h1>
                <p className="th-page-subtitle">Tải lên và theo dõi các tệp chứng chỉ, tài liệu giờ đào tạo</p>
              </div>
            </div>

            {/* Filters Row */}
            <div className="training-filters-row th-evidence-list-filters">
              <div className="training-search-container">
                <span className="training-search-icon" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
                  <SearchOutlined style={{ color: '#9ca3af' }} />
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm kiếm theo tên hồ sơ đào tạo..."
                  className="training-search-input"
                  aria-label="Tìm hồ sơ đào tạo"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="th-filter-select"
                aria-label="Lọc trạng thái minh chứng"
              >
                <option value="all">Tất cả hồ sơ</option>
                <option value="has_evidence">Đã có minh chứng</option>
                <option value="no_evidence">Chưa có minh chứng</option>
              </select>
            </div>

            {loading ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: '#6b7280' }}>
                <LoadingOutlined style={{ fontSize: 24, marginRight: 8 }} /> Đang tải danh sách hồ sơ...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280', border: '1px dashed #e5e7eb', borderRadius: 8 }}>
                Không tìm thấy hồ sơ đào tạo nào phù hợp.
              </div>
            ) : (
              <div className="th-evidence-record-grid">
                {filteredRecords.map((r) => (
                  <article key={r.id} className="detail-card th-evidence-record-card">
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <span className={`training-badge ${getStatusClass(r.workflowStatus)}`} style={{ margin: 0 }}>
                          <span className="training-badge__dot" />
                          {getStatusLabel(r.workflowStatus)}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>{r.declaredHours} giờ</span>
                      </div>
                      
                      <h2 className="th-evidence-record-title">
                        {r.title}
                      </h2>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#6b7280', marginBottom: 12 }}>
                        {r.evidenceCount > 0 ? (
                          <>
                            <FileDoneOutlined style={{ color: '#16a34a' }} />
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>Đã tải lên {r.evidenceCount} tệp minh chứng</span>
                          </>
                        ) : (
                          <>
                            <FileExclamationOutlined style={{ color: '#dc2626' }} />
                            <span style={{ color: '#dc2626', fontWeight: 600 }}>Chưa có tệp minh chứng nào</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="th-evidence-record-actions">
                      <button
                        onClick={() => navigate(`/staff/training/${r.id}/evidence`)}
                        className="training-button training-button--primary"
                      >
                        <UploadOutlined style={{ marginRight: 4 }} /> Tải lên / Quản lý
                      </button>
                      <button
                        onClick={() => navigate(`/staff/training/${r.id}`)}
                        className="training-button"
                        title="Xem chi tiết hồ sơ"
                        aria-label={`Xem chi tiết ${r.title}`}
                      >
                        <EyeOutlined />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
      </div>
    </AppShell>
  )
}

export default TrainingHoursEvidencesListScreen
