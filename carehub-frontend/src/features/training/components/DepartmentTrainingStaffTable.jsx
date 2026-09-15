import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DownloadOutlined, EyeOutlined, LoadingOutlined, SearchOutlined } from '@ant-design/icons'
import { trainingApi } from '../api/trainingApi'
import { downloadCsv, exportFileName } from '../../../shared/utils/tableExport.js'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import FilterActionButtons from '../../../shared/components/FilterActionButtons.jsx'
import '../styles/DepartmentTrainingStaffTable.css'

const STATUS_TEXT = {
  COMPLIANT: 'Đạt',
  AT_RISK: 'Đang theo dõi',
  NON_COMPLIANT: 'Chưa đạt',
  NOT_CONFIGURED: 'Chưa thiết lập',
}

const STATUS_TONE = {
  COMPLIANT: 'green',
  AT_RISK: 'amber',
  NON_COMPLIANT: 'red',
}

function statusText(status) {
  return STATUS_TEXT[status] || 'Chưa rõ'
}

function statusTone(status) {
  return STATUS_TONE[status] || 'gray'
}

const EXPORT_HEADERS = [
  'Mã NV',
  'Họ và tên',
  'Chức danh',
  'Khoa / Phòng',
  'Giờ đã nộp',
  'Giờ yêu cầu',
  'Còn thiếu',
  'Trạng thái',
]

function exportRow(employee) {
  const submitted = Number(employee.submittedHours) || 0
  const required = Number(employee.requiredHours) || 0
  return [
    employee.employeeCode,
    employee.employeeName,
    employee.jobPositionName || '',
    employee.departmentName || '',
    submitted,
    required,
    Math.max(required - submitted, 0),
    statusText(employee.complianceStatus),
  ]
}

/**
 * Danh sách nhân sự trong khoa kèm giờ đào tạo liên tục.
 * Dùng chung cho dashboard đào tạo của Manager và trang danh sách nhân sự.
 * Nút xem chi tiết điều hướng sang trang "Chi tiết đào tạo nhân viên".
 */
export default function DepartmentTrainingStaffTable({
  pageSize = 100,
  hideToolbar = false,
  externalFilters = null,
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const handler = window.setTimeout(() => setDebouncedSearch(search), 400)
    return () => window.clearTimeout(handler)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const params = {
      size: pageSize,
      keyword: hideToolbar ? externalFilters?.keyword : (debouncedSearch.trim() || undefined),
      complianceStatus: hideToolbar
        ? (externalFilters?.complianceStatus || undefined)
        : (statusFilter !== 'all' ? statusFilter : undefined),
    }

    // Add extra external filters if provided
    if (hideToolbar && externalFilters) {
      if (externalFilters.asOf) params.asOf = externalFilters.asOf
      if (externalFilters.professionalFieldId) params.professionalFieldId = externalFilters.professionalFieldId
    }

    trainingApi.getEmployeeTrainingStatuses(params)
      .then((response) => {
        if (cancelled) return
        setEmployees(response.data?.data?.content || [])
        setError(null)
      })
      .catch(() => {
        if (cancelled) return
        setError('Không thể tải danh sách nhân sự trong khoa.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [debouncedSearch, pageSize, statusFilter, hideToolbar, externalFilters])

  return (
    <div className="dtst">
      {!hideToolbar && (
        <div className="dtst__toolbar">
          <div className="dtst__search">
            <SearchOutlined />
            <input
              type="text"
              placeholder="Tìm nhân sự theo tên, mã NV..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Tìm nhân sự trong khoa"
            />
          </div>
          <FilterSelectField
            label="Trạng thái đào tạo"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            options={[
              { value: 'all', label: 'Tất cả trạng thái' },
              { value: 'COMPLIANT', label: 'Đạt' },
              { value: 'NON_COMPLIANT', label: 'Chưa đạt' },
              { value: 'AT_RISK', label: 'Đang theo dõi' },
              { value: 'NOT_CONFIGURED', label: 'Chưa thiết lập' },
            ]}
          />
          <FilterActionButtons
            onApply={() => {}}
            onReset={() => {
              setSearch('')
              setStatusFilter('all')
            }}
          />
          <button
            type="button"
            className="dtst__export"
            onClick={() => downloadCsv(
              exportFileName('nhan-su-dao-tao-lien-tuc'),
              EXPORT_HEADERS,
              employees.map(exportRow),
            )}
            disabled={loading || employees.length === 0}
            title="Xuất danh sách đang lọc ra file Excel"
          >
            <DownloadOutlined /> Xuất Excel
          </button>
        </div>
      )}

      {loading ? (
        <p className="dtst__state"><LoadingOutlined spin /> Đang tải danh sách nhân sự...</p>
      ) : error ? (
        <p className="dtst__state dtst__state--error" role="alert">{error}</p>
      ) : employees.length === 0 ? (
        <p className="dtst__state">Không tìm thấy nhân sự nào.</p>
      ) : (
        <div className="dtst__scroll">
          <table className="dtst__table">
            <thead>
              <tr>
                <th>Mã NV</th>
                <th>Họ và tên</th>
                <th>Chức danh</th>
                <th>Khoa / Phòng</th>
                <th>Giờ đào tạo</th>
                <th>Trạng thái</th>
                <th className="dtst__col-action">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.employeeId}>
                  <td data-label="Mã NV" className="dtst__code">{employee.employeeCode}</td>
                  <td data-label="Họ và tên" className="dtst__name">{employee.employeeName}</td>
                  <td data-label="Chức danh">{employee.jobPositionName || '---'}</td>
                  <td data-label="Khoa / Phòng">{employee.departmentName || '---'}</td>
                  <td data-label="Giờ đào tạo">
                    <strong className={`dtst__hours dtst__hours--${statusTone(employee.complianceStatus)}`}>
                      {employee.submittedHours || 0}h / {employee.requiredHours || 0}h
                    </strong>
                  </td>
                  <td data-label="Trạng thái">
                    <span className={`dtst__badge dtst__badge--${statusTone(employee.complianceStatus)}`}>
                      {statusText(employee.complianceStatus)}
                    </span>
                  </td>
                  <td className="dtst__col-action">
                    <button
                      type="button"
                      className="dtst__view"
                      title="Xem chi tiết đào tạo nhân viên"
                      aria-label={`Xem chi tiết đào tạo của ${employee.employeeName || employee.employeeCode}`}
                      onClick={() => navigate(`/training/employees/${employee.employeeId}`)}
                    >
                      <EyeOutlined />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
