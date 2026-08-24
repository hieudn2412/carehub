import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  ReloadOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../utils/documentQuestionUi.js'
import { tokenStorage } from '../../../shared/auth/tokenStorage.js'
import { getRolesFromAccessToken } from '../../../shared/auth/jwt.js'
import '../styles/EvaluationDashboardPage.css'
import PassFailBadge from '../../../shared/components/PassFailBadge.jsx'

function CompetencyEmployeeFieldDetailPage() {
  const { employeeId } = useParams()
  const { showToast } = useToast()

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = roles.some(r => String(r).toUpperCase().includes('ADMIN'))
  const isManager = roles.some(r => String(r).toUpperCase().includes('MANAGER'))

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedRow, setExpandedRow] = useState(null)

  const fromDate = `${new Date().getFullYear()}-01-01`
  const toDate = new Date().toISOString().slice(0, 10)

  const dashboardPath = isAdmin ? '/admin/dashboard' : '/manager/dashboard'
  const backPath = isAdmin ? '/admin/evaluation/competency-by-field' : '/manager/competency-by-field'

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await competencyApi.getEmployeeByField(employeeId, { fromDate, toDate })
      setData(apiData(response, null))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [employeeId, fromDate, showToast, toDate])

  useEffect(() => { loadData() }, [loadData])

  const breadcrumbs = [
    { label: 'Dashboard', link: dashboardPath },
    { label: 'Năng lực theo lĩnh vực', link: backPath },
    { label: data?.employeeName || 'Chi tiết' },
  ]

  const overallAvg = data?.items?.length
    ? Math.round(data.items.reduce((s, i) => s + (i.averageScore || 0), 0) / data.items.length)
    : null

  const toggleExpand = (idx) => {
    setExpandedRow(expandedRow === idx ? null : idx)
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('vi-VN')
  }

  return (
    <AppShell
      back={{ to: backPath, label: 'Quay lại' }}
      breadcrumbs={isAdmin ? breadcrumbs : undefined}
      title={isManager ? `Năng lực: ${data?.employeeName || '...'}` : undefined}
    >
            <div className="evd-page">
              <section className="evd-detail-summary">
                <div className="evd-detail-summary__identity">
                  <strong>{data?.employeeName || 'Đang tải...'}</strong>
                  <span>Mã NV: {data?.employeeCode || '—'}</span>
                </div>
                <div className="evd-detail-summary__metrics">
                  <span>Điểm trung bình <strong>{overallAvg}</strong></span>
                  <span>{data?.items?.length || 0} lĩnh vực có dữ liệu</span>
                </div>
                <button className="evd-btn" onClick={loadData} disabled={loading}>
                  <ReloadOutlined aria-hidden="true" /> Tải lại
                </button>
              </section>

              <div className="evd-card evd-x-table-card">
                <table className="evd-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Lĩnh vực</th>
                      <th>Số lần thi</th>
                      <th>Điểm TB</th>
                      <th>Tỷ lệ đạt</th>
                      <th>Phân loại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="ch-empty">
                          Đang tải dữ liệu...
                        </td>
                      </tr>
                    ) : !data || !data.items || data.items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="ch-empty">
                          Chưa có dữ liệu kiểm tra cho nhân viên này.
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
                            <td>{item.categoryName || 'Chung'}</td>
                            <td>{item.attemptCount}</td>
                            <td>{formatNumber(item.averageScore)}</td>
                            <td>
                              <span style={{ color: (item.passRate || 0) < 50 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                                {item.passRate != null ? `${item.passRate}%` : '—'}
                              </span>
                            </td>
                            <td>
                              <PassFailBadge passed={item.isPassed} />
                            </td>
                          </tr>
                          {expandedRow === idx && item.attempts && item.attempts.length > 0 && (
                            <tr key={`exp-${idx}`} className="evd-expand-row">
                              <td colSpan={6} style={{ padding: 0, background: '#f9fafb' }}>
                                <div style={{ padding: '12px 24px 12px 60px' }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                                    Lịch sử thi — {item.categoryName}
                                  </div>
                                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr>
                                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Ngày thi</th>
                                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Đề thi</th>
                                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>Điểm</th>
                                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>Đúng/Tổng</th>
                                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>Kết quả</th>
                                        <th style={{ padding: '6px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>Phân loại</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {item.attempts.map((att, aIdx) => (
                                        <tr key={aIdx}>
                                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{formatDate(att.attemptDate)}</td>
                                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{att.examPaperTitle || '—'}</td>
                                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', fontWeight: 600 }}>{att.score != null ? String(att.score) : '—'}</td>
                                          <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'center', color: '#6b7280' }}>
                                            {att.correctCount != null && att.totalQuestions != null ? `${att.correctCount}/${att.totalQuestions}` : '—'}
                                          </td>
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
                                            <PassFailBadge passed={att.passed} className="evd-badge" />
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
    </AppShell>
  )
}

export default CompetencyEmployeeFieldDetailPage
