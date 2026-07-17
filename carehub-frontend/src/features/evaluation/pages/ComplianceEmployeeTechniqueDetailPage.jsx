import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  WarningFilled,
  CheckCircleFilled,
  ReloadOutlined,
  ExclamationCircleFilled,
  CloseCircleFilled,
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
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = roles.some(r => String(r).toUpperCase().includes('ADMIN'))

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedRow, setExpandedRow] = useState(null)

  const fromDate = searchParams.get('from') || `${new Date().getFullYear()}-01-01`
  const toDate = searchParams.get('to') || new Date().toISOString().slice(0, 10)

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
  }, [employeeId, fromDate, toDate, showToast])

  useEffect(() => { loadData() }, [loadData])

  const breadcrumbs = [
    { label: 'Dashboard', link: dashboardPath },
    { label: 'Tuân thủ kỹ thuật', link: backPath },
    { label: data?.employeeName || 'Chi tiết' },
  ]

  const Layout = isAdmin ? AdminSidebar : Sidebar
  const PageHeader = isAdmin ? AdminHeader : Header

  const complianceTarget = data?.complianceTarget || 80.0
  const belowTargetItems = data?.items ? data.items.filter(i => i.belowTarget).length : 0
  const totalItems = data?.items ? data.items.length : 0

  const toggleExpand = (idx) => {
    setExpandedRow(expandedRow === idx ? null : idx)
  }

  const formatDateTime = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('vi-VN')
  }

  const handleBack = () => {
    const params = new URLSearchParams()
    params.set('from', fromDate)
    params.set('to', toDate)
    navigate(`${backPath}?${params.toString()}`)
  }

  const avatarLetter = data?.employeeName
    ? data.employeeName.trim().split(' ').pop().charAt(0).toUpperCase()
    : '?'

  const overallAvg = data?.overallAverageScore ?? null

  const hasData = data && data.items && data.items.length > 0

  return (
    <div className="dashboard-layout">
      <Layout />
      <div className="dashboard-layout__content">
        <PageHeader breadcrumbs={isAdmin ? breadcrumbs : undefined} title={!isAdmin ? `Tuân thủ KT: ${data?.employeeName || '...'}` : undefined} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="evd-page">

              <div style={{ marginBottom: 16 }}>
                <button className="evd-btn-text" onClick={handleBack} style={{ fontSize: 14, padding: '8px 0' }}>
                  <ArrowLeftOutlined style={{ marginRight: 6 }} />Quay lại danh sách
                </button>
              </div>

              {!loading && data && (
                <section className="evd-title-card" style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  padding: 20,
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: '#fff', fontSize: 22, fontWeight: 700,
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                  }}>
                    {avatarLetter}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>
                      {data.employeeName || '—'}
                    </h1>
                    <p style={{ margin: '4px 0 8px 0', fontSize: 13, color: '#6b7280' }}>
                      Mã NV: {data.employeeCode || '—'}
                      {data.departmentName ? ` · ${data.departmentName}` : ''}
                    </p>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', fontSize: 14 }}>
                      <div>
                        <span style={{ color: '#6b7280' }}>Điểm TB kỹ năng: </span>
                        <strong style={{ color: '#111827' }}>
                          {overallAvg != null ? formatNumber(overallAvg) : '—'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280' }}>Mục tiêu khoa: </span>
                        <strong style={{ color: '#2563eb' }}>{complianceTarget}%</strong>
                      </div>
                      {totalItems > 0 && belowTargetItems > 0 && (
                        <div>
                          <span style={{
                            color: '#dc2626', fontSize: 13, fontWeight: 600,
                            background: '#fef2f2', padding: '4px 10px', borderRadius: 6,
                          }}>
                            <ExclamationCircleFilled style={{ marginRight: 4 }} />
                            {belowTargetItems}/{totalItems} kỹ thuật dưới mục tiêu
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button className="evd-btn" onClick={loadData} disabled={loading} style={{ flexShrink: 0 }}>
                    <ReloadOutlined /> Tải lại
                  </button>
                </section>
              )}

              <div className="evd-card" style={{ overflow: 'auto', marginTop: 16 }}>
                <table className="evd-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Kỹ thuật</th>
                      <th>Số lần ĐG</th>
                      <th>Điểm TB</th>
                      <th>Đạt/Không đạt</th>
                      <th>Tỷ lệ</th>
                      <th>Phân loại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                          Đang tải dữ liệu...
                        </td>
                      </tr>
                    ) : !hasData ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                          Chưa có dữ liệu giám sát kỹ năng thực hành
                        </td>
                      </tr>
                    ) : (
                      data.items.map((item, idx) => (
                        <>
                          <tr
                            key={idx}
                            className={item.belowTarget ? 'evd-row--danger' : (!item.isPassed ? 'evd-row--warning' : '')}
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
                            <td style={{ fontWeight: 500 }}>{item.formName || '—'}</td>
                            <td>{item.evaluationCount}</td>
                            <td>{formatNumber(item.averageScore)}</td>
                            <td>
                              <span style={{ fontWeight: 600, fontSize: 13 }}>
                                {item.passCount ?? 0}/{item.evaluationCount ?? 0}
                              </span>
                            </td>
                            <td>
                              <span style={{
                                color: item.belowTarget ? '#dc2626' : '#16a34a',
                                fontWeight: 600,
                              }}>
                                {item.passRate != null ? `${item.passRate}%` : '—'}
                              </span>
                            </td>
                            <td>
                              <span className="evd-badge" style={{
                                backgroundColor: (item.colorHex || '#6b7280') + '20',
                                color: item.colorHex || '#6b7280',
                              }}>
                                {item.isPassed
                                  ? <CheckCircleFilled style={{ marginRight: 4 }} />
                                  : item.belowTarget
                                    ? <CloseCircleFilled style={{ marginRight: 4 }} />
                                    : <WarningFilled style={{ marginRight: 4 }} />}
                                {item.competencyLabel || '—'}
                              </span>
                            </td>
                          </tr>
                          {expandedRow === idx && item.attempts && item.attempts.length > 0 && (
                            <tr key={`exp-${idx}`} className="evd-expand-row">
                              <td colSpan={7} style={{ padding: 0, background: '#f9fafb' }}>
                                <div style={{ padding: '12px 24px 12px 60px' }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                                    Lịch sử giám sát — {item.formName}
                                  </div>
                                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr>
                                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Ngày ĐG</th>
                                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Người ĐG</th>
                                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Bảng kiểm</th>
                                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>Điểm</th>
                                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>Kết quả</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.attempts.map((att, aIdx) => (
                                        <tr key={aIdx}>
                                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{formatDate(att.evaluatedAt)}</td>
                                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{att.evaluatedBy || '—'}</td>
                                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', color: '#6b7280', fontSize: 12 }}>{att.formName || '—'}</td>
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
