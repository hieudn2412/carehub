import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
  StopOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import AdminHeader from '../components/AdminHeader'
import AdminSidebar from '../components/AdminSidebar'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { adminApi } from '../api/adminApi'
import { getChecklistDisplayCode } from '../utils/formCode.js'
import '../styles/FormAssignmentManagementPage.css'

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Đang hiệu lực' },
  { value: 'EXPIRED', label: 'Hết hạn' },
  { value: 'REVOKED', label: 'Đã thu hồi' },
]

function getPageContent(response) {
  const data = response?.data?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  return []
}

function getPageTotalElements(response) {
  const total = Number(response?.data?.data?.totalElements)
  return Number.isFinite(total) ? total : 0
}

function formatDateTime(value) {
  if (!value) return 'Không giới hạn'

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function getAssignmentErrorMessage(error) {
  const statusCode = error?.response?.status

  if (!error?.response) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend và thử lại.'
  }

  if (statusCode === 400) {
    return 'Dữ liệu phân quyền không hợp lệ. Chỉ checklist đã công bố mới có thể phân quyền.'
  }

  if (statusCode === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  }

  if (statusCode === 403) {
    return 'Bạn không có quyền quản lý phân quyền checklist.'
  }

  if (statusCode === 409) {
    return 'Manager này đang có phân quyền hiệu lực cho checklist hiện tại.'
  }

  return error?.response?.data?.message || 'Không thể xử lý phân quyền checklist. Vui lòng thử lại.'
}

function getStatusLabel(status) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label || status || 'Không rõ'
}

function getManagerName(manager) {
  return manager?.fullName || manager?.name || manager?.employeeCode || 'Manager chưa có tên'
}

function FormAssignmentManagementPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [managers, setManagers] = useState([])
  const [selectedManagerId, setSelectedManagerId] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [totalAssignments, setTotalAssignments] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [confirmRevoke, setConfirmRevoke] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const publishedVersion = form?.currentPublishedVersion

  const loadManagers = useCallback(async () => {
    const rolesResponse = await adminApi.getRoles()
    const roles = rolesResponse.data?.data || []
    const managerRole = roles.find((role) => String(role.code).toUpperCase() === 'MANAGER')

    if (!managerRole?.id) {
      throw new Error('MANAGER_ROLE_NOT_FOUND')
    }

    const managersResponse = await adminApi.getUsers({
      page: 0,
      size: 100,
      roleId: managerRole.id,
      status: 'ACTIVE',
    })

    return getPageContent(managersResponse)
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage('')

      const [formResponse, assignmentsResponse, managerContent] = await Promise.all([
        adminApi.getFormById(id),
        adminApi.getFormAssignmentsByForm(id, {
          page: 0,
          size: 100,
          status,
        }),
        loadManagers(),
      ])

      const nextForm = formResponse.data?.data || null
      setForm(nextForm)
      setAssignments(getPageContent(assignmentsResponse))
      setTotalAssignments(getPageTotalElements(assignmentsResponse))
      setManagers(managerContent)
      setSelectedManagerId((current) => current || (managerContent[0]?.id ? String(managerContent[0].id) : ''))
    } catch (error) {
      setForm(null)
      setAssignments([])
      setTotalAssignments(0)
      setManagers([])
      setSelectedManagerId('')
      setErrorMessage(
        error.message === 'MANAGER_ROLE_NOT_FOUND'
          ? 'Chưa tìm thấy vai trò MANAGER trong hệ thống.'
          : getAssignmentErrorMessage(error),
      )
    } finally {
      setLoading(false)
    }
  }, [id, loadManagers, status])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadData, refreshKey])

  const assignedManagerIds = useMemo(() => (
    new Set(
      assignments
        .filter((assignment) => assignment.effectiveStatus === 'ACTIVE' && assignment.itemStatus === 'ACTIVE')
        .map((assignment) => String(assignment.manager?.id)),
    )
  ), [assignments])

  const availableManagers = useMemo(() => (
    managers.filter((manager) => !assignedManagerIds.has(String(manager.id)))
  ), [assignedManagerIds, managers])

  const canCreateAssignment = Boolean(publishedVersion?.id && selectedManagerId)

  const submitAssignment = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!publishedVersion?.id) {
      setErrorMessage('Checklist này chưa có phiên bản đã công bố nên chưa thể phân quyền.')
      return
    }

    if (!selectedManagerId) {
      setErrorMessage('Vui lòng chọn manager cần phân quyền.')
      return
    }

    try {
      setSubmitting(true)
      await adminApi.createFormAssignment({
        managerId: Number(selectedManagerId),
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
        formVersionIds: [Number(publishedVersion.id)],
      })

      const manager = managers.find((item) => String(item.id) === selectedManagerId)
      setSuccessMessage(`Đã phân quyền checklist cho ${getManagerName(manager)}.`)
      setValidUntil('')
      setSelectedManagerId('')
      setStatus('ACTIVE')
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setErrorMessage(getAssignmentErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const revokeAssignment = async () => {
    if (!confirmRevoke?.assignmentItemId) return

    try {
      setSubmitting(true)
      setErrorMessage('')
      setSuccessMessage('')
      await adminApi.revokeFormAssignmentItem(confirmRevoke.assignmentItemId)
      setSuccessMessage(`Đã thu hồi phân quyền của ${getManagerName(confirmRevoke.manager)}.`)
      setConfirmRevoke(null)
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setErrorMessage(getAssignmentErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const breadcrumbs = [
    { label: 'Quản lý chất lượng' },
    { label: 'Danh sách checklist', link: '/admin/quality/checklists' },
    { label: 'Phân quyền manager' },
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="fam-page">
              <button
                className="fam-back-button"
                onClick={() => navigate(`/admin/quality/checklists/${id}/detail`)}
                type="button"
              >
                <ArrowLeftOutlined /> Quay lại chi tiết checklist
              </button>

              <section className="fam-hero">
                <div>
                  <span>Phân quyền checklist</span>
                  <h1>{form?.title || 'Đang tải checklist...'}</h1>
                  <p>
                    Quản lý manager được phép giám sát và thực hiện checklist này.
                    Chỉ phiên bản đã công bố mới có thể phân quyền.
                  </p>
                </div>
                <div className="fam-hero__meta">
                  <span>{getChecklistDisplayCode(form?.code)}</span>
                  <strong>{publishedVersion ? `v${publishedVersion.versionNumber}` : 'Chưa công bố'}</strong>
                </div>
              </section>

              {errorMessage && (
                <div className="fam-feedback fam-feedback--error" role="alert">
                  <ExclamationCircleOutlined />
                  <span>{errorMessage}</span>
                  <button onClick={() => setRefreshKey((current) => current + 1)} type="button">
                    <ReloadOutlined /> Tải lại
                  </button>
                </div>
              )}

              {successMessage && (
                <div className="fam-feedback fam-feedback--success" role="status">
                  <span>{successMessage}</span>
                  <button onClick={() => setSuccessMessage('')} type="button">×</button>
                </div>
              )}

              <section className="fam-grid">
                <form className="fam-card fam-card--form" onSubmit={submitAssignment}>
                  <div className="fam-card__header">
                    <div>
                      <h2>Thêm manager</h2>
                      <p>Giao phiên bản đang công bố cho một manager đang hoạt động.</p>
                    </div>
                    <UserSwitchOutlined />
                  </div>

                  <label className="fam-field">
                    <span>Manager</span>
                    <select
                      disabled={loading || submitting || !publishedVersion?.id}
                      onChange={(event) => setSelectedManagerId(event.target.value)}
                      value={selectedManagerId}
                    >
                      {availableManagers.length === 0 ? (
                        <option value="">Không còn manager khả dụng</option>
                      ) : (
                        availableManagers.map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {getManagerName(manager)} ({manager.employeeCode})
                          </option>
                        ))
                      )}
                    </select>
                  </label>

                  <label className="fam-field">
                    <span>Hiệu lực đến</span>
                    <input
                      disabled={loading || submitting || !publishedVersion?.id}
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={(event) => setValidUntil(event.target.value)}
                      type="datetime-local"
                      value={validUntil}
                    />
                    <small>Bỏ trống nếu không có ngày hết hạn.</small>
                  </label>

                  {!publishedVersion?.id && (
                    <div className="fam-note">
                      Checklist này chưa có phiên bản hoạt động. Hãy công bố phiên bản trước khi phân quyền.
                    </div>
                  )}

                  <button
                    className="fam-submit-button"
                    disabled={loading || submitting || !canCreateAssignment || availableManagers.length === 0}
                    type="submit"
                  >
                    {submitting ? <LoadingOutlined spin /> : <PlusCircleOutlined />}
                    Giao checklist
                  </button>
                </form>

                <section className="fam-card fam-card--list">
                  <div className="fam-card__header">
                    <div>
                      <h2>Manager được phân quyền</h2>
                      <p>{totalAssignments} bản ghi theo trạng thái đang lọc.</p>
                    </div>
                    <label className="fam-status-filter">
                      <span>Trạng thái</span>
                      <select
                        disabled={loading}
                        onChange={(event) => setStatus(event.target.value)}
                        value={status}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {loading ? (
                    <div className="fam-state">
                      <LoadingOutlined spin /> Đang tải danh sách phân quyền...
                    </div>
                  ) : assignments.length === 0 ? (
                    <div className="fam-state">
                      Chưa có manager nào ở trạng thái “{getStatusLabel(status)}”.
                    </div>
                  ) : (
                    <div className="fam-table-wrap">
                      <table className="fam-table">
                        <thead>
                          <tr>
                            <th>Manager</th>
                            <th>Phiên bản</th>
                            <th>Người giao</th>
                            <th>Hiệu lực</th>
                            <th>Trạng thái</th>
                            <th>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignments.map((assignment) => {
                            const active = assignment.effectiveStatus === 'ACTIVE' && assignment.itemStatus === 'ACTIVE'

                            return (
                              <tr key={assignment.assignmentItemId}>
                                <td>
                                  <strong>{getManagerName(assignment.manager)}</strong>
                                  <span>{assignment.manager?.employeeCode || 'Chưa có mã'}</span>
                                </td>
                                <td>
                                  <strong>v{assignment.versionNumber}</strong>
                                  <span>{assignment.title || form?.title}</span>
                                </td>
                                <td>
                                  <strong>{getManagerName(assignment.assignedBy)}</strong>
                                  <span>{formatDateTime(assignment.assignedAt)}</span>
                                </td>
                                <td>
                                  <span>{formatDateTime(assignment.validFrom)}</span>
                                  <span>đến {formatDateTime(assignment.validUntil)}</span>
                                </td>
                                <td>
                                  <span className={`fam-status fam-status--${assignment.effectiveStatus?.toLowerCase()}`}>
                                    {getStatusLabel(assignment.effectiveStatus)}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    className="fam-revoke-button"
                                    disabled={!active || submitting}
                                    onClick={() => setConfirmRevoke(assignment)}
                                    type="button"
                                  >
                                    <StopOutlined /> Thu hồi
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </section>
            </div>
          </main>
        </div>
      </div>

      <ConfirmModal
        danger
        isOpen={Boolean(confirmRevoke)}
        message={
          confirmRevoke
            ? `Thu hồi quyền thực hiện checklist của ${getManagerName(confirmRevoke.manager)}?`
            : ''
        }
        onCancel={() => setConfirmRevoke(null)}
        onConfirm={revokeAssignment}
        title="Thu hồi phân quyền"
      />
    </div>
  )
}

export default FormAssignmentManagementPage
