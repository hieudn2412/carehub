import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ClockCircleOutlined,
  CloseOutlined,
  LoadingOutlined,
  PlusOutlined,
  StopOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import ConfirmModal from '../../../shared/components/ConfirmModal.jsx'
import DateTimePicker24h from '../../../shared/components/DateTimePicker24h.jsx'
import { adminApi } from '../api/adminApi.js'
import '../styles/AdminQualityHistoryPage.css'

const PAGE_SIZE = 100

function getPageData(response) {
  const data = response?.data?.data
  if (Array.isArray(data)) return { content: data, totalPages: 1 }
  return {
    content: Array.isArray(data?.content) ? data.content : [],
    totalPages: Math.max(1, Number(data?.totalPages) || 1),
  }
}

async function fetchAllPages(fetcher, params = {}) {
  const firstResponse = await fetcher({ ...params, page: 0, size: PAGE_SIZE })
  const firstPage = getPageData(firstResponse)
  if (firstPage.totalPages === 1) return firstPage.content

  const remainingResponses = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) => (
      fetcher({ ...params, page: index + 1, size: PAGE_SIZE })
    )),
  )

  return [
    ...firstPage.content,
    ...remainingResponses.flatMap((response) => getPageData(response).content),
  ]
}

function getAssignee(assignment) {
  return assignment?.assignee || assignment?.manager || {}
}

function getAssigneeName(assignment) {
  const assignee = getAssignee(assignment)
  return assignee.fullName || assignee.name || assignee.employeeCode || 'Người nhận chưa có tên'
}

function filterActiveAssignments(items, versionId) {
  const uniqueAssignments = new Map()
  items.forEach((item) => {
    if (
      String(item.formVersionId) !== String(versionId)
      || item.effectiveStatus !== 'ACTIVE'
      || item.itemStatus !== 'ACTIVE'
    ) return

    const assigneeId = getAssignee(item).id
    if (assigneeId != null && !uniqueAssignments.has(String(assigneeId))) {
      uniqueAssignments.set(String(assigneeId), item)
    }
  })
  return [...uniqueAssignments.values()]
}

