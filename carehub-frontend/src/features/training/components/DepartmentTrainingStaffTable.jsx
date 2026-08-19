import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EyeOutlined, LoadingOutlined, SearchOutlined } from '@ant-design/icons'
import { trainingApi } from '../api/trainingApi'
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

/**
 * Danh sách nhân sự trong khoa kèm giờ đào tạo liên tục.
 * Dùng chung cho dashboard đào tạo của Manager và trang danh sách nhân sự.
 * Nút xem chi tiết điều hướng sang trang "Chi tiết đào tạo nhân viên".
 */
export default function DepartmentTrainingStaffTable({ pageSize = 100 }) {
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

    trainingApi.getEmployeeTrainingStatuses({
      size: pageSize,
      keyword: debouncedSearch.trim() || undefined,
      complianceStatus: statusFilter !== 'all' ? statusFilter : undefined,
    })
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
  }, [debouncedSearch, pageSize, statusFilter])

  return (
    <div className="dtst">
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
        <select
          className="dtst__select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Lọc theo trạng thái đào tạo"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="COMPLIANT">Đạt</option>
          <option value="NON_COMPLIANT">Chưa đạt</option>
          <option value="AT_RISK">Đang theo dõi</option>
          <option value="NOT_CONFIGURED">Chưa thiết lập</option>
        </select>
      </div>

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
