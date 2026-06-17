import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { MOCK_LOGS } from '../api/mockLogs'
import {
  SearchOutlined,
  EyeOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons'
import '../styles/SystemLogs.css'

function SystemLogsListScreen() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [page, setPage] = useState(1)

  const breadcrumbs = [
    { label: 'System logs' }
  ]

  // Extract all unique action types for dropdown filter
  const actionTypes = useMemo(() => {
    const types = MOCK_LOGS.map(l => l.action)
    return ['all', ...Array.from(new Set(types))]
  }, [])

  // Filter logs list
  const filteredLogs = useMemo(() => {
    return MOCK_LOGS.filter(log => {
      const matchSearch = 
        log.actor.toLowerCase().includes(search.toLowerCase()) ||
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.summary.toLowerCase().includes(search.toLowerCase())
      
      const matchAction = actionFilter === 'all' || log.action === actionFilter
      return matchSearch && matchAction
    })
  }, [search, actionFilter])

  // Pagination calculations
  const PAGE_SIZE = 10
  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE)
  const paginatedLogs = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE
    return filteredLogs.slice(startIndex, startIndex + PAGE_SIZE)
  }, [filteredLogs, page])

  const handleSearchChange = (e) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const handleActionChange = (e) => {
    setActionFilter(e.target.value)
    setPage(1)
  }

  // Get action class for styling
  const getActionClass = (actionName) => {
    if (actionName.includes('Chỉnh sửa') || actionName.includes('Đổi mật khẩu')) return 'edit'
    if (actionName.includes('Đăng nhập') || actionName.includes('Đăng xuất')) return 'login'
    if (actionName.includes('Cấu hình')) return 'config'
    if (actionName.includes('Upload')) return 'upload'
    return 'other'
  }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="log-page">
              
              {/* Header Title Card */}
              <div className="log-title-card">
                <h1 className="log-title">Nhật ký hệ thống</h1>
                <p className="log-subtitle">Giám sát và kiểm toán toàn bộ hoạt động của người dùng trên hệ thống</p>
              </div>

              {/* Filters Block */}
              <div className="log-filter-bar">
                <div className="log-search">
                  <span className="log-search-icon">
                    <SearchOutlined />
                  </span>
                  <input
                    type="text"
                    className="log-search-input"
                    placeholder="Tìm theo hành động, người thực hiện..."
                    value={search}
                    onChange={handleSearchChange}
                  />
                </div>

                {/* Action select filter */}
                <select 
                  className="log-filter-select"
                  value={actionFilter}
                  onChange={handleActionChange}
                >
                  <option value="all">Tất cả hành động</option>
                  {actionTypes.filter(t => t !== 'all').map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>

                <span className="log-results-count">{filteredLogs.length} kết quả</span>
              </div>

              {/* Table list */}
              <div className="log-table-card">
                <table className="log-table">
                  <thead>
                    <tr>
                      <th>Thời gian diễn ra</th>
                      <th>Hành động</th>
                      <th>Người dùng</th>
                      <th>Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLogs.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                          Không tìm thấy nhật ký hoạt động phù hợp.
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map(log => (
                        <tr key={log.id}>
                          <td><span className="log-time-col">{log.timestamp}</span></td>
                          <td>
                            <span className={`log-action-badge log-action-badge--${getActionClass(log.action)}`}>
                              {log.action}
                            </span>
                          </td>
                          <td>{log.actor}</td>
                          <td>
                            <button 
                              className="log-btn-detail" 
                              onClick={() => navigate(`/admin/system-logs/${log.id}`)}
                            >
                              <EyeOutlined /> Chi tiết
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Pagination footer */}
                {filteredLogs.length > 0 && (
                  <div className="log-pagination">
                    <span>
                      Hiển thị {paginatedLogs.length} trong tổng số {filteredLogs.length} kết quả
                    </span>
                    <div className="log-page-nums">
                      <button 
                        className="log-pn" 
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <LeftOutlined />
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                        <button
                          key={n}
                          className={`log-pn ${n === page ? 'log-pn--active' : ''}`}
                          onClick={() => setPage(n)}
                        >
                          {n}
                        </button>
                      ))}

                      <button 
                        className="log-pn" 
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

export default SystemLogsListScreen
