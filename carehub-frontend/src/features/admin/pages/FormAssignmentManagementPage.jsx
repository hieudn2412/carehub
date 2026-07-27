import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ExclamationCircleOutlined,
  LoadingOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
  StopOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
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
  const [form, setForm] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [activeAssignments, setActiveAssignments] = useState([])
  const [managers, setManagers] = useState([])
  const [selectedManagerIds, setSelectedManagerIds] = useState([])
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
    const managersResponse = await adminApi.getUsers({
      page: 0,
      size: 100,
      status: 'ACTIVE',
    })

    return getPageContent(managersResponse)
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage('')

      const assignmentsRequest = adminApi.getFormAssignmentsByForm(id, {
        page: 0,
        size: 100,
        status,
      })
      const activeAssignmentsRequest = status === 'ACTIVE'
        ? assignmentsRequest
        : adminApi.getFormAssignmentsByForm(id, {
            page: 0,
            size: 100,
            status: 'ACTIVE',
          })

      const [formResponse, assignmentsResponse, activeAssignmentsResponse, managerContent] = await Promise.all([
        adminApi.getFormById(id),
        assignmentsRequest,
        activeAssignmentsRequest,
        loadManagers(),
      ])

      const nextForm = formResponse.data?.data || null
      setForm(nextForm)
      setAssignments(getPageContent(assignmentsResponse))
      setActiveAssignments(getPageContent(activeAssignmentsResponse))
      setTotalAssignments(getPageTotalElements(assignmentsResponse))
      setManagers(managerContent)
      setSelectedManagerIds(current => current.filter(value => managerContent.some(user => String(user.id) === value)))
    } catch (error) {
      setForm(null)
      setAssignments([])
      setActiveAssignments([])
      setTotalAssignments(0)
      setManagers([])
      setSelectedManagerIds([])
      setErrorMessage(
        getAssignmentErrorMessage(error),
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

  const assignedCurrentVersionManagerIds = useMemo(() => (
    new Set(
      activeAssignments
        .filter((assignment) => (
          String(assignment.formVersionId) === String(publishedVersion?.id)
          && assignment.effectiveStatus === 'ACTIVE'
          && assignment.itemStatus === 'ACTIVE'
        ))
        .map((assignment) => String(assignment.manager?.id)),
    )
  ), [activeAssignments, publishedVersion?.id])

  const availableManagers = useMemo(() => (
    managers.filter((manager) => !assignedCurrentVersionManagerIds.has(String(manager.id)))
  ), [assignedCurrentVersionManagerIds, managers])

  const effectiveSelectedManagerIds = selectedManagerIds.filter(value => availableManagers.some(user => String(user.id) === value))
  const canCreateAssignment = Boolean(publishedVersion?.id && effectiveSelectedManagerIds.length > 0)

  const submitAssignment = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!publishedVersion?.id) {
      setErrorMessage('Checklist này chưa có phiên bản đã công bố nên chưa thể phân quyền.')
      return
    }

    if (effectiveSelectedManagerIds.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất một người nhận.')
      return
    }

    try {
      setSubmitting(true)
      await adminApi.createFormAssignment({
        assigneeIds: effectiveSelectedManagerIds.map(Number),
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
        formVersionIds: [Number(publishedVersion.id)],
      })

      setSuccessMessage(`Đã giao biểu mẫu cho ${effectiveSelectedManagerIds.length} người nhận.`)
      setValidUntil('')
      setSelectedManagerIds([])
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
    <AppShell back={{ to: `/admin/quality/checklists/${id}/detail`, label: 'Quay lại' }} breadcrumbs={breadcrumbs}>
            <div className="fam-page">
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
                      <h2>Giao người thực hiện</h2>
                      <p>Chọn một hoặc nhiều tài khoản đang hoạt động.</p>
                    </div>
                    <UserSwitchOutlined />
                  </div>

                  {!publishedVersion?.id && (
                    <div className="fam-note">
                      Checklist này chưa có phiên bản hoạt động. Hãy công bố phiên bản trước khi phân quyền.
                    </div>
                  )}

                  <div className="fam-form-fields">
                    <div className="fam-field">
                      <span>Người nhận</span>
                      <SearchableSelect
                        multiple
                        disabled={loading || submitting || !publishedVersion?.id}
                        onChange={setSelectedManagerIds}
                        options={availableManagers.map((manager) => ({
                          value: manager.id,
                          label: getManagerName(manager) + (manager.employeeCode ? ' (' + manager.employeeCode + ')' : ''),
                          description: manager.departmentName || manager.department?.name || 'Chưa có khoa/phòng',
                        }))}
                        placeholder="Tìm theo tên hoặc mã nhân viên..."
                        emptyMessage="Không tìm thấy người nhận phù hợp"
                        ariaLabel="Tìm và chọn nhiều người nhận"
                        value={effectiveSelectedManagerIds}
                      />
                      <small>
                        {effectiveSelectedManagerIds.length > 0
                          ? 'Đã chọn ' + effectiveSelectedManagerIds.length + ' người nhận.'
                          : 'Gõ tên hoặc mã nhân viên để tìm và chọn nhiều người.'}
                      </small>
                    </div>

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

                    <button
                      className="fam-submit-button"
                      disabled={loading || submitting || !canCreateAssignment || availableManagers.length === 0}
                      type="submit"
                    >
                      {submitting ? <LoadingOutlined spin /> : <PlusCircleOutlined />}
                      Giao biểu mẫu
                    </button>
                  </div>
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
                    <div className="fam-assignment-list" role="table" aria-label="Danh sách manager được phân quyền">
                      <div className="fam-assignment-list__head" role="row">
                        <span role="columnheader">Manager</span>
                        <span role="columnheader">Phiên bản</span>
                        <span role="columnheader">Người giao</span>
                        <span role="columnheader">Hiệu lực</span>
                        <span role="columnheader">Trạng thái</span>
                        <span role="columnheader" aria-label="Thao tác" />
                      </div>
                      {assignments.map((assignment) => {
                        const active = assignment.effectiveStatus === 'ACTIVE' && assignment.itemStatus === 'ACTIVE'
                        const managerName = getManagerName(assignment.manager)

                        return (
                          <div className="fam-assignment-row" key={assignment.assignmentItemId} role="row">
                            <div className="fam-assignment-person" role="cell">
                              <span className="fam-assignment-avatar" aria-hidden="true">
                                {managerName.charAt(0).toUpperCase()}
                              </span>
                              <div>
                                <strong>{managerName}</strong>
                                <span>{assignment.manager?.employeeCode || 'Chưa có mã nhân viên'}</span>
                              </div>
                            </div>
                            <div className="fam-assignment-cell" data-label="Phiên bản" role="cell">
                              <strong>v{assignment.versionNumber}</strong>
                            </div>
                            <div className="fam-assignment-cell" data-label="Người giao" role="cell">
                              <strong>{getManagerName(assignment.assignedBy)}</strong>
                              <small>{formatDateTime(assignment.assignedAt)}</small>
                            </div>
                            <div className="fam-assignment-cell" data-label="Hiệu lực" role="cell">
                              <strong>{formatDateTime(assignment.validFrom)}</strong>
                              <small>Đến {formatDateTime(assignment.validUntil)}</small>
                            </div>
                            <div className="fam-assignment-cell fam-assignment-cell--status" role="cell">
                              <span className={'fam-status fam-status--' + assignment.effectiveStatus?.toLowerCase()}>
                                {getStatusLabel(assignment.effectiveStatus)}
                              </span>
                            </div>
                            <div className="fam-assignment-cell fam-assignment-cell--action" role="cell">
                              <button
                                className="fam-revoke-button"
                                disabled={!active || submitting}
                                onClick={() => setConfirmRevoke(assignment)}
                                type="button"
                              >
                                <StopOutlined /> Thu hồi
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              </section>
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
    </AppShell>
  )
}

export default FormAssignmentManagementPage
