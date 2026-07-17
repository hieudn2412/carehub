import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  WarningFilled,
  CheckCircleFilled,
  ReloadOutlined,
  ExclamationCircleFilled,
} from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import Sidebar from '../../staff/components/sidebar'
import Header from '../../staff/components/Header'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../utils/documentQuestionUi.js'
import { tokenStorage } from '../../../features/auth/services/tokenStorage.js'
import { getRolesFromAccessToken } from '../../../features/auth/utils/jwt.js'
import '../styles/EvaluationDashboardPage.css'

function ComplianceEmployeeTechniqueDetailPage() {
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = roles.some(r => String(r).toUpperCase().includes('ADMIN'))

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedRow, setExpandedRow] = useState(null)

  const fromDate = `${new Date().getFullYear()}-01-01`
  const toDate = new Date().toISOString().slice(0, 10)

  const dashboardPath = isAdmin ? '/admin/dashboard' : '/manager/dashboard'
  const backPath = isAdmin ? '/admin/evaluation/compliance-by-technique' : '/manager/compliance-by-technique'

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await competencyApi.getEmployeeByTechnique(employeeId, { fromDate, toDate })
      setData(apiData(response, null))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [employeeId, showToast])

  useEffect(() => { loadData() }, [loadData])

  const breadcrumbs = [
    { label: 'Dashboard', link: dashboardPath },
    { label: 'Tuân thủ kỹ thuật', link: backPath },
    { label: data?.employeeName || 'Chi tiết' },
  ]

  const Layout = isAdmin ? AdminSidebar : Sidebar
  const PageHeader = isAdmin ? AdminHeader : Header

  const overallAvg = data?.items?.length
    ? Math.round(data.items.reduce((s, i) => s + (i.averageScore || 0), 0) / data.items.length)
    : null

  const toggleExpand = (idx) => {
    setExpandedRow(expandedRow === idx ? null : idx)
  }

  const formatDateTime = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleString('vi-VN')
  }

  return (
    <div className="dashboard-layout">
      <Layout />
      <div className="dashboard-layout__content">
        <PageHeader breadcrumbs={isAdmin ? breadcrumbs : undefined} title={!isAdmin ? `Tuân thủ KT: ${data?.employeeName || '...'}` : undefined} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="evd-page">
              <div style={{ marginBottom: 16 }}>
                <button className="evd-btn-text" onClick={() => navigate(backPath)} style={{ fontSize: 14, padding: '8px 0' }}>
                  <ArrowLeftOutlined style={{ marginRight: 6 }} />Quay lại danh sách
                </button>
              </div>

              <section className="evd-title-card">
                <div>
                  <h1>Tuân thủ kỹ thuật: {data?.employeeName || '...'}</h1>
                  <p>Mã NV: {data?.employeeCode || '—'}</p>
                </div>
                <button className="evd-btn" onClick={loadData} disabled={loading}>
                  <ReloadOutlined /> Tải lại
                </button>
              </section>

              {data && data.items && data.items.length > 0 && (
                <section className="evd-panel" style={{ padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 14, color: '#374151' }}>
                    Điểm TB tổng: <strong>{overallAvg}</strong> — Dữ liệu từ {data.fromDate} đến {data.toDate}
                  </div>
                </section>
              )}

              <div className="evd-card" style={{ overflow: 'auto' }}>
                <table className="evd-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Kỹ thuật</th>
                      <th>Số lần ĐG</th>
                      <th>Điểm TB</th>
                      <th>Tỷ lệ đạt</th>
                      <th>Phân loại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                          Đang tải dữ liệu...
                        </td>
                      </tr>
                    ) : !data || !data.items || data.items.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                          Chưa có dữ liệu giám sát tuân thủ kỹ thuật cho nhân viên này.
                        </td>
                      </tr>
                    ) : (
                      data.items.map((item, idx) => (
                        <>
                          <tr
                            key={idx}
                            className={!item.isPassed ? 'evd-row--danger' : ''}
                            style={{ cursor: (item.attempts && item.attempts.length > 0) ? 'pointer' : 'default' }}
                            onClick={() => (item.attempts && item.attempts.length > 0) && toggleExpand(idx)}
                          >
                            <td style={{ textAlign: 'center' }}>
                              {item.attempts && item.attempts.length > 0 && (
                                <span style={{
                                  display: 'inline-block',
                                  transition: 'transform 0.2s',
                                  transform: expandedRow === idx ? 'rotate(90deg)' : 'rotate(0deg)',
                                  fontSize: 12,
                                  color: '#6b7280',
                                }}>▶</span>
                              )}
                            </td>
                            <td>{item.formName || '—'}</td>
                            <td>{item.evaluationCount}</td>
                            <td>{formatNumber(item.averageScore)}</td>
                            <td>
                              <span style={{ color: (item.passRate || 0) < 50 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                                {item.passRate != null ? `${item.passRate}%` : '—'}
                              </span>
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
                          </tr>
                          {expandedRow === idx && item.attempts && item.attempts.length > 0 && (
                            <tr key={`exp-${idx}`} className="evd-expand-row">
                              <td colSpan={6} style={{ padding: 0, background: '#f9fafb' }}>
                                <div style={{ padding: '12px 24px 12px 60px' }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                                    Lịch sử giám sát — {item.formName}
                                  </div>
                                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr>
                                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Thời gian</th>
                                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>Điểm</th>
                                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>Kết quả</th>
                                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>Phân loại</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.attempts.map((att, aIdx) => (
                                        <tr key={aIdx}>
                                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{formatDateTime(att.evaluatedAt)}</td>
                                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', fontWeight: 600 }}>{att.score != null ? String(att.score) : '—'}</td>
                                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                                            <span style={{
                                              color: att.passed ? '#16a34a' : '#dc2626',
                                              fontWeight: 600,
                                              fontSize: 12,
                                            }}>
                                              {att.passed ? 'Đạt' : 'Không đạt'}
                                            </span>
                                          </td>
                                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                                            {att.competencyLabel ? (
                                              <span style={{
                                                backgroundColor: (att.colorHex || '#6b7280') + '20',
                                                color: att.colorHex || '#6b7280',
                                                padding: '2px 8px',
                                                borderRadius: 4,
                                                fontSize: 12,
                                                fontWeight: 500,
                                              }}>
                                                {att.competencyLabel}
                                              </span>
                                            ) : '—'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
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

export default ComplianceEmployeeTechniqueDetailPage
