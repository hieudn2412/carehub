import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import Sidebar from '../components/sidebar'
import Header from '../components/Header'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { staffApi } from '../api/staffApi.js'
import '../styles/ChecklistListScreen.css'

function ChecklistListScreen() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)

  const loadAssignments = useCallback(() => {
    setLoading(true)
    staffApi.getAssignedForms({ page: 0, size: 50 })
      .then(res => {
        const data = res.data?.data?.content || res.data?.data || []
        setAssignments(Array.isArray(data) ? data : [])
      })
      .catch(err => {
        showToast(err?.response?.data?.message || 'Không thể tải danh sách phiếu kiểm tra', 'error')
        setAssignments([])
      })
      .finally(() => setLoading(false))
  }, [showToast])

  useEffect(() => {
    const timer = window.setTimeout(() => loadAssignments(), 0)
    return () => window.clearTimeout(timer)
  }, [loadAssignments])

  const statusIcon = (status) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircleOutlined style={{ color: '#10b981' }} />
      case 'IN_PROGRESS': return <ClockCircleOutlined style={{ color: '#f59e0b' }} />
      default: return <FormOutlined style={{ color: '#6b7280' }} />
    }
  }

  const statusLabel = (status) => {
    switch (status) {
      case 'COMPLETED': return 'Đã nộp'
      case 'IN_PROGRESS': return 'Đang làm'
      default: return 'Chưa làm'
    }
  }

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Phiếu kiểm tra" />
        <div className="dashboard-layout__body">
          <div className="page-toolbar">
            <h2 style={{ margin: 0 }}>Danh sách phiếu kiểm tra được giao</h2>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên phiếu</th>
                  <th>Mô tả</th>
                  <th>Trạng thái</th>
                  <th>Điểm sàn</th>
                  <th>Hạn nộp</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center">Đang tải...</td></tr>
                ) : assignments.length === 0 ? (
                  <tr><td colSpan={6} className="text-center">Bạn chưa có phiếu kiểm tra nào được giao</td></tr>
                ) : (
                  assignments.map(item => (
                    <tr key={item.id}>
                      <td><strong>{item.formName || item.name || `Phiếu #${item.id}`}</strong></td>
                      <td>{item.description || '—'}</td>
                      <td>
                        <span className={`status-badge status-badge--${item.status === 'COMPLETED' ? 'active' : 'warning'}`}>
                          {statusIcon(item.status)} {statusLabel(item.status)}
                        </span>
                      </td>
                      <td>
                        {item.version?.passingScore !== undefined && item.version?.passingScore !== null ? (
                          <strong style={{ color: '#0f6e56' }}>
                            {Number(item.version.passingScore).toFixed(1)}/10
                          </strong>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>{item.dueAt ? new Date(item.dueAt).toLocaleDateString('vi-VN') : '—'}</td>
                      <td>
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={() => navigate(`/staff/checklists/${item.id}`)}
                        >
                          {item.status === 'COMPLETED' ? 'Xem' : 'Làm phiếu'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChecklistListScreen
