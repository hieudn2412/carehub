import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SearchOutlined,
  ReloadOutlined,
  WarningFilled,
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  CaretUpOutlined,
  CaretDownOutlined,
  EyeOutlined,
  FilterOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import AppShell from '../../../shared/components/AppShell.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { competencyApi } from '../api/examAssignmentApi.js'
import { adminApi } from '../../admin/api/adminApi.js'
import { staffApi } from '../../staff/api/staffApi.js'
import { apiData, apiErrorMessage, formatNumber } from '../utils/documentQuestionUi.js'
import { tokenStorage } from '../../../features/auth/services/tokenStorage.js'
import { getRolesFromAccessToken } from '../../../features/auth/utils/jwt.js'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import '../styles/EvaluationDashboardPage.css'

const PAGE_SIZE = 10
const today = new Date().toISOString().slice(0, 10)
const yearStart = `${new Date().getFullYear()}-01-01`

function formatScore(value) {
  const score = Number(value)
  return Number.isFinite(score) ? score.toFixed(1).replace('.', ',') : '—'
}

function CompetencySummaryPage() {
  const { showToast } = useToast()
  const navigate = useNavigate()

  const accessToken = tokenStorage.getAccessToken()
  const roles = getRolesFromAccessToken(accessToken)
  const isAdmin = roles.some(r => String(r).toUpperCase().includes('ADMIN'))
  const isManager = roles.some(r => String(r).toUpperCase().includes('MANAGER'))

  const [reportType, setReportType] = useState('summary') // 'summary', 'field', 'technique'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [fromDate, setFromDate] = useState(yearStart)
  const [toDate, setToDate] = useState(today)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  // Field specific states
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')

  // Technique specific states
  const [forms, setForms] = useState([])
  const [selectedFormId, setSelectedFormId] = useState('')

  // Search filter
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [page, setPage] = useState(0)

  // Sorting
  const [sortColumn, setSortColumn] = useState('overallScore')
  const [sortDirection, setSortDirection] = useState('desc')

  const dashboardPath = isAdmin ? '/admin/dashboard' : '/manager/dashboard'
  const detailPathField = isAdmin ? '/admin/evaluation/competency-by-field' : '/manager/competency-by-field'

  const loadCategories = useCallback(async () => {
    try {
      const { questionCategoryApi } = await import('../api/questionCategoryApi.js')
      const response = await questionCategoryApi.listCategories()
      setCategories(apiData(response, []))
    } catch {
      setCategories([])
    }
  }, [])

  useEffect(() => {
    async function init() {
      if (isAdmin) {
        try {
          const res = await adminApi.getDepartments()
          const depts = apiData(res, [])
          setDepartments(depts)
          setDepartmentId('')
        } catch { /* ignore */ }
      } else {
        try {
          const res = await staffApi.getProfile()
          const profile = res.data?.data
          if (profile?.departmentId) {
            setDepartmentId(String(profile.departmentId))
            setDepartments([{ id: profile.departmentId, name: profile.departmentName || 'Khoa của tôi' }])
          }
        } catch {
          showToast('Không tìm thấy khoa/phòng của bạn', 'error')
        }
      }
    }
    const timer = window.setTimeout(() => {
      init()
      loadCategories()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isAdmin, showToast, loadCategories])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim())
      setPage(0)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchTerm])

  const loadData = useCallback(async () => {
    if (!isAdmin && !departmentId) return
    setLoading(true)
    setData(null)
    try {
      if (reportType === 'summary') {
        const response = await competencyApi.getSummary({
          departmentId: departmentId || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          keyword: debouncedSearchTerm || undefined,
          page,
          size: PAGE_SIZE,
        })
        const responseData = apiData(response, null)
        setData(responseData)
      } else if (reportType === 'field') {
        const params = {
          departmentId: departmentId || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          keyword: debouncedSearchTerm || undefined,
          page,
          size: PAGE_SIZE,
        }
        if (selectedCategory) {
          params.categoryId = selectedCategory
        }
        const response = await competencyApi.getByField(params)
        setData(apiData(response, null))
      } else if (reportType === 'technique') {
        const response = await competencyApi.getByTechnique({
          departmentId: departmentId || undefined,
          formId: selectedFormId || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          keyword: debouncedSearchTerm || undefined,
          page,
          size: PAGE_SIZE,
        })
        const responseData = apiData(response, null)
        setData(responseData)
        setForms(responseData?.forms || [])
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [
    reportType, departmentId, fromDate, toDate, selectedCategory, selectedFormId,
    debouncedSearchTerm, page, isAdmin, showToast,
  ])

  useEffect(() => {
    if (!isAdmin && !departmentId) return undefined
    const timer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(timer)
  }, [
    departmentId, reportType, fromDate, toDate, selectedCategory, selectedFormId,
    debouncedSearchTerm, page, isAdmin, loadData,
  ])

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const sortIcon = (column) => {
    if (sortColumn !== column) return <span style={{ marginLeft: 4, color: '#d1d5db' }}><CaretUpOutlined style={{ fontSize: 10 }} /></span>
    return sortDirection === 'asc'
      ? <CaretUpOutlined style={{ marginLeft: 4, fontSize: 10, color: '#2563eb' }} />
      : <CaretDownOutlined style={{ marginLeft: 4, fontSize: 10, color: '#2563eb' }} />
  }

  const buildDistribution = () => {
    if (reportType !== 'summary' || !data?.items) return []
    const counts = {}
    data.items.forEach(item => {
      const label = item.competencyLabel || 'Chưa xếp loại'
      counts[label] = (counts[label] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, count]) => {
        const item = data.items.find(i => (i.competencyLabel || 'Chưa xếp loại') === name)
        return {
          name,
          count,
          fill: item?.colorHex || '#6b7280',
        }
      })
      .sort((a, b) => b.count - a.count)
  }

  const distribution = buildDistribution()
  const knowledgeWeight = data?.knowledgeWeight ? parseFloat(data.knowledgeWeight) * 100 : 50
  const skillWeight = data?.skillWeight ? parseFloat(data.skillWeight) * 100 : 50

  const filteredItems = data?.items || []
  const totalElements = Number(data?.totalElements) || 0
  const totalPages = Number(data?.totalPages) || 0

  const getSortedSummaryItems = () => {
    const items = [...filteredItems]
    items.sort((a, b) => {
      const aVal = sortColumn === 'examScore' ? (a.examScore ?? a.knowledgeAverage) : a[sortColumn]
      const bVal = sortColumn === 'examScore' ? (b.examScore ?? b.knowledgeAverage) : b[sortColumn]
      const aNum = typeof aVal === 'number' ? aVal : (parseFloat(aVal) || 0)
      const bNum = typeof bVal === 'number' ? bVal : (parseFloat(bVal) || 0)
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
    })
    return items
  }

  const complianceTarget = data?.complianceTarget || 80.0
  const belowCount = data?.items ? data.items.filter(i => i.belowTarget).length : 0
  const totalCount = data?.items ? data.items.length : 0
  const activeFilterCount = [
    isAdmin && departmentId,
    fromDate && fromDate !== yearStart,
    toDate && toDate !== today,
    reportType === 'field' && selectedCategory,
    reportType === 'technique' && selectedFormId,
  ].filter(Boolean).length

  const visiblePages = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index)
    }
    const indexes = new Set([0, totalPages - 1, page - 1, page, page + 1])
    const pages = [...indexes]
      .filter(index => index >= 0 && index < totalPages)
      .sort((left, right) => left - right)
    const result = []
    pages.forEach((pageIndex, index) => {
      if (index > 0 && pageIndex - pages[index - 1] > 1) {
        result.push(`ellipsis-${pageIndex}`)
      }
      result.push(pageIndex)
    })
    return result
  }

  const renderPagination = () => {
    if (loading || totalElements === 0) return null
    return (
      <div className="evd-x-pagination">
        <span className="evd-x-pagination__info">
          Hiển thị {filteredItems.length} trong tổng số {totalElements} kết quả
        </span>
        <div className="evd-x-pagination__pages">
          <button
            type="button"
            className="evd-x-page-btn"
            aria-label="Trang trước"
            onClick={() => setPage(current => Math.max(0, current - 1))}
            disabled={page === 0}
          >
            <LeftOutlined />
          </button>
          {visiblePages().map(pageItem => (
            typeof pageItem === 'string'
              ? <span key={pageItem} style={{ padding: '0 4px', color: '#9ca3af' }}>...</span>
              : (
                <button
                  type="button"
                  key={pageItem}
                  onClick={() => setPage(pageItem)}
                  aria-current={pageItem === page ? 'page' : undefined}
                  className={pageItem === page ? 'evd-x-page-btn is-active' : 'evd-x-page-btn'}
                >
                  {pageItem + 1}
                </button>
              )
          ))}
          <button
            type="button"
            className="evd-x-page-btn"
            aria-label="Trang sau"
            onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))}
            disabled={page + 1 >= totalPages}
          >
            <RightOutlined />
          </button>
        </div>
      </div>
    )
  }

  const breadcrumbs = [
    { label: 'Dashboard', link: dashboardPath },
    { label: 'Đánh giá' },
    {
      label: reportType === 'summary' ? 'Dashboard năng lực'
        : reportType === 'field' ? 'Năng lực theo lĩnh vực'
        : 'Tuân thủ kỹ thuật'
    },
  ]

  const pageTitle = reportType === 'summary' ? 'Dashboard năng lực'
    : reportType === 'field' ? 'Năng lực theo lĩnh vực'
    : 'Tuân thủ kỹ thuật'

  return (
    <AppShell breadcrumbs={isAdmin ? breadcrumbs : undefined} title={isManager ? pageTitle : undefined}>
            <div className="evd-page">
              <section className="competency-dashboard-toolbar admin-control-toolbar" aria-label="Công cụ dashboard năng lực">
                <div className="competency-dashboard-tabs" role="tablist" aria-label="Loại báo cáo năng lực">
                  {[
                    { key: 'summary', label: 'Lý thuyết + thực hành' },
                    { key: 'field', label: 'Năng lực theo lĩnh vực' },
                    { key: 'technique', label: 'Tuân thủ kỹ thuật' }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setReportType(tab.key)
                        setSearchTerm('')
                        setPage(0)
                      }}
                      className={reportType === tab.key ? 'competency-dashboard-tabs__button is-active' : 'competency-dashboard-tabs__button'}
                      role="tab"
                      aria-selected={reportType === tab.key}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="admin-control-toolbar__main">
                  <div className="admin-control-toolbar__controls">
                    <div className="competency-dashboard-search admin-control-toolbar__search">
                      <SearchOutlined />
                      <input
                        aria-label="Tìm theo tên hoặc mã nhân viên"
                        type="text"
                        placeholder="Tìm theo tên hoặc mã nhân viên..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className={`admin-control-toolbar__filter-trigger${isFilterOpen ? ' is-open' : ''}`}
                      aria-controls="competency-dashboard-filter-panel"
                      aria-expanded={isFilterOpen}
                      onClick={() => setIsFilterOpen((current) => !current)}
                    >
                      <FilterOutlined />
                      Bộ lọc
                      {activeFilterCount > 0 && (
                        <span className="admin-control-toolbar__filter-count">{activeFilterCount}</span>
                      )}
                    </button>
                  </div>
                  <div className="competency-dashboard-toolbar__actions">
                    <span>{totalElements} kết quả</span>
                    <button
                      type="button"
                      className="competency-dashboard-reload"
                      onClick={loadData}
                      disabled={loading}
                      aria-label="Tải lại dữ liệu"
                      title="Tải lại"
                    >
                      <ReloadOutlined spin={loading} />
                    </button>
                  </div>
                </div>

                {isFilterOpen && (
                  <div id="competency-dashboard-filter-panel" className="competency-dashboard-filter-panel admin-control-toolbar__panel">
                    <label className="admin-control-toolbar__field">
                      <span>Khoa/phòng</span>
                      <SearchableSelect
                        value={departmentId}
                        onChange={(value) => {
                          setDepartmentId(value)
                          setPage(0)
                        }}
                        disabled={!isAdmin}
                        options={[
                          ...(isAdmin ? [{ value: '', label: 'Toàn viện' }] : []),
                          ...departments.map((department) => ({ value: department.id, label: department.name })),
                        ]}
                        placeholder={isAdmin ? 'Toàn viện' : 'Khoa của tôi'}
                        searchPlaceholder="Tìm tên khoa/phòng..."
                        ariaLabel="Tìm và chọn khoa/phòng"
                      />
                    </label>
                    <label className="admin-control-toolbar__field">
                      <span>Từ ngày</span>
                      <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => {
                        setFromDate(event.target.value)
                        setPage(0)
                      }} />
                    </label>
                    <label className="admin-control-toolbar__field">
                      <span>Đến ngày</span>
                      <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => {
                        setToDate(event.target.value)
                        setPage(0)
                      }} />
                    </label>
                    {reportType === 'field' && (
                      <label className="admin-control-toolbar__field">
                        <span>Lĩnh vực</span>
                        <SearchableSelect
                          value={selectedCategory}
                          onChange={(value) => {
                            setSelectedCategory(value)
                            setPage(0)
                          }}
                          options={[
                            { value: '', label: 'Tất cả lĩnh vực' },
                            ...categories.map((category) => ({ value: category.id, label: category.name })),
                          ]}
                          placeholder="Tất cả lĩnh vực"
                          searchPlaceholder="Tìm tên lĩnh vực..."
                          ariaLabel="Tìm và chọn lĩnh vực"
                        />
                      </label>
                    )}
                    {reportType === 'technique' && (
                      <label className="admin-control-toolbar__field">
                        <span>Kỹ thuật</span>
                        <select value={selectedFormId} onChange={(event) => {
                          setSelectedFormId(event.target.value)
                          setPage(0)
                        }}>
                          <option value="">Tất cả kỹ thuật</option>
                          {forms.map((form) => (
                            <option key={form.id} value={form.id}>{form.title}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {reportType === 'summary' && data && (
                      <div className="competency-dashboard-weight">
                        <span>Trọng số hiện tại</span>
                        <strong>Lý thuyết {knowledgeWeight}% · Thực hành {skillWeight}%</strong>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* REPORT TYPE: 1. SUMMARY VIEW */}
              {reportType === 'summary' && (
                <>
                  <div className="competency-dashboard-insights">
                  {data && <section className="evd-panel competency-dashboard-target">
                    <div>
                      <strong>
                        Điểm sàn năng lực toàn viện
                      </strong>
                      <p>
                        Do Admin cấu hình và áp dụng thống nhất cho tất cả khoa/phòng.
                      </p>
                    </div>
                    <div className="competency-dashboard-target__form">
                      <strong>≥ {formatScore(data.targetScore)}/10</strong>
                    </div>
                  </section>}

                  {data && distribution.length > 0 && (
                    <section className="evd-panel competency-dashboard-distribution">
                      <strong>
                        Phân bố trên trang hiện tại — {data.departmentName || 'Khoa đã chọn'}
                      </strong>
                      <ResponsiveContainer width="100%" height={190}>
                        <BarChart data={distribution} layout="vertical" margin={{ left: 100, right: 20, top: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" allowDecimals={false} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 13, fill: '#374151' }} width={100} />
                          <Tooltip
                            formatter={(value) => [`${value} Điều dưỡng`, 'Số lượng']}
                            contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e5e7eb' }}
                          />
                          <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={28}>
                            {distribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </section>
                  )}
                  </div>

                  <div className="evd-card evd-x-table-card competency-dashboard-table-card">
                    <table className="evd-table admin-table-uppercase">
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Mã NV</th>
                          <th>Họ tên</th>
                          {isAdmin && <th>Khoa</th>}
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('examScore')}>
                            Điểm kiểm tra{sortIcon('examScore')}
                          </th>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('skillAverage')}>
                            Điểm thực hành{sortIcon('skillAverage')}
                          </th>
                          <th style={{ cursor: 'pointer' }} onClick={() => handleSort('overallScore')}>
                            Tổng điểm{sortIcon('overallScore')}
                          </th>
                          <th>Phân loại</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={isAdmin ? 8 : 7} className="ch-empty">
                              Đang tải dữ liệu...
                            </td>
                          </tr>
                        ) : !data || filteredItems.length === 0 ? (
                          <tr>
                            <td colSpan={isAdmin ? 8 : 7} className="ch-empty">
                              Chưa có dữ liệu năng lực trong phạm vi đã chọn.
                            </td>
                          </tr>
                        ) : (
                          getSortedSummaryItems().map((item, idx) => {
                            const isNotCompetent = item.competencyLevel === 'NOT_COMPETENT'
                            const isBeginner = item.competencyLevel === 'BEGINNER'
                            const rowClass = isNotCompetent ? 'evd-row--danger' : (isBeginner ? 'evd-row--warning' : '')
                            return (
                              <tr key={idx} className={rowClass}>
                                <td>{page * PAGE_SIZE + idx + 1}</td>
                                <td><code style={{ fontSize: 12 }}>{item.employeeCode || '—'}</code></td>
                                <td style={{ fontWeight: 500 }}>{item.employeeName || '—'}</td>
                                {isAdmin && <td style={{ color: '#6b7280' }}>{item.departmentName || '—'}</td>}
                                <td>{formatNumber(item.examScore ?? item.knowledgeAverage)}</td>
                                <td>{formatNumber(item.skillAverage)}</td>
                                <td style={{ fontWeight: 700 }}>{formatNumber(item.overallScore)}</td>
                                <td>
                                  <span className="evd-badge" style={{
                                    backgroundColor: (item.colorHex || '#6b7280') + '20',
                                    color: item.colorHex || '#6b7280',
                                  }}>
                                    {item.isPassed
                                      ? <CheckCircleFilled style={{ marginRight: 4 }} />
                                      : isNotCompetent
                                        ? <CloseCircleFilled style={{ marginRight: 4 }} />
                                        : <WarningFilled style={{ marginRight: 4 }} />}
                                    {item.competencyLabel || '—'}
                                  </span>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                    {renderPagination()}
                  </div>
                </>
              )}

              {/* REPORT TYPE: 2. FIELD VIEW */}
              {reportType === 'field' && (
                <>
                  {data && data.items && data.items.length > 0 && (
                    <section className="evd-panel" style={{ padding: 16, marginBottom: 16 }}>
                      <div style={{ fontSize: 14, color: '#374151' }}>
                        <strong>{data.departmentName}</strong>
                        {data.categoryName && <> — <em>{data.categoryName}</em></>}
                        : {totalElements} điều dưỡng có dữ liệu
                      </div>
                    </section>
                  )}

                  <div className="evd-card evd-x-table-card competency-dashboard-table-card">
                    <table className="evd-table evd-competency-table evd-competency-table--field admin-table-uppercase">
                      <colgroup>
                        <col className="evd-col-index" />
                        <col className="evd-col-code" />
                        <col className="evd-col-name" />
                        {isAdmin && <col className="evd-col-department" />}
                        <col className="evd-col-attempts" />
                        <col className="evd-col-score" />
                        <col className="evd-col-rate" />
                        <col className="evd-col-level" />
                        <col className="evd-col-actions" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Mã NV</th>
                          <th>Họ tên</th>
                          {isAdmin && <th>Khoa/phòng</th>}
                          <th>Số lượt</th>
                          <th>Điểm trung bình</th>
                          <th>Tỷ lệ đạt</th>
                          <th>Phân loại</th>
                          <th>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={isAdmin ? 9 : 8} className="ch-empty">
                              Đang tải dữ liệu...
                            </td>
                          </tr>
                        ) : filteredItems.length === 0 ? (
                          <tr>
                            <td colSpan={isAdmin ? 9 : 8} className="ch-empty">
                              Chưa có dữ liệu đánh giá cho lĩnh vực này.
                            </td>
                          </tr>
                        ) : (
                          filteredItems.map((item, idx) => (
                            <tr key={item.employeeId} className={!item.isPassed ? 'evd-row--danger' : ''}>
                              <td>{page * PAGE_SIZE + idx + 1}</td>
                              <td><span className="evd-table-code">{item.employeeCode || '—'}</span></td>
                              <td><strong className="evd-table-person">{item.employeeName || '—'}</strong></td>
                              {isAdmin && <td><span className="evd-table-department" title={item.departmentName || ''}>{item.departmentName || '—'}</span></td>}
                              <td><span className="evd-table-metric">{item.attemptCount ?? 0}</span></td>
                              <td><strong className="evd-table-score">{formatNumber(item.averageScore)}</strong></td>
                              <td>
                                <span className={(item.passRate || 0) < 50 ? 'evd-table-rate is-low' : 'evd-table-rate'}>
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
                              <td>
                                <div className="admin-table-actions">
                                  <button
                                    className="admin-table-action admin-table-action--icon admin-table-action--primary"
                                    type="button"
                                    title="Xem chi tiết"
                                    aria-label={`Xem chi tiết năng lực của ${item.employeeName || item.employeeCode}`}
                                    onClick={() => navigate(`${detailPathField}/${item.employeeId}`)}
                                  >
                                    <EyeOutlined />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    {renderPagination()}
                  </div>
                </>
              )}

              {/* REPORT TYPE: 3. TECHNIQUE VIEW */}
              {reportType === 'technique' && (
                <>
                  {data && (
                    <section className="evd-panel" style={{
                      padding: 16, marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap',
                    }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>
                        Mục tiêu tuân thủ: <span style={{ color: '#2563eb' }}>{complianceTarget}%</span>
                      </div>
                      {totalCount > 0 && (
                        <div style={{ fontSize: 14, color: '#6b7280' }}>
                          {totalCount} điều dưỡng trên trang hiện tại —{' '}
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

                  <div className="evd-card evd-x-table-card competency-dashboard-table-card">
                    <table className="evd-table evd-competency-table evd-competency-table--technique admin-table-uppercase">
                      <colgroup>
                        <col className="evd-col-index" />
                        <col className="evd-col-code" />
                        <col className="evd-col-name" />
                        {isAdmin && <col className="evd-col-department" />}
                        <col className="evd-col-attempts" />
                        <col className="evd-col-score" />
                        <col className="evd-col-rate" />
                        <col className="evd-col-target" />
                        <col className="evd-col-level" />
                        <col className="evd-col-actions" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Mã NV</th>
                          <th>Họ tên</th>
                          {isAdmin && <th>Khoa/phòng</th>}
                          <th>Số lượt</th>
                          <th>Điểm trung bình</th>
                          <th>Tỷ lệ đạt</th>
                          <th>Mục tiêu</th>
                          <th>Phân loại</th>
                          <th>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={isAdmin ? 10 : 9} className="ch-empty">
                              Đang tải dữ liệu...
                            </td>
                          </tr>
                        ) : filteredItems.length === 0 ? (
                          <tr>
                            <td colSpan={isAdmin ? 10 : 9} className="ch-empty">
                              {!isAdmin && !departmentId
                                ? 'Vui lòng chọn khoa/phòng.'
                                : 'Chưa có dữ liệu tuân thủ kỹ thuật.'}
                            </td>
                          </tr>
                        ) : (
                          filteredItems.map((item, idx) => (
                            <tr key={item.employeeId || item.employeeCode || idx} className={item.belowTarget ? 'evd-row--danger' : (!item.isPassed ? 'evd-row--warning' : '')}>
                              <td>{page * PAGE_SIZE + idx + 1}</td>
                              <td><span className="evd-table-code">{item.employeeCode || '—'}</span></td>
                              <td><strong className="evd-table-person">{item.employeeName || '—'}</strong></td>
                              {isAdmin && <td><span className="evd-table-department" title={item.departmentName || data?.departmentName || ''}>{item.departmentName || data?.departmentName || '—'}</span></td>}
                              <td><span className="evd-table-metric">{item.evaluationCount ?? 0}</span></td>
                              <td><strong className="evd-table-score">{formatNumber(item.averageScore)}</strong></td>
                              <td>
                                <span className={(item.passRate || 0) < complianceTarget ? 'evd-table-rate is-low' : 'evd-table-rate'}>
                                  {item.passRate != null ? `${item.passRate}%` : '—'}
                                </span>
                              </td>
                              <td>
                                {item.belowTarget ? (
                                  <span className="evd-table-target is-low">
                                    <ExclamationCircleFilled style={{ marginRight: 4 }} />
                                    {'<'} {complianceTarget}%
                                  </span>
                                ) : (
                                  <span className="evd-table-target">
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
                                <div className="admin-table-actions">
                                  <button
                                    className="admin-table-action admin-table-action--icon admin-table-action--primary"
                                    type="button"
                                    title="Xem chi tiết"
                                    aria-label={`Xem chi tiết tuân thủ của ${item.employeeName || item.employeeCode}`}
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
                                  >
                                    <EyeOutlined />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    {renderPagination()}
                  </div>
                </>
              )}
            </div>
    </AppShell>
  )
}

export default CompetencySummaryPage
