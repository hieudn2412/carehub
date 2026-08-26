import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ProgressRing from '../../../shared/components/ProgressRing.jsx'
import ChartConfigPanel from '../components/ChartConfigPanel.jsx'
import AppShell from '../../../shared/components/AppShell.jsx'
import AppliedFilterToolbar from '../../../shared/components/AppliedFilterToolbar.jsx'
import KeyboardDatePicker from '../../../shared/components/KeyboardDatePicker.jsx'
import { staffApi } from '../../staff/api/staffApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import DepartmentTrainingStaffTable from '../../training/components/DepartmentTrainingStaffTable.jsx'
import { wrapChartLabel } from '../utils/chartLabel.js'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import '../styles/TrainingDashboardPage.css'

const PAGE_SIZE = 100
const today = new Date().toISOString().slice(0, 10)

function responsePayload(response) {
  return response?.data?.data || {}
}

async function fetchAll(baseParams) {
  const firstResponse = await trainingApi.getEmployeeTrainingStatuses({
    ...baseParams,
    page: 0,
    size: PAGE_SIZE,
  })
  const firstPage = responsePayload(firstResponse)
  const content = Array.isArray(firstPage.content) ? firstPage.content : []
  const totalPages = Number(firstPage.totalPages) || 1

  if (totalPages <= 1) return content

  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => (
      trainingApi.getEmployeeTrainingStatuses({
        ...baseParams,
        page: index + 1,
        size: PAGE_SIZE,
      })
    )),
  )

  return [
    ...content,
    ...remaining.flatMap((response) => responsePayload(response).content || []),
  ]
}

function normalizeEmployee(item) {
  return {
    id: item.employeeId,
    code: item.employeeCode || '',
    name: item.employeeName || '',
    departmentName: item.departmentName || 'Chưa xác định',
    positionName: item.positionName || item.jobPositionName || '',
    requiredHours: Number(item.requiredHours) || 0,
    completedHours: Number(item.submittedHours) || 0,
    missingHours: Number(item.remainingHours) || 0,
    complianceStatus: item.complianceStatus === 'COMPLIANT' ? 'COMPLIANT' : 'NON_COMPLIANT',
  }
}

function escapeCsv(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function exportCsv(rows) {
  const headers = ['Mã nhân viên', 'Họ tên', 'Khoa/Phòng', 'Chức danh', 'Giờ hoàn thành', 'Mục tiêu', 'Còn thiếu', 'Trạng thái']
  const lines = rows.map((row) => [
    row.code,
    row.name,
    row.departmentName,
    row.positionName,
    row.completedHours,
    row.requiredHours,
    row.missingHours,
    {
      COMPLIANT: 'Đạt',
      NON_COMPLIANT: 'Chưa đạt',
    }[row.complianceStatus] || row.complianceStatus,
  ].map(escapeCsv).join(','))
  const csvContent = [headers.map(escapeCsv).join(','), ...lines].join('\n')
  const blob = new Blob([String.fromCharCode(0xfeff), csvContent], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `gio-dao-tao-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/* Tên khoa / lĩnh vực / hình thức đào tạo đều là chuỗi tiếng Việt dài, còn thẻ biểu đồ chỉ
   rộng nửa màn hình. Xoay nhãn thôi không đủ: 12 nhãn nghiêng 22° chồng hẳn lên nhau. Ba việc
   dưới đây xử lý triệt để — ngắt nhãn tối đa 2 dòng, xoay dốc 60°, và cấp cho mỗi cột một bề
   ngang tối thiểu. Nhãn rộng nhất đo được là 55px nên 66px cho mỗi cột là đủ hở; khi thẻ hẹp
   hơn tổng bề ngang đó thì biểu đồ cuộn ngang thay vì ép nhãn đè nhau. Tên đầy đủ vẫn đọc
   được ở tooltip và ở title của tick. */
const CHART_CATEGORY_WIDTH = 66
const CHART_LABEL_ANGLE = -60

function CategoryTick({ x, y, payload }) {
  const lines = wrapChartLabel(payload?.value)
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        fill="#64748b"
        fontSize={11}
        textAnchor="end"
        transform={`rotate(${CHART_LABEL_ANGLE})`}
      >
        <title>{payload?.value}</title>
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? 12 : 13}>{line}</tspan>
        ))}
      </text>
    </g>
  )
}

/** Khung cuộn ngang giữ cho mỗi cột luôn có đủ bề ngang cho nhãn của nó. */
function ChartCanvas({ count, height = 340, children }) {
  return (
    <div className="training-chart-card__scroll">
      <div
        className="training-chart-card__canvas"
        style={{ height, minWidth: Math.max(320, count * CHART_CATEGORY_WIDTH) }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* Chiều cao dành cho nhãn nằm ở XAxis height; margin.bottom chỉ chừa mép, nếu đặt cả hai
   thì khoảng trống bị tính hai lần và vùng vẽ cột bị bóp lại. */
const CHART_MARGIN = { top: 24, right: 12, left: 0, bottom: 4 }
const CHART_AXIS_HEIGHT = 92

function MetricCard({ icon, label, value, detail, tone, progress }) {
  return (
    <article className={`training-kpi training-kpi--${tone}`}>
      <span className="training-kpi__icon">{icon}</span>
      <div className="training-kpi__content">
        <p>{label}</p>
        <div className="training-kpi__metrics">
          <div>
            <strong>{value}</strong>
            <small>{detail}</small>
          </div>
          {progress != null && (
            <ProgressRing
              progress={progress}
              size={48}
              color={tone === 'green' ? '#10a77d' : tone === 'red' ? '#ef4444' : '#0284c7'}
            />
          )}
        </div>
      </div>
    </article>
  )
}

function DashboardContent({ role }) {
  const isManager = role === 'manager'
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [departments, setDepartments] = useState([])
  const [professionalFields, setProfessionalFields] = useState([])
  const [filters, setFilters] = useState({
    keyword: '',
    departmentId: '',
    professionalFieldId: '',
    asOf: today,
    status: '',
  })
  const [appliedFilters, setAppliedFilters] = useState({
    keyword: '',
    departmentId: '',
    professionalFieldId: '',
    asOf: today,
    status: '',
  })
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [error, setError] = useState('')
  const [fieldSort, setFieldSort] = useState('desc')
  const [fieldLimit, setFieldLimit] = useState('12')
  const [typeSort, setTypeSort] = useState('desc')
  const [typeLimit, setTypeLimit] = useState('12')
  const [deptSort, setDeptSort] = useState('desc')
  const [deptLimit, setDeptLimit] = useState('12')

  const managerDepartmentId = profile?.departmentId || ''
  const effectiveFilters = appliedFilters
  const activeFilterCount = [
    !isManager && effectiveFilters.departmentId,
    effectiveFilters.professionalFieldId,
    effectiveFilters.asOf && effectiveFilters.asOf !== today,
    effectiveFilters.status,
  ].filter(Boolean).length

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      isManager ? staffApi.getProfile() : trainingApi.getDepartments(),
      trainingApi.getRecordOptions(),
    ]).then(([scopeResult, optionsResult]) => {
      if (cancelled) return
      if (scopeResult.status === 'fulfilled') {
        if (isManager) {
          const managerProfile = responsePayload(scopeResult.value)
          setProfile(managerProfile)
          if (!managerProfile?.departmentId) {
            setError('Tài khoản Quản lý cấp Khoa chưa được gán khoa/phòng nên không thể xem dashboard.')
            setLoading(false)
          }
        }
        else {
          const data = responsePayload(scopeResult.value)
          setDepartments(Array.isArray(data) ? data : data.content || [])
        }
      }
      if (optionsResult.status === 'fulfilled') {
        setProfessionalFields(responsePayload(optionsResult.value).professionalFields || [])
      }
    })
    return () => { cancelled = true }
  }, [isManager])

  const loadData = useCallback(async () => {
    if (isManager && !managerDepartmentId) return
    setLoading(true)
    setError('')

    try {
      const response = await trainingApi.getTrainingDashboardSummary({
        departmentId: isManager
          ? managerDepartmentId
          : effectiveFilters.departmentId || undefined,
        professionalFieldId: effectiveFilters.professionalFieldId || undefined,
        complianceStatus: effectiveFilters.status || undefined,
        asOf: effectiveFilters.asOf || undefined,
      })
      setSummary(responsePayload(response))
    } catch {
      setSummary(null)
      setError('Không thể tải thống kê giờ đào tạo từ máy chủ.')
    } finally {
      setLoading(false)
    }
  }, [effectiveFilters.asOf, effectiveFilters.departmentId, effectiveFilters.professionalFieldId, effectiveFilters.status, isManager, managerDepartmentId])

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const totals = summary?.totals || {}
  const metrics = {
    total: Number(totals.employeeCount) || 0,
    configured: Number(totals.configuredCount) || 0,
    notConfigured: Number(totals.notConfiguredCount) || 0,
    completed: Number(totals.compliantCount) || 0,
    atRisk: Number(totals.atRiskCount) || 0,
    incomplete: Number(totals.nonCompliantCount) || 0,
    totalHours: Number(totals.submittedHours) || 0,
    totalTarget: Number(totals.requiredHours) || 0,
    remainingHours: Number(totals.remainingHours) || 0,
    rate: Number(totals.complianceRate) || 0,
  }

  const departmentData = useMemo(() => {
    let data = (summary?.byDepartment || [])
      .map((item) => ({
        name: item.departmentName || 'Chưa xác định',
        total: Number(item.employeeCount) || 0,
        rate: Number(item.complianceRate) || 0,
      }))
    if (deptSort === 'asc') {
      data = data.sort((left, right) => left.rate - right.rate)
    } else {
      data = data.sort((left, right) => right.rate - left.rate)
    }
    if (deptLimit !== 'all') {
      const limit = parseInt(deptLimit, 10) || 12
      data = data.slice(0, limit)
    }
    return data
  }, [summary, deptSort, deptLimit])

  const professionalFieldData = useMemo(() => {
    let data = (summary?.byProfessionalField || [])
      .map((item) => ({
        name: item.professionalFieldName || 'Chưa xác định',
        hours: Number(item.submittedHours) || 0,
      }))
    if (fieldSort === 'asc') {
      data = data.sort((left, right) => left.hours - right.hours)
    } else {
      data = data.sort((left, right) => right.hours - left.hours)
    }

    if (fieldLimit !== 'all') {
      const limit = parseInt(fieldLimit, 10) || 12
      data = data.slice(0, limit)
    }
    return data
  }, [summary, fieldSort, fieldLimit])

  const activityTypeData = useMemo(() => {
    let data = (summary?.byActivityType || [])
      .map((item) => ({
        name: item.activityTypeName || 'Chưa xác định',
        hours: Number(item.submittedHours) || 0,
      }))

    if (typeSort === 'asc') {
      data = data.sort((left, right) => left.hours - right.hours)
    } else {
      data = data.sort((left, right) => right.hours - left.hours)
    }

    if (typeLimit !== 'all') {
      const limit = parseInt(typeLimit, 10) || 12
      data = data.slice(0, limit)
    }
    return data
  }, [summary, typeSort, typeLimit])

  async function handleExport() {
    setExporting(true)
    setError('')
    try {
      const rows = await fetchAll({
        departmentId: isManager ? managerDepartmentId : effectiveFilters.departmentId || undefined,
        professionalFieldId: effectiveFilters.professionalFieldId || undefined,
        complianceStatus: effectiveFilters.status || undefined,
        asOf: effectiveFilters.asOf || undefined,
        keyword: effectiveFilters.keyword || undefined,
      })
      exportCsv(rows.map(normalizeEmployee))
    } catch {
      setError('Không thể tải danh sách nhân viên để xuất báo cáo.')
    } finally {
      setExporting(false)
    }
  }

  function resetFilters() {
    const initialFilters = { keyword: '', departmentId: '', professionalFieldId: '', asOf: today, status: '' }
    setFilters(initialFilters)
    setAppliedFilters(initialFilters)
  }

  function applyFilters() {
    setAppliedFilters({ ...filters })
    setIsFilterOpen(false)
  }

  const toolbarActions = (
    <>
      {/* Manager đã có bảng nhân sự ngay trong dashboard này, chỉ Admin mới cần đường dẫn
          sang trang giờ đào tạo nhân viên. */}
      {!isManager && (
        <button
          type="button"
          className="training-dashboard__details"
          onClick={() => navigate('/training/employees')}
        >
          Xem chi tiết <ArrowRightOutlined />
        </button>
      )}
      <button
        type="button"
        className="training-dashboard__export"
        onClick={handleExport}
        disabled={loading || exporting || metrics.total === 0}
      >
        {exporting ? <LoadingOutlined spin /> : <UploadOutlined />}
        {exporting ? 'Đang chuẩn bị...' : 'Xuất danh sách'}
      </button>
    </>
  )

  const filterFields = (
    <>
      {isManager ? (
        <label className="admin-control-toolbar__field"><span>Khoa/Phòng</span><div>{profile?.departmentName || 'Khoa của tôi'}</div></label>
      ) : (
          <FilterSelectField
            label="Khoa/Phòng"
            value={filters.departmentId}
            onChange={(value) => setFilters((current) => ({ ...current, departmentId: value }))}
            options={[
              { value: '', label: 'Toàn viện' },
              ...departments.map((department) => ({ value: department.id, label: department.name })),
            ]}
            placeholder="Toàn viện"
            searchable
            searchPlaceholder="Tìm tên khoa/phòng..."
          />
      )}
        <FilterSelectField
          label="Lĩnh vực chuyên môn"
          value={filters.professionalFieldId}
          onChange={(value) => setFilters((current) => ({ ...current, professionalFieldId: value }))}
          options={[
            { value: '', label: 'Tất cả lĩnh vực' },
            ...professionalFields.map((field) => ({ value: field.id, label: field.name })),
          ]}
          placeholder="Tất cả lĩnh vực"
          searchable
          searchPlaceholder="Tìm tên lĩnh vực..."
        />
      <label className="admin-control-toolbar__field">
        <span>Tính đến ngày</span>
        <KeyboardDatePicker value={filters.asOf} max={today} onChange={(val) => setFilters((current) => ({ ...current, asOf: val }))} />
      </label>
      <FilterSelectField
        label="Trạng thái"
        value={filters.status}
        onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
        options={[{ value: '', label: 'Tất cả trạng thái' }, { value: 'COMPLIANT', label: 'Đạt' }, { value: 'NON_COMPLIANT', label: 'Chưa đạt' }]}
        placeholder="Tất cả trạng thái"
      />
    </>
  )

  return (
    <div className="training-dashboard">
      <AppliedFilterToolbar
        activeCount={activeFilterCount}
        actions={toolbarActions}
        ariaLabel="Công cụ dashboard giờ đào tạo"
        className="training-dashboard__toolbar"
        isOpen={isFilterOpen}
        onApply={applyFilters}
        onReset={resetFilters}
        onToggle={() => setIsFilterOpen((current) => !current)}
        onSearchChange={(value) => setFilters({ ...filters, keyword: value })}
        searchValue={filters.keyword}
        searchPlaceholder="Tìm nhân sự theo tên, mã NV..."
        panelClassName="training-dashboard__filter-panel"
        panelId="training-dashboard-filter-panel"
      >
        {filterFields}
      </AppliedFilterToolbar>

      {error && <div className="training-dashboard__alert"><ExclamationCircleOutlined /> {error}</div>}

      {loading ? (
        <div className="training-dashboard__loading"><LoadingOutlined spin /> Đang tải thống kê đào tạo...</div>
      ) : (
        <>
          <section className="training-dashboard__kpis">
            <MetricCard icon={<TeamOutlined />} label="Tổng nhân viên" value={metrics.total.toLocaleString('vi-VN')} detail="Theo bộ lọc đang chọn" tone="blue" />
            <MetricCard icon={<CheckCircleOutlined />} label="Đạt" value={metrics.completed.toLocaleString('vi-VN')} detail={`${metrics.rate.toFixed(1).replace('.', ',')}% nhân viên`} tone="green" progress={metrics.rate} />
            <MetricCard icon={<ExclamationCircleOutlined />} label="Chưa đạt" value={(metrics.total - metrics.completed).toLocaleString('vi-VN')} detail="Cần theo dõi tiến độ" tone="red" progress={metrics.total > 0 ? 100 - metrics.rate : 0} />
          </section>

          {metrics.total === 0 ? (
            <section className="training-dashboard__empty">
              <SafetyCertificateOutlined />
              <strong>Chưa có dữ liệu đào tạo phù hợp</strong>
              <span>Dữ liệu sẽ hiển thị khi backend trả kết quả theo phạm vi bộ lọc.</span>
            </section>
          ) : (
            <section className={`training-dashboard__charts${isManager ? ' training-dashboard__charts--manager' : ''}`}>

              {/* Manager chỉ quản lý một khoa nên biểu đồ so sánh giữa các khoa không có ý
                  nghĩa; chỗ này dành cho danh sách nhân sự trong khoa. */}
              {isManager ? (
                <article className="training-chart-card training-chart-card--full">
                  <header><h2>Nhân sự trong khoa</h2><span>{profile?.departmentName || 'Khoa của tôi'}</span></header>
                  <DepartmentTrainingStaffTable
                    hideToolbar={true}
                    externalFilters={{
                      keyword: effectiveFilters.keyword,
                      complianceStatus: effectiveFilters.status,
                      asOf: effectiveFilters.asOf,
                      professionalFieldId: effectiveFilters.professionalFieldId
                    }}
                  />
                </article>
              ) : (
                <article className="training-chart-card training-chart-card--full">
                  <header>
                    <h2>Tỷ lệ hoàn thành theo khoa</h2>
                    <ChartConfigPanel
                      sortOrder={deptSort}
                      onSortOrderChange={setDeptSort}
                      displayLimit={deptLimit}
                      onDisplayLimitChange={setDeptLimit}
                    />
                  </header>
                  {departmentData.length === 0 ? (
                    <div className="training-dashboard__empty training-dashboard__empty--compact">Chưa có dữ liệu theo khoa trong phạm vi này.</div>
                  ) : (
                    <ChartCanvas count={departmentData.length}>
                      <BarChart data={departmentData} margin={CHART_MARGIN} barCategoryGap="30%">
                        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#e6edf4" />
                        <XAxis dataKey="name" interval={0} tickLine={false} height={CHART_AXIS_HEIGHT} tick={<CategoryTick />} />
                        <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip formatter={(value) => [`${value}%`, 'Tỷ lệ hoàn thành']} />
                        <Bar dataKey="rate" radius={[7, 7, 0, 0]} maxBarSize={46}>
                          {departmentData.map((entry) => <Cell key={entry.name} fill={entry.rate >= 80 ? '#10a77d' : '#ef4444'} />)}
                          <LabelList dataKey="rate" position="top" formatter={(value) => `${value}%`} fill="#334155" fontSize={11} />
                        </Bar>
                      </BarChart>
                    </ChartCanvas>
                  )}
                </article>
              )}
            </section>
          )}

          {!isManager && (
            <section className="training-dashboard__charts training-dashboard__charts--equal">
              <article className="training-chart-card">
                <header>
                  <h2>Tổng giờ đào tạo theo lĩnh vực</h2>
                  <ChartConfigPanel
                    sortOrder={fieldSort}
                    onSortOrderChange={setFieldSort}
                    displayLimit={fieldLimit}
                    onDisplayLimitChange={setFieldLimit}
                  />
                </header>
                {professionalFieldData.length === 0 ? (
                  <div className="training-dashboard__empty training-dashboard__empty--compact">Chưa có dữ liệu theo lĩnh vực trong phạm vi này.</div>
                ) : (
                  <ChartCanvas count={professionalFieldData.length}>
                    <BarChart data={professionalFieldData} margin={CHART_MARGIN} barCategoryGap="30%">
                      <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#e6edf4" />
                      <XAxis dataKey="name" interval={0} tickLine={false} height={CHART_AXIS_HEIGHT} tick={<CategoryTick />} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip formatter={(value) => [`${value} giờ`, 'Tổng giờ']} />
                      <Bar dataKey="hours" fill="#0284c7" radius={[7, 7, 0, 0]} maxBarSize={46}>
                        <LabelList dataKey="hours" position="top" fill="#334155" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ChartCanvas>
                )}
              </article>

              <article className="training-chart-card">
                <header>
                  <h2>Tổng giờ đào tạo theo hình thức</h2>
                  <ChartConfigPanel
                    sortOrder={typeSort}
                    onSortOrderChange={setTypeSort}
                    displayLimit={typeLimit}
                    onDisplayLimitChange={setTypeLimit}
                  />
                </header>
                {activityTypeData.length === 0 ? (
                  <div className="training-dashboard__empty training-dashboard__empty--compact">Chưa có dữ liệu theo hình thức trong phạm vi này.</div>
                ) : (
                  <ChartCanvas count={activityTypeData.length}>
                    <BarChart data={activityTypeData} margin={CHART_MARGIN} barCategoryGap="30%">
                      <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#e6edf4" />
                      <XAxis dataKey="name" interval={0} tickLine={false} height={CHART_AXIS_HEIGHT} tick={<CategoryTick />} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip formatter={(value) => [`${value} giờ`, 'Tổng giờ']} />
                      <Bar dataKey="hours" fill="#0f9f7a" radius={[7, 7, 0, 0]} maxBarSize={46}>
                        <LabelList dataKey="hours" position="top" fill="#334155" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ChartCanvas>
                )}
              </article>
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default function TrainingDashboardPage({ role = 'admin' }) {
  const isManager = role === 'manager'
  return (
    <AppShell
      title={isManager ? 'Dashboard giờ đào tạo' : undefined}
      breadcrumbs={isManager ? undefined : [{ label: 'Đào tạo liên tục' }, { label: 'Dashboard giờ đào tạo' }]}
    >
      <DashboardContent role={role} />
    </AppShell>
  )
}
