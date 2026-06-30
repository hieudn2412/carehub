import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  PaperClipOutlined, 
  EyeOutlined, 
  UploadOutlined, 
  ClockCircleOutlined, 
  LoadingOutlined,
  FileDoneOutlined,
  FileExclamationOutlined,
  SearchOutlined
} from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
import { trainingApi } from '../../../../features/training/api/trainingApi'
import '../../styles/TrainingHours.css'

function TrainingHoursEvidencesListScreen() {
  const navigate = useNavigate()
  
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    setLoading(true)
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
      case 'APPROVED': return 'Đã phê duyệt'
      case 'PENDING_REVIEW': return 'Chờ phê duyệt'
      case 'REJECTED': return 'Bị từ chối'
      case 'DRAFT': return 'Bản nháp'
      default: return status
    }
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'APPROVED': return 'training-badge--approved'
      case 'PENDING_REVIEW': return 'training-badge--pending'
      case 'REJECTED': return 'training-badge--rejected'
      case 'DRAFT': return 'training-badge--pending'
      default: return 'training-badge--pending'
    }
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header breadcrumbs={[{ label: 'Minh chứng của tôi' }]} />
        <div className="dashboard-layout__body">
          <div className="training-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Quản lý minh chứng</h1>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>Tải lên và theo dõi các tệp chứng chỉ, tài liệu CME</p>
              </div>
            </div>

            {/* Filters Row */}
            <div className="training-filters-row" style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div className="training-search-container" style={{ flex: 1, position: 'relative' }}>
                <span className="training-search-icon" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
                  <SearchOutlined style={{ color: '#9ca3af' }} />
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm kiếm theo tên hồ sơ đào tạo..."
                  className="training-search-input"
                  style={{ paddingLeft: 38, border: '1px solid #d1d5db', borderRadius: 8, height: 40, width: '100%' }}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: 220, border: '1px solid #d1d5db', borderRadius: 8, height: 40, padding: '0 12px' }}
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
              <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {filteredRecords.map((r) => (
                  <div key={r.id} className="detail-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 180, margin: 0 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <span className={`training-badge ${getStatusClass(r.workflowStatus)}`} style={{ margin: 0 }}>
                          <span className="training-badge__dot" />
                          {getStatusLabel(r.workflowStatus)}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb' }}>{r.declaredHours} giờ</span>
                      </div>
                      
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '4px 0 8px', lineHeight: 1.4 }}>
                        {r.title}
                      </h3>
                      
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

                    <div style={{ display: 'flex', gap: 10, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                      <button
                        onClick={() => navigate(`/staff/training/${r.id}/evidence`)}
                        className="training-button training-button--primary"
                        style={{ flex: 1, height: 36, fontSize: 13, borderRadius: 6, justifyContent: 'center' }}
                      >
                        <UploadOutlined style={{ marginRight: 4 }} /> Tải lên / Quản lý
                      </button>
                      <button
                        onClick={() => navigate(`/staff/training/${r.id}`)}
                        className="training-button"
                        style={{ height: 36, fontSize: 13, borderRadius: 6, width: 44, padding: 0, justifyContent: 'center' }}
                        title="Xem chi tiết hồ sơ"
                      >
                        <EyeOutlined />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrainingHoursEvidencesListScreen
