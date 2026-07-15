import { useState, useEffect, useCallback } from 'react'
import { ReloadOutlined, TeamOutlined, BarChartOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../utils/documentQuestionUi.js'
import '../styles/EvaluationDashboardPage.css'

function CompetencyDepartmentPage() {
  const { showToast } = useToast()
  const [departments, setDepartments] = useState([])
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deptLoading, setDeptLoading] = useState(false)

  const loadDepartments = useCallback(async () => {
    try {
      const response = await adminApi.getDepartments()
      const depts = apiData(response, [])
      setDepartments(depts)
      if (depts.length > 0 && !selectedDeptId) {
        setSelectedDeptId(String(depts[0].id))
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }, [showToast, selectedDeptId])

  const loadDepartmentData = useCallback(async (deptId) => {
    if (!deptId) return
    setDeptLoading(true)
    try {
      const response = await competencyApi.getDepartmentClassification(deptId)
      setData(apiData(response, null))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setDeptLoading(false)
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadDepartments() }, [])
  useEffect(() => { if (selectedDeptId) loadDepartmentData(selectedDeptId) }, [selectedDeptId])

  const handleDeptChange = (e) => {
    setSelectedDeptId(e.target.value)
  }

  const breadcrumbs = [{ label: 'Đánh giá' }, { label: 'Phân loại năng lực theo khoa' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="evd-page">
              <section className="evd-title-card">
                <div>
                  <h1>Phân loại năng lực theo khoa</h1>
                  <p>Xem tổng quan năng lực nhân viên theo từng khoa/phòng</p>
                </div>
                <button type="button" className="evd-btn" onClick={() => loadDepartmentData(selectedDeptId)} disabled={deptLoading}>
                  <ReloadOutlined /> Tải lại
                </button>
              </section>

              {/* Department selector */}
              <section className="evd-panel" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <label style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>
                    <TeamOutlined style={{ marginRight: 6 }} />Chọn khoa/phòng:
                  </label>
                  <select
                    value={selectedDeptId}
                    onChange={handleDeptChange}
                    style={{
                      padding: '8px 14px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      fontSize: 14,
                      minWidth: 200,
                      background: '#fff',
                    }}
                  >
                    {departments.map(d => (
                      <option key={d.id} value={String(d.id)}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </section>

              {loading || deptLoading ? (
                <section className="evd-panel evd-empty">Đang tải dữ liệu...</section>
              ) : !data ? (
                <section className="evd-panel evd-empty">Chưa có dữ liệu cho khoa này.</section>
              ) : (
                <>
                  {/* Summary */}
                  <section className="evd-metric-grid">
                    <div className="evd-metric evd-metric--neutral">
                      <div className="evd-metric-icon"><TeamOutlined /></div>
                      <div>
                        <span>Tổng nhân viên</span>
                        <strong>{formatNumber(data.totalEmployees)}</strong>
                      </div>
                    </div>
                    <div className="evd-metric evd-metric--info">
                      <div className="evd-metric-icon"><BarChartOutlined /></div>
                      <div>
                        <span>Đã phân loại</span>
                        <strong>{formatNumber(data.classifiedEmployees)}</strong>
                      </div>
                    </div>
                  </section>

                  {/* Distribution */}
                  <section className="evd-panel">
                    <div className="evd-section-head">
                      <h2>Phân bố năng lực — {data.departmentName}</h2>
                    </div>
                    <div className="evd-bars">
                      {(data.levelDistribution || []).map((item) => (
                        <div key={item.level} className="evd-bar-row">
                          <span style={{
                            color: item.levelColor,
                            fontWeight: 600,
                          }}>
                            {item.levelText || item.level}
                          </span>
                          <div className="evd-bar-track">
                            <div style={{
                              width: `${data.totalEmployees > 0 ? (item.count / data.totalEmployees) * 100 : 0}%`,
                              background: item.levelColor,
                              height: 8,
                              borderRadius: 4,
                              transition: 'width 0.3s',
                            }} />
                          </div>
                          <strong>{formatNumber(item.count)}</strong>
                        </div>
                      ))}
                      {(data.levelDistribution || []).length === 0 && (
                        <div className="evd-empty">Chưa có dữ liệu phân bố.</div>
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default CompetencyDepartmentPage
