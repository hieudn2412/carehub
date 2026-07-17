import { useState, useEffect, useCallback, useRef } from 'react'
import {
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../components/AdminSidebar'
import AdminHeader from '../components/AdminHeader'
import { adminApi } from '../api/adminApi'
import '../styles/QualityDashboardPage.css'

const PAGE_SIZE = 500

function getApiData(response) {
  return response?.data?.data || null
}

function getPageContent(response) {
  const data = getApiData(response)
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  return []
}

function getPageTotalPages(response) {
  const totalPages = Number(response?.data?.data?.totalPages)
  return Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1
}

async function fetchAllPages(fetcher, baseParams = {}) {
  const first = await fetcher({ ...baseParams, page: 0, size: PAGE_SIZE })
  const firstContent = getPageContent(first)
  const totalPages = getPageTotalPages(first)
  if (totalPages <= 1) return firstContent
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      fetcher({ ...baseParams, page: i + 1, size: PAGE_SIZE }),
    ),
  )
  return [...firstContent, ...rest.flatMap(r => getPageContent(r))]
}

function downloadCSV(rows, filename) {
  const headers = ['Mã NV', 'Họ tên', 'Khoa', 'Kỹ thuật', 'Số lần ĐG', 'Điểm TB', 'Tỷ lệ đạt', 'Trạng thái']
  const statusLabel = { PASSED: 'Đạt', FAILED_SCORE: 'Không đạt điểm', FAILED_CRITICAL: 'Không đạt tiêu chí', DRAFT: 'Nháp' }
  const csvRows = [headers.join(',')]
  rows.forEach(r => {
    csvRows.push([
      `"${r.employeeCode || ''}"`,
      `"${r.employeeName || ''}"`,
      `"${r.department || ''}"`,
      `"${r.technique || ''}"`,
      r.evalCount || '0',
      r.avgScore?.toFixed(1) || '0',
      (r.passRate || '0') + '%',
      `"${statusLabel[r.result] || '—'}"`,
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

function ExportQualityPage() {
  const requestIdRef = useRef(0)
  const [loading, setLoading] = useState(false)
  const [summaryRows, setSummaryRows] = useState([])
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('all')
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    adminApi.getDepartments()
      .then(res => {
        const depts = res?.data?.data
        if (Array.isArray(depts)) setDepartments(depts)
      })
      .catch(() => {})
  }, [])

  const loadData = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    try {
      const params = { departmentId: departmentId !== 'all' ? departmentId : undefined }
      const performanceItems = await fetchAllPages(
        (p) => adminApi.getDashboardFormPerformance({ ...p, ...params, sort: 'responseCount,desc' }),
      )

      if (requestId !== requestIdRef.current) return

      const rows = []
      performanceItems.forEach(form => {
        const passRate = Number(form.passRate) || 0
        const status = passRate >= 80 ? 'Đạt' : passRate >= 50 ? 'Cần cải thiện' : 'Thấp'
        rows.push({
          technique: form.formTitle || form.formCode || '—',
          formCode: form.formCode || '—',
          formId: form.formId,
          evalCount: form.submittedCount || form.responseCount || 0,
          passedCount: form.passedCount || 0,
          failedCount: (form.failedScoreCount || 0) + (form.failedCriticalCount || 0),
          avgScore: Number(form.averageConvertedScore) || 0,
          passRate,
          status,
        })
      })
      setSummaryRows(rows)
    } catch {
      setSummaryRows([])
    } finally {
      setLoading(false)
    }
  }, [departmentId])

  useEffect(() => { loadData() }, [loadData])

  const handleExport = () => {
    const flat = summaryRows.map(r => ({
      employeeCode: '',
      employeeName: '',
      department: '',
      technique: r.technique,
      evalCount: r.evalCount,
      avgScore: r.avgScore,
      passRate: r.passRate,
      result: r.status,
    }))
    downloadCSV(flat, `bao-cao-chat-luong-${year}.csv`)
  }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={[{ label: 'Dashboard & Báo cáo' }, { label: 'Xuất báo cáo chất lượng' }]} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qd-page">
              <div className="qd-header">
                <div>
                  <h1 className="qd-header__title">Xuất báo cáo chất lượng</h1>
                  <p className="qd-header__sub">Xuất báo cáo bảng kiểm chất lượng theo kỹ thuật ra CSV/Excel</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="qd-btn qd-btn--ghost" onClick={loadData} disabled={loading}>
                    {loading ? <LoadingOutlined spin /> : <ReloadOutlined />} Tải dữ liệu
                  </button>
                  <button className="qd-btn qd-btn--primary" onClick={handleExport} disabled={summaryRows.length === 0}>
                    <DownloadOutlined /> Xuất CSV
                  </button>
                </div>
              </div>

              <div className="qd-filters" style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <select value={departmentId} onChange={e => setDepartmentId(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, minWidth: 200 }}>
                  <option value="all">Toàn viện</option>
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

              {summaryRows.length > 0 && (
                <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
                  <EyeOutlined /> Hiển thị {summaryRows.length} kỹ thuật
                </div>
              )}

              <div className="qd-panel">
                <table className="qd-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Mã kỹ thuật</th>
                      <th>Tên kỹ thuật</th>
                      <th>Số lượt ĐG</th>
                      <th>Số đạt</th>
                      <th>Số không đạt</th>
                      <th>Điểm TB</th>
                      <th>Tỷ lệ đạt</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32 }}>Đang tải...</td></tr>
                    ) : summaryRows.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>Không có dữ liệu đánh giá chất lượng</td></tr>
                    ) : summaryRows.map((r, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td><code style={{ fontSize: 12 }}>{r.formCode}</code></td>
                        <td style={{ fontWeight: 500 }}>{r.technique}</td>
                        <td>{r.evalCount}</td>
                        <td style={{ color: '#16b889', fontWeight: 600 }}>{r.passedCount}</td>
                        <td style={{ color: '#ef4444', fontWeight: 600 }}>{r.failedCount}</td>
                        <td style={{ fontWeight: 600 }}>{r.avgScore.toFixed(1)}</td>
                        <td style={{ fontWeight: 600, color: r.passRate >= 80 ? '#16b889' : '#ef4444' }}>{r.passRate.toFixed(0)}%</td>
                        <td>
                          <span className={`qd-badge`} style={{
                            background: (r.passRate >= 80 ? '#16b889' : r.passRate >= 50 ? '#f59e0b' : '#ef4444') + '20',
                            color: r.passRate >= 80 ? '#16b889' : r.passRate >= 50 ? '#f59e0b' : '#ef4444',
                          }}>
                            {r.status}
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

export default ExportQualityPage