function getAssignmentErrorMessage(error) {
  const statusCode = error?.response?.status
  if (!error?.response) return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.'
  if (statusCode === 400) return 'Dữ liệu phân quyền không hợp lệ.'
  if (statusCode === 403) return 'Bạn không có quyền quản lý phân quyền quy trình.'
  if (statusCode === 409) return 'Người này đang có phân quyền hiệu lực cho phiên bản hiện tại.'
  return error?.response?.data?.message || 'Không thể cập nhật phân quyền. Vui lòng thử lại.'
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

function FormVersionAssignmentModal({ form, onClose, onAssignmentCountChange }) {
  const version = form?.currentPublishedVersion
  const formId = form?.id
  const versionId = version?.id
  const countChangeRef = useRef(onAssignmentCountChange)
  const [assignments, setAssignments] = useState([])
  const [users, setUsers] = useState([])
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [validUntil, setValidUntil] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [confirmRevoke, setConfirmRevoke] = useState(null)

  useEffect(() => {
    countChangeRef.current = onAssignmentCountChange
  }, [onAssignmentCountChange])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !confirmRevoke && !submitting) onClose()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [confirmRevoke, onClose, submitting])

  const loadAssignments = async () => {
    if (!formId || !versionId) {
      setAssignments([])
      countChangeRef.current?.(formId, 0)
      return
    }
    const items = await fetchAllPages(
      (params) => adminApi.getFormAssignmentsByForm(formId, params),
      { status: 'ACTIVE' },
    )
    const activeAssignments = filterActiveAssignments(items, versionId)
    setAssignments(activeAssignments)
    countChangeRef.current?.(formId, activeAssignments.length)
  }

  useEffect(() => {
    let active = true

    const loadModalData = async () => {
      setLoading(true)
      setMessage(null)
      setSelectedUserIds([])
      setValidUntil('')

      if (!versionId) {
        setAssignments([])
        setUsers([])
        setLoading(false)
        return
      }

      try {
        const [assignmentItems, activeUsers] = await Promise.all([
          fetchAllPages(
            (params) => adminApi.getFormAssignmentsByForm(formId, params),
            { status: 'ACTIVE' },
          ),
          fetchAllPages((params) => adminApi.getUsers(params), { status: 'ACTIVE' }),
        ])
        if (!active) return
        const activeAssignments = filterActiveAssignments(assignmentItems, versionId)
        setAssignments(activeAssignments)
        setUsers(activeUsers)
        countChangeRef.current?.(formId, activeAssignments.length)
      } catch (error) {
        if (active) setMessage({ type: 'error', text: getAssignmentErrorMessage(error) })
      } finally {
        if (active) setLoading(false)
      }
    }

    loadModalData()
    return () => {
      active = false
    }
  }, [formId, versionId])

  const assignedUserIds = useMemo(() => new Set(
    assignments.map((assignment) => String(getAssignee(assignment).id)),
  ), [assignments])
  const availableUsers = useMemo(() => (
    users.filter((user) => !assignedUserIds.has(String(user.id)))
  ), [assignedUserIds, users])
  const validSelectedUserIds = useMemo(() => selectedUserIds.filter((id) => (
    availableUsers.some((user) => String(user.id) === String(id))
  )), [availableUsers, selectedUserIds])
  const selectedUserOptions = useMemo(() => validSelectedUserIds
    .map((id) => users.find((user) => String(user.id) === String(id)))
    .filter(Boolean)
    .map((user) => ({
      value: user.id,
      label: user.fullName || user.name || user.employeeCode,
      description: user.employeeCode || 'Chưa có mã nhân viên',
    })), [users, validSelectedUserIds])

  const removeSelectedUser = (userId) => {
    setSelectedUserIds((current) => current.filter((id) => String(id) !== String(userId)))
  }

  const submitAssignment = async (event) => {
    event.preventDefault()
    if (validSelectedUserIds.length === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn ít nhất một người nhận.' })
      return
    }

    try {
      setSubmitting(true)
      setMessage(null)
      await adminApi.createFormAssignment({
        assigneeIds: validSelectedUserIds.map(Number),
        formVersionIds: [Number(versionId)],
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
      })
      await loadAssignments()
      setSelectedUserIds([])
      setValidUntil('')
      setMessage({
        type: 'success',
        text: `Đã thêm ${validSelectedUserIds.length} người vào danh sách phân quyền.`,
      })
    } catch (error) {
      setMessage({ type: 'error', text: getAssignmentErrorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  const revokeAssignment = async () => {
    if (!confirmRevoke?.assignmentItemId) return
    try {
      setSubmitting(true)
      setMessage(null)
      await adminApi.revokeFormAssignmentItem(confirmRevoke.assignmentItemId)
      await loadAssignments()
      setMessage({
        type: 'success',
        text: `Đã thu hồi phân quyền của ${getAssigneeName(confirmRevoke)}.`,
      })
      setConfirmRevoke(null)
    } catch (error) {
      setMessage({ type: 'error', text: getAssignmentErrorMessage(error) })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div
        className="aqh-manager-modal-overlay"
        onMouseDown={() => {
          if (!submitting && !confirmRevoke) onClose()
        }}
        role="presentation"
      >
        <section
          aria-labelledby="form-version-assignment-title"
          aria-modal="true"
          className="aqh-manager-modal"
          onMouseDown={(event) => event.stopPropagation()}
          role="dialog"
        >
          <header className="aqh-manager-modal__header">
            <div>
              <span>PHÂN QUYỀN PHIÊN BẢN {version ? `v${version.versionNumber}` : ''}</span>
              <h2 id="form-version-assignment-title">Manager được giao</h2>
              <p>Thêm hoặc thu hồi người được phép thực hiện quy trình này.</p>
            </div>
            <button
              aria-label="Đóng cửa sổ quản lý phân quyền"
              className="aqh-manager-modal__close"
              disabled={submitting}
              onClick={onClose}
              type="button"
            >
              <CloseOutlined />
            </button>
          </header>

          <div className="aqh-manager-modal__body">
            {!versionId ? (
              <div className="aqh-manager-modal__notice">
                Quy trình chưa có phiên bản được công bố nên chưa thể phân quyền.
              </div>
            ) : (
              <form className="aqh-manager-assign" onSubmit={submitAssignment}>
                <div className="aqh-manager-assign__field aqh-manager-assign__field--people">
                  <label htmlFor="form-version-assignee-search">Người nhận mới</label>
                  <SearchableSelect
                    multiple
                    ariaLabel="Tìm và chọn người nhận mới"
                    disabled={loading || submitting}
                    emptyMessage="Không còn người nhận phù hợp"
                    id="form-version-assignee-search"
                    onChange={setSelectedUserIds}
                    options={availableUsers.map((user) => ({
                      value: user.id,
                      label: user.fullName || user.name || user.employeeCode,
                      description: user.employeeCode,
                    }))}
                    placeholder="Tìm theo tên hoặc mã nhân viên..."
                    selectedOptions={selectedUserOptions}
                    showSelectedChips={false}
                    value={validSelectedUserIds}
                  />
                </div>
                <div className="aqh-manager-assign__field">
                  <label htmlFor="form-version-assignment-valid-until">Hiệu lực đến</label>
                  <DateTimePicker24h
                    id="form-version-assignment-valid-until"
                    onChange={setValidUntil}
                    value={validUntil}
                  />
                </div>
                <div className="aqh-manager-selected-box" aria-label="Danh sách người nhận đã chọn">
                  <div className="aqh-manager-selected-box__header">
                    <span>Đã chọn</span>
                    <strong>{selectedUserOptions.length}</strong>
                  </div>
                  {selectedUserOptions.length > 0 ? (
                    <div className="aqh-manager-selected-box__list">
                      {selectedUserOptions.map((user) => (
                        <article key={user.value}>
                          <span className="aqh-manager-selected-box__identity">
                            <strong>{user.label}</strong>
                          </span>
                          <button type="button" aria-label={`Bỏ chọn ${user.label}`} onClick={() => removeSelectedUser(user.value)}>×</button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>Chưa chọn người nhận nào.</p>
                  )}
                </div>
                <button
                  className="aqh-manager-assign__submit"
                  disabled={loading || submitting || validSelectedUserIds.length === 0}
                  type="submit"
                >
                  {submitting ? <LoadingOutlined spin /> : <PlusOutlined />}
                  Thêm người nhận
                </button>
              </form>
            )}

            {message && (
              <div className={`aqh-manager-message aqh-manager-message--${message.type}`} role="status">
                {message.text}
              </div>
            )}

            <div className="aqh-manager-modal__list-heading">
              <div>
                <h3>Danh sách đang hiệu lực</h3>
                <p>{assignments.length} người đang được giao</p>
              </div>
            </div>

            {loading ? (
              <div className="aqh-results-loading"><LoadingOutlined spin /><span>Đang tải danh sách...</span></div>
            ) : assignments.length === 0 ? (
              <div className="aqh-manager-empty">
                <UserSwitchOutlined />
                <strong>Chưa có người được giao</strong>
                <span>Chọn người nhận ở phía trên để thêm phân quyền.</span>
              </div>
            ) : (
              <div className="aqh-manager-modal__list">
                {assignments.map((assignment) => {
                  const assignee = getAssignee(assignment)
                  const name = getAssigneeName(assignment)
                  return (
                    <article key={assignment.assignmentItemId || assignment.id}>
                      <div className="aqh-manager-avatar">{name.charAt(0).toUpperCase()}</div>
                      <div className="aqh-manager-identity">
                        <strong>{name}</strong>
                        <span>{assignee.employeeCode || assignee.username || '—'}</span>
                      </div>
                      <div className="aqh-manager-validity">
                        <ClockCircleOutlined />
                        <span>{assignment.validUntil ? `Đến ${formatDateTime(assignment.validUntil)}` : 'Không giới hạn'}</span>
                      </div>
                      <button
                        className="aqh-manager-revoke"
                        disabled={submitting}
                        onClick={() => setConfirmRevoke(assignment)}
                        type="button"
                      >
                        <StopOutlined /> Thu hồi
                      </button>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <ConfirmModal
        danger
        isOpen={Boolean(confirmRevoke)}
        message={confirmRevoke ? `Thu hồi quyền thực hiện quy trình của ${getAssigneeName(confirmRevoke)}?` : ''}
        onCancel={() => setConfirmRevoke(null)}
        onConfirm={revokeAssignment}
        title="Thu hồi phân quyền"
      />
    </>
  )
}

export default FormVersionAssignmentModal
