import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchOutlined, EyeOutlined, LoadingOutlined } from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import { trainingApi } from '../../../training/api/trainingApi'
import '../../styles/ManagerPages.css'

function ManagerEmployeeListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
    }, 400)
    return () => clearTimeout(handler)
  }, [search])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true)
      const params = {
        size: 100,
        keyword: debouncedSearch.trim() || undefined,
        complianceStatus: statusFilter !== 'all' ? statusFilter : undefined
      }

      trainingApi.getEmployeeTrainingStatuses(params)
        .then(res => {
          setEmployees(res.data?.data?.content || [])
          setError(null)
        })
        .catch(err => {
          console.error("Error loading employee training status list", err)
          setError("Không thể tải danh sách nhân sự trong khoa.")
        })
        .finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [debouncedSearch, statusFilter])

  const getStatusText = (status) => {
    switch (status) {
      case 'COMPLIANT':
        return 'Đạt'
      case 'AT_RISK':
        return 'Đang theo dõi'
      case 'NON_COMPLIANT':
        return 'Chưa đạt'
      case 'NOT_CONFIGURED':
        return 'Chưa thiết lập'
      default:
        return 'Chưa rõ'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLIANT':
        return 'green'
      case 'AT_RISK':
        return 'amber'
      case 'NON_COMPLIANT':
        return 'red'
      default:
        return 'gray'
    }
  }

  return (
    <AppShell title="Nhân sự trong khoa">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Nhân sự trong khoa</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
          Danh sách và tiến độ đào tạo của nhân sự trong khoa
        </p>
      </div>

      {/* Toolbar */}
      <div className="mgr-toolbar">
        <div className="mgr-search-box">
          <input
            type="text"
            placeholder="Tìm nhân sự theo tên, mã NV..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <SearchOutlined />
        </div>

        <div className="mgr-filter-group">
          <select
            className="mgr-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="COMPLIANT">Đạt</option>
            <option value="NON_COMPLIANT">Chưa đạt</option>
            <option value="AT_RISK">Đang theo dõi</option>
            <option value="NOT_CONFIGURED">Chưa thiết lập</option>
          </select>
        </div>
      </div>

      {/* Table Card */}
      <div className="mgr-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
            <LoadingOutlined style={{ fontSize: 24, marginRight: 8 }} /> Đang tải danh sách nhân sự...
          </div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
            {error}
          </div>
        ) : employees.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
            Không tìm thấy nhân sự nào.
          </div>
        ) : (
          <div className="mgr-table-wrap">
          <table className="mgr-table mgr-table--cards">
            <thead>
              <tr>
                <th>Mã NV</th>
                <th>Họ và tên</th>
                <th>Chức danh</th>
                <th>Khoa / Phòng</th>
                <th>Giờ đào tạo</th>
                <th>Trạng thái</th>
                <th style={{ width: 80, textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.employeeId}>
                  <td data-label="Mã NV" style={{ color: '#64748b', fontWeight: 600 }}>{emp.employeeCode}</td>
                  <td data-label="Họ và tên" style={{ fontWeight: 600, color: '#0f172a' }}>{emp.employeeName}</td>
                  <td data-label="Chức danh">{emp.jobPositionName || '---'}</td>
                  <td data-label="Khoa / Phòng">{emp.departmentName || '---'}</td>
                  <td data-label="Giờ đào tạo">
                    <strong style={{
                      color: getStatusColor(emp.complianceStatus) === 'green' ? 'var(--mgr-green)' : getStatusColor(emp.complianceStatus) === 'red' ? 'var(--mgr-red)' : 'var(--mgr-amber)',
                      fontSize: 14
                    }}>
                      {emp.submittedHours || 0}h / {emp.requiredHours || 0}h
                    </strong>
                  </td>
                  <td data-label="Trạng thái">
                    <span className={`mgr-badge mgr-badge--${getStatusColor(emp.complianceStatus)}`}>
                      {getStatusText(emp.complianceStatus)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => navigate(`/manager/employees/${emp.employeeId}`)}
                      style={{
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        padding: '6px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        color: '#475569',
                        transition: 'all 0.15s'
                      }}
                      title="Xem tổng hợp nhân sự"
                      className="mgr-view-btn"
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
    </AppShell>
  )
}

export default ManagerEmployeeListPage
