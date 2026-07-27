import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
import { staffApi } from '../../staff/api/staffApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import { tokenStorage } from '../../../features/auth/services/tokenStorage.js'
import { getRolesFromAccessToken } from '../../../features/auth/utils/jwt.js'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import '../styles/EvaluationDashboardPage.css'

function ComplianceByTechniquePage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = roles.some(r => String(r).toUpperCase().includes('ADMIN'))
  const isManager = roles.some(r => String(r).toUpperCase().includes('MANAGER'))

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState([])

  const [departmentId, setDepartmentId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear()}-01-01`)
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))

  const dashboardPath = isAdmin ? '/admin/dashboard' : '/manager/dashboard'

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        if (isAdmin) {
          const response = await adminApi.getDepartments()
          const depts = apiData(response, [])
          setDepartments(depts)
          return
        }

        const response = await staffApi.getProfile()
        const profile = apiData(response, null)
        if (!profile?.departmentId) {
          throw new Error('Manager chưa được gán khoa/phòng')
        }
        setDepartments([{
          id: profile.departmentId,
          name: profile.departmentName || 'Khoa của tôi',
        }])
        setDepartmentId(String(profile.departmentId))
      } catch (error) {
        showToast(apiErrorMessage(error), 'error')
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isAdmin, showToast])

  const loadData = useCallback(async () => {
    if (!departmentId && !isAdmin) {
      showToast('Vui lòng chọn khoa/phòng', 'warning')
      return
    }
    setLoading(true)
    try {
      const response = await competencyApi.getByTechnique({
        departmentId,
        keyword: keyword || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      })
      const responseData = apiData(response, null)
      setData(responseData)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [departmentId, fromDate, isAdmin, keyword, toDate, showToast])

  useEffect(() => {
    if (!departmentId && !isAdmin) return undefined
    const timer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(timer)
  }, [departmentId, isAdmin, loadData])

  const breadcrumbs = [
    { label: 'Dashboard', link: dashboardPath },
    { label: 'Đánh giá' },
    { label: 'Tuân thủ quy trình, quy định' },
  ]

  const totalCount = data?.items ? data.items.length : 0

  return (
    <AppShell breadcrumbs={isAdmin ? breadcrumbs : undefined} title={isManager ? 'Tuân thủ quy trình, quy định' : undefined}>
            <div className="evd-page">
              <section className="evd-title-card">
                <div>
                  <h1>Tuân thủ quy trình, quy định</h1>
                  <p>Tổng hợp mọi lượt kiểm tra giám sát theo nhân viên</p>
                </div>
                <button className="evd-btn" onClick={loadData} disabled={loading}>
                  <ReloadOutlined /> Tải lại
                </button>
              </section>

              <section className="evd-filter-bar evd-x-filter-bar">
                {isAdmin && (
                  <div className="evd-x-filter-field evd-x-filter-field--wide">
                    <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Khoa/phòng</label>
                    <SearchableSelect
                      value={departmentId}
                      onChange={setDepartmentId}
                      options={[
                        { value: '', label: 'Toàn viện' },
                        ...departments.map((department) => ({ value: department.id, label: department.name })),
                      ]}
                      placeholder="Toàn viện"
                      searchPlaceholder="Tìm tên khoa/phòng..."
                      ariaLabel="Tìm và chọn khoa/phòng"
                    />
                  </div>
                )}
                {!isAdmin && departments.length > 0 && (
                  <div className="evd-x-filter-field">
                    <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Khoa/phòng</label>
                    <span style={{ padding: '7px 0', color: '#374151', fontSize: 13, fontWeight: 600 }}>
                      {departments[0].name}
                    </span>
                  </div>
                )}
                <div className="evd-x-filter-field">
                  <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Tên nhân viên</label>
                  <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm theo tên nhân viên"
                    className="evd-x-input evd-x-input--wide" />
                </div>
                <div className="evd-x-filter-field">
                  <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Từ ngày</label>
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                    className="evd-x-input" />
                </div>
                <div className="evd-x-filter-field">
                  <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Đến ngày</label>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                    className="evd-x-input" />
                </div>
              </section>

              {data && (
                <section className="evd-panel" style={{
                  padding: 16, marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap',
                }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>
                    Nhân viên đã được đánh giá: <span style={{ color: '#2563eb' }}>{totalCount}</span>
                  </div>
                  {totalCount === 0 && data && (
                    <div style={{ fontSize: 14, color: '#9ca3af' }}>
                      Chưa có dữ liệu tuân thủ kỹ thuật trong khoảng thời gian đã chọn.
                    </div>
                  )}
                </section>
              )}

              <div className="evd-card evd-x-table-card">
                <table className="evd-table admin-table-uppercase">
                  <thead>
                    <tr>
                      <th>Nhân viên</th>
                      <th>Tổng số lần được kiểm tra</th>
                      <th>Tỷ lệ tuân thủ chung</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="ch-empty">
                          Đang tải dữ liệu...
                        </td>
                      </tr>
                    ) : !data || !data.items || data.items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="ch-empty">
                          {!departmentId ? 'Vui lòng chọn khoa/phòng.' : 'Chưa có dữ liệu tuân thủ kỹ thuật.'}
                        </td>
                      </tr>
                    ) : (
                      data.items.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 500 }}>{item.employeeName}<br /><small>{item.employeeCode} · {item.departmentName || data?.departmentName || '—'}</small></td>
                          <td>{item.evaluationCount}</td>
                          <td>
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>
                              {item.passCount || 0}/{item.evaluationCount || 0} – {item.passRate != null ? `${item.passRate}%` : '0%'}
                            </span>
                          </td>
                          <td>
                            <button
                              aria-label={`Xem chi tiết tuân thủ của ${item.employeeName}`}
                              className="evd-btn-text admin-table-action admin-table-action--icon admin-table-action--primary"
                              onClick={() => {
                                const params = new URLSearchParams()
                                params.set('from', fromDate)
                                params.set('to', toDate)
                                navigate(
                                  isAdmin
                                    ? `/admin/evaluation/compliance-by-technique/${item.employeeId}?${params.toString()}`
                                    : `/manager/compliance-by-technique/${item.employeeId}?${params.toString()}`
                                )
                              }}
                              title="Xem chi tiết"
                              type="button"
                            >
                              <EyeOutlined />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
    </AppShell>
  )
}

export default ComplianceByTechniquePage
