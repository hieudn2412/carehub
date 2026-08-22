import { useState, useEffect, useCallback } from 'react'
import { ReloadOutlined, TeamOutlined, BarChartOutlined } from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../utils/documentQuestionUi.js'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
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
      if (depts.length > 0) setSelectedDeptId((current) => current || String(depts[0].id))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    }
  }, [showToast])

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

  useEffect(() => {

    loadDepartments()
  }, [loadDepartments])
  useEffect(() => {
    if (selectedDeptId) {

      loadDepartmentData(selectedDeptId)
    }
  }, [selectedDeptId, loadDepartmentData])

  const breadcrumbs = [{ label: 'Đánh giá' }, { label: 'Phân loại năng lực theo khoa' }]

  return (
    <AppShell breadcrumbs={breadcrumbs}>
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
        <section className="evd-panel evd-department-picker">
          <FilterSelectField
            id="competency-department"
            label="Chọn khoa/phòng"
            icon={<TeamOutlined />}
            value={selectedDeptId}
            onChange={setSelectedDeptId}
            options={departments.map((department) => ({ value: department.id, label: department.name }))}
            placeholder="Chọn khoa/phòng"
            searchable
            searchPlaceholder="Tìm theo tên khoa/phòng..."
            disabled={loading && departments.length === 0}
            helpText="Chọn một khoa/phòng để xem phân bố năng lực hiện tại."
          />
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
              <div className="evd-metric evd-metric--warning">
                <div className="evd-metric-icon"><BarChartOutlined /></div>
                <div>
                  <span>Chưa phân loại</span>
                  <strong>{formatNumber(Math.max(0, Number(data.totalEmployees || 0) - Number(data.classifiedEmployees || 0)))}</strong>
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
                    <span className="evd-bar-label" style={{ '--bar-color': item.levelColor }}>
                      {item.levelText || item.level}
                    </span>
                    <div className="evd-bar-track">
                      <div className="evd-bar-fill" style={{ '--bar-width': `${data.totalEmployees > 0 ? (item.count / data.totalEmployees) * 100 : 0}%`, '--bar-color': item.levelColor }} />
                    </div>
                    <strong>{formatNumber(item.count)} ({data.totalEmployees > 0 ? Math.round((item.count / data.totalEmployees) * 100) : 0}%)</strong>
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
    </AppShell>
  )
}

export default CompetencyDepartmentPage
