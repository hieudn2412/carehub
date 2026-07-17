import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SearchOutlined,
  EyeOutlined,
  WarningFilled,
  CheckCircleFilled,
  ExclamationCircleFilled,
  ReloadOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import Sidebar from '../../staff/components/sidebar'
import Header from '../../staff/components/Header'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../utils/documentQuestionUi.js'
import { tokenStorage } from '../../../features/auth/services/tokenStorage.js'
import { getRolesFromAccessToken } from '../../../features/auth/utils/jwt.js'
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
  const [forms, setForms] = useState([])

  const [departmentId, setDepartmentId] = useState('')
  const [formId, setFormId] = useState('')
  const [fromDate, setFromDate] = useState(`${new Date().getFullYear()}-01-01`)
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10))

  const dashboardPath = isAdmin ? '/admin/dashboard' : '/manager/dashboard'

  useEffect(() => {
    adminApi.getDepartments().then(res => {
      const depts = apiData(res, [])
      setDepartments(depts)
    }).catch(() => {})

    loadFormList()
  }, [])

  const loadFormList = async () => {
    try {
      const formListResponse = await import('../api/questionCategoryApi.js')
      const fRes = await formListResponse.questionCategoryApi.getAllCategories()
      const categories = apiData(fRes, [])
      setForms(categories.map(c => ({ id: c.id, title: c.name || c.categoryName })))
    } catch {
      try {
        const resp = await competencyApi.getByTechnique(departmentId || 1, formId || null, fromDate, toDate)
        const d = apiData(resp, null)
        if (d && d.items) {
          const uniqueForms = []
          d.items.forEach(i => {
            if (i.formId && i.formName && !uniqueForms.find(f => f.id === i.formId)) {
              uniqueForms.push({ id: i.formId, title: i.formName })
            }
          })
          setForms(uniqueForms)
        }
      } catch {}
    }
  }

  const loadData = useCallback(async () => {
    if (!departmentId) {
      showToast('Vui lòng chọn khoa/phòng', 'warning')
      return
    }
    setLoading(true)
    try {
      const response = await competencyApi.getByTechnique(departmentId, formId || null, fromDate, toDate)
      setData(apiData(response, null))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [departmentId, formId, fromDate, toDate, showToast])

  useEffect(() => {
    if (departmentId) loadData()
  }, [departmentId, formId, fromDate, toDate])

  const breadcrumbs = [
    { label: 'Dashboard', link: dashboardPath },
    { label: 'Đánh giá' },
    { label: 'Tuân thủ kỹ thuật' },
  ]

  const Layout = isAdmin ? AdminSidebar : Sidebar
  const PageHeader = isAdmin ? AdminHeader : Header

  const complianceTarget = data?.complianceTarget || 80.0
  const belowCount = data?.items ? data.items.filter(i => i.belowTarget).length : 0
  const totalCount = data?.items ? data.items.length : 0

  return (
    <div className="dashboard-layout">
      <Layout />
      <div className="dashboard-layout__content">
        <PageHeader breadcrumbs={isAdmin ? breadcrumbs : undefined} title={isManager ? 'Tuân thủ kỹ thuật' : undefined} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="evd-page">
              <section className="evd-title-card">
                <div>
                  <h1>Tuân thủ kỹ thuật</h1>
                  <p>Đánh giá tuân thủ quy trình kỹ thuật của Điều dưỡng</p>
                </div>
                <button className="evd-btn" onClick={loadData} disabled={loading}>
                  <ReloadOutlined /> Tải lại
                </button>
              </section>

              <section className="evd-filter-bar" style={{
                display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
                marginBottom: 16, padding: '12px 16px', background: '#f9fafb', borderRadius: 8,
              }}>
                {isAdmin && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Khoa/phòng</label>
                    <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, minWidth: 180 }}>
                      <option value="">-- Chọn khoa --</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Kỹ thuật</label>
                  <select value={formId} onChange={(e) => setFormId(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, minWidth: 200 }}>
                    <option value="">-- Tất cả kỹ thuật --</option>
                    {forms.map(f => (
                      <option key={f.id} value={f.id}>{f.title}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Từ ngày</label>
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Đến ngày</label>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }} />
                </div>
              </section>

              {data && (
                <section className="evd-panel" style={{
                  padding: 16, marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap',
                }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>
                    Mục tiêu tuân thủ: <span style={{ color: '#2563eb' }}>{complianceTarget}%</span>
                  </div>
                  {totalCount > 0 && (
                    <div style={{ fontSize: 14, color: '#6b7280' }}>
                      {totalCount} Điều dưỡng —{' '}
                      <span style={{ color: belowCount > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                        {belowCount} dưới mục tiêu
                      </span>
                    </div>
                  )}
                  {totalCount === 0 && data && (
                    <div style={{ fontSize: 14, color: '#9ca3af' }}>
                      Chưa có dữ liệu tuân thủ kỹ thuật trong khoảng thời gian đã chọn.
                    </div>
                  )}
                </section>
              )}

              {!departmentId && isAdmin && !data && (
                <div className="evd-card" style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                  <SearchOutlined style={{ fontSize: 48, marginBottom: 16, display: 'block' }} />
                  Vui lòng chọn khoa/phòng và kỹ thuật để xem phân tích tuân thủ.
                </div>
              )}

              <div className="evd-card" style={{ overflow: 'auto' }}>
                <table className="evd-table">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Mã NV</th>
                      <th>Họ tên</th>
                      {isAdmin && <th>Khoa</th>}
                      <th>Số lần ĐG</th>
                      <th>Điểm TB</th>
                      <th>Tỷ lệ đạt</th>
                      <th>Mục tiêu</th>
                      <th>Phân loại</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={isAdmin ? 10 : 9} style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                          Đang tải dữ liệu...
                        </td>
                      </tr>
                    ) : !data || !data.items || data.items.length === 0 ? (
                      <tr>
                        <td colSpan={isAdmin ? 10 : 9} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                          {!departmentId ? 'Vui lòng chọn khoa/phòng.' : 'Chưa có dữ liệu tuân thủ kỹ thuật.'}
                        </td>
                      </tr>
                    ) : (
                      data.items.map((item, idx) => (
                        <tr key={idx} className={item.belowTarget ? 'evd-row--danger' : (!item.isPassed ? 'evd-row--warning' : '')}>
                          <td>{idx + 1}</td>
                          <td><code style={{ fontSize: 12 }}>{item.employeeCode}</code></td>
                          <td style={{ fontWeight: 500 }}>{item.employeeName}</td>
                          {isAdmin && <td style={{ color: '#6b7280' }}>{item.departmentName || '—'}</td>}
                          <td>{item.evaluationCount}</td>
                          <td>{formatNumber(item.averageScore)}</td>
                          <td>
                            <span style={{ color: (item.passRate || 0) < complianceTarget ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                              {item.passRate != null ? `${item.passRate}%` : '—'}
                            </span>
                          </td>
                          <td>
                            {item.belowTarget ? (
                              <span style={{ color: '#dc2626', fontSize: 12 }}>
                                <ExclamationCircleFilled style={{ marginRight: 4 }} />
                                {'<'} {complianceTarget}%
                              </span>
                            ) : (
                              <span style={{ color: '#16a34a', fontSize: 12 }}>
                                <CheckCircleFilled style={{ marginRight: 4 }} />Đạt
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="evd-badge" style={{
                              backgroundColor: (item.colorHex || '#6b7280') + '20',
                              color: item.colorHex || '#6b7280',
                            }}>
                              {item.isPassed ? <CheckCircleFilled style={{ marginRight: 4 }} /> : <WarningFilled style={{ marginRight: 4 }} />}
                              {item.competencyLabel || '—'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="evd-btn-text"
                              onClick={() => navigate(
                                isAdmin
                                  ? `/admin/evaluation/compliance-by-technique/${item.employeeId}`
                                  : `/manager/compliance-by-technique/${item.employeeId}`
                              )}
                              style={{ padding: '4px 10px', fontSize: 13 }}
                            >
                              <EyeOutlined style={{ marginRight: 4 }} />Xem
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
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

export default ComplianceByTechniquePage
