import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FormOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
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
    <AppShell title="Phiếu kiểm tra">
      <div className="ch-toolbar staff-checklist-toolbar">
        <h2>Danh sách phiếu kiểm tra được giao</h2>
      </div>
      <div className="ch-table-wrap staff-checklist-table-wrap">
        <table className="ch-table staff-checklist-table">
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
              <tr className="staff-checklist-table__empty"><td colSpan={6} className="ch-empty">Đang tải...</td></tr>
            ) : assignments.length === 0 ? (
              <tr className="staff-checklist-table__empty"><td colSpan={6} className="ch-empty">Bạn chưa có phiếu kiểm tra nào được giao</td></tr>
            ) : (
              assignments.map(item => (
                <tr key={item.id}>
                  <td data-label="Tên phiếu"><strong>{item.formName || item.name || `Phiếu #${item.id}`}</strong></td>
                  <td data-label="Mô tả">{item.description || '—'}</td>
                  <td data-label="Trạng thái">
                    <span className={`ch-badge ch-badge--${item.status === 'COMPLETED' ? 'green' : 'amber'}`}>
                      {statusIcon(item.status)} {statusLabel(item.status)}
                    </span>
                  </td>
                  <td data-label="Điểm sàn">
                    {item.version?.passingScore !== undefined && item.version?.passingScore !== null ? (
                      <strong style={{ color: '#0f6e56' }}>
                        {Number(item.version.passingScore).toFixed(1)}/10
                      </strong>
                    ) : (
                      <span className="ch-text-muted">—</span>
                    )}
                  </td>
                  <td data-label="Hạn nộp">{item.dueAt ? new Date(item.dueAt).toLocaleDateString('vi-VN') : '—'}</td>
                  <td data-label="Hành động">
                    <button
                      className="ch-btn ch-btn--primary ch-btn--sm"
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
    </AppShell>
  )
}

export default ChecklistListScreen
