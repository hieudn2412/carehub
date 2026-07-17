import { useState, useEffect, useCallback } from 'react'
import {
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { trainingApi } from '../../training/api/trainingApi'
import '../styles/QualityDashboardPage.css'

const PAGE_SIZE = 500

async function fetchAll(fetcher, baseParams = {}) {
  const first = await fetcher({ ...baseParams, page: 0, size: PAGE_SIZE })
  const firstData = first?.data?.data
  const content = firstData?.content || []
  const totalPages = firstData?.totalPages || 1
  if (totalPages <= 1) return content
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      fetcher({ ...baseParams, page: i + 1, size: PAGE_SIZE }),
    ),
  )
  return [...content, ...rest.flatMap(r => r?.data?.data?.content || [])]
}

function downloadCSV(rows, filename) {
  const headers = ['Mã NV', 'Họ tên', 'Khoa', 'Chức danh', 'Giờ yêu cầu', 'Giờ đã nộp', 'Tỷ lệ %', 'Trạng thái']
  const statusLabel = {
    COMPLIANT: 'Đạt', NON_COMPLIANT: 'Không đạt', AT_RISK: 'Đang theo dõi', NOT_CONFIGURED: 'Chưa áp dụng',
  }
  const csvRows = [headers.join(',')]
  rows.forEach(r => {
    csvRows.push([
      `"${r.code || ''}"`,
      `"${r.name || ''}"`,
      `"${r.departmentName || ''}"`,
      `"${r.jobTitle || ''}"`,
      r.requiredHours?.toFixed(0) || '0',
      r.submittedHours?.toFixed(0) || '0',
      (r.progressPct || 0).toFixed(0) + '%',
      `"${statusLabel[r.compliance] || '—'}"`,
    ].join(','))
  })
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function ExportTrainingPage() {
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    trainingApi.getDepartments()
      .then(res => setDepartments(res?.data?.data || []))
      .catch(() => {})
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = { departmentId: departmentId || undefined }
      const data = await fetchAll(trainingApi.getEmployeeTrainingStatuses, params)
      setEmployees(data.map(e => ({
        code: e.employeeCode,
        name: e.employeeName,
        departmentName: e.departmentName || '—',
        jobTitle: e.jobPositionName || '—',
        requiredHours: parseFloat(e.requiredHours) || 0,
        submittedHours: parseFloat(e.submittedHours) || 0,
        progressPct: parseFloat(e.progressPercentage) || 0,
        compliance: e.complianceStatus,
      })))
    } catch {
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }, [departmentId])

  useEffect(() => { loadData() }, [loadData])

  const handleExport = () => {
    downloadCSV(employees, `bao-cao-dao-tao-${year}.csv`)
  }

  const statusCfg = {
    COMPLIANT: { label: 'Đạt', color: '#16b889' },
    NON_COMPLIANT: { label: 'Không đạt', color: '#ef4444' },
    AT_RISK: { label: 'Đang theo dõi', color: '#f59e0b' },
    NOT_CONFIGURED: { label: 'Chưa áp dụng', color: '#94a3b8' },
  }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={[{ label: 'Dashboard & Báo cáo' }, { label: 'Xuất báo cáo đào tạo' }]} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qd-page">
              <div className="qd-header">
                <div>
                  <h1 className="qd-header__title">Xuất báo cáo đào tạo</h1>
                  <p className="qd-header__sub">Xuất báo cáo giờ đào tạo nhân viên ra CSV/Excel</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="qd-btn qd-btn--ghost" onClick={loadData} disabled={loading}>
                    {loading ? <LoadingOutlined spin /> : <ReloadOutlined />} Tải dữ liệu
                  </button>
                  <button className="qd-btn qd-btn--primary" onClick={handleExport} disabled={employees.length === 0}>
                    <DownloadOutlined /> Xuất CSV
                  </button>
                </div>
              </div>

              <div className="qd-filters" style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, minWidth: 200 }}>
                  <option value="">Toàn viện</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select value={year} onChange={e => setYear(Number(e.target.value))}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}>
                  {Array.from({ length: 5 }, (_, i) => {
                    const y = new Date().getFullYear() - i
                    return <option key={y} value={y}>{y}</option>
                  })}
                </select>
              </div>

              {employees.length > 0 && (
                <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
                  <EyeOutlined /> Hiển thị {employees.length} nhân viên
                </div>
              )}

              <div className="qd-panel">
                <table className="qd-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Mã NV</th>
                      <th>Họ tên</th>
                      <th>Khoa</th>
                      <th>Chức danh</th>
                      <th>Giờ yêu cầu</th>
                      <th>Giờ đã nộp</th>
                      <th>Tỷ lệ %</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32 }}>Đang tải...</td></tr>
                    ) : employees.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>Không có dữ liệu</td></tr>
                    ) : employees.map((e, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td><code style={{ fontSize: 12 }}>{e.code || '—'}</code></td>
                        <td style={{ fontWeight: 500 }}>{e.name || '—'}</td>
                        <td>{e.departmentName}</td>
                        <td>{e.jobTitle}</td>
                        <td>{e.requiredHours.toFixed(0)}</td>
                        <td>{e.submittedHours.toFixed(0)}</td>
                        <td style={{ fontWeight: 600, color: e.progressPct >= 100 ? '#16b889' : '#ef4444' }}>{e.progressPct.toFixed(0)}%</td>
                        <td>
                          <span className={`qd-badge`} style={{
                            background: (statusCfg[e.compliance]?.color || '#6b7280') + '20',
                            color: statusCfg[e.compliance]?.color || '#6b7280',
                          }}>
                            {statusCfg[e.compliance]?.label || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ExportTrainingPage
