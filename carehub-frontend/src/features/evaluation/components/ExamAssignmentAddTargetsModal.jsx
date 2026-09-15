import { useEffect, useMemo, useState } from 'react'
import { CloseOutlined, LoadingOutlined, PlusOutlined, UserAddOutlined } from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examAssignmentApi } from '../api/examAssignmentApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../utils/documentQuestionUi.js'

function employeeId(employee) {
  return employee?.userId ?? employee?.id
}

function ExamAssignmentAddTargetsModal({ assignment, onClose, onAdded }) {
  const { showToast } = useToast()
  const [detail, setDetail] = useState(null)
  const [employees, setEmployees] = useState([])
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [employeeCodeQuery, setEmployeeCodeQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !isSubmitting) onClose()
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isSubmitting, onClose])

  useEffect(() => {
    let active = true
    setIsLoading(true)
    Promise.all([
      examAssignmentApi.getAssignment(assignment.id),
      examAssignmentApi.listTargetCandidates(assignment.id),
    ]).then(([detailResponse, availableEmployees]) => {
      if (!active) return
      setDetail(apiData(detailResponse, assignment))
      setEmployees(apiData(availableEmployees, []))
    }).catch((error) => {
      if (active) showToast(apiErrorMessage(error), 'error')
    }).finally(() => {
      if (active) setIsLoading(false)
    })
    return () => {
      active = false
    }
  }, [assignment, showToast])

  const assignedUserIds = useMemo(() => new Set(
    (detail?.targets || []).map((target) => String(target.userId)),
  ), [detail])
  const availableEmployees = useMemo(() => (
    employees.filter((employee) => !assignedUserIds.has(String(employeeId(employee))))
  ), [assignedUserIds, employees])
  const validSelectedUserIds = selectedUserIds.filter((id) => (
    availableEmployees.some((employee) => String(employeeId(employee)) === String(id))
  ))
  const departmentOptions = useMemo(() => (
    [...new Set(availableEmployees.map((employee) => employee.department).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'vi'))
      .map((department) => ({ value: department, label: department }))
  ), [availableEmployees])
  const positionOptions = useMemo(() => (
    [...new Set(availableEmployees.map((employee) => employee.position).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'vi'))
      .map((position) => ({ value: position, label: position }))
  ), [availableEmployees])
  const filteredAvailableEmployees = useMemo(() => {
    const normalizedQuery = employeeCodeQuery.trim().toLowerCase()
    return availableEmployees.filter((employee) => (
      (!normalizedQuery || [employee.employeeCode, employee.fullName, employee.name, employee.department, employee.position]
        .some((value) => String(value || '').toLowerCase().includes(normalizedQuery)))
      && (!departmentFilter || employee.department === departmentFilter)
      && (!positionFilter || employee.position === positionFilter)
    ))
  }, [availableEmployees, departmentFilter, employeeCodeQuery, positionFilter])

  function toggleEmployee(employee) {
    const id = String(employeeId(employee))
    setSelectedUserIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id])
  }

  async function submit(event) {
    event.preventDefault()
    if (validSelectedUserIds.length === 0) return
    try {
      setIsSubmitting(true)
      await examAssignmentApi.addTargets(assignment.id, {
        userIds: validSelectedUserIds.map(Number),
      })
      await onAdded(validSelectedUserIds.length)
      showToast(`Đã giao bổ sung cho ${validSelectedUserIds.length} nhân viên.`, 'success')
      onClose()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="exp-assignment-modal-overlay"
      onMouseDown={() => {
        if (!isSubmitting) onClose()
      }}
      role="presentation"
    >
      <section
        aria-labelledby="exam-assignment-add-targets-title"
        aria-modal="true"
        className="exp-assignment-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="exp-assignment-modal__header">
          <div>
            <span className="exp-assignment-modal__eyebrow"><UserAddOutlined /> GIAO BỔ SUNG</span>
            <h2 id="exam-assignment-add-targets-title">Thêm nhân viên vào đợt giao đề</h2>
            <p>{assignment.name}</p>
          </div>
          <button
            aria-label="Đóng cửa sổ giao bổ sung"
            className="exp-assignment-modal__close"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            <CloseOutlined />
          </button>
        </header>

        <div className="exp-assignment-modal__body">
          <div className="exp-assignment-modal__info">
            <span>Đang giao: <strong>{detail?.targetCount ?? assignment.targetCount ?? 0}</strong> nhân viên</span>
            <span>Hạn nộp: <strong>{formatDateTime(assignment.dueAt)}</strong></span>
          </div>
          <p className="exp-assignment-modal__hint">
            Chỉ những nhân viên chưa có trong đợt này mới xuất hiện. Người được thêm sẽ nhận cùng bộ đề, số lượt và hạn nộp của đợt hiện tại.
          </p>

          <form className="exp-assignment-modal__form" onSubmit={submit}>
            <div className="exp-assignment-modal__filters" aria-label="Bộ lọc nhân viên giao bổ sung">
              <label className="exp-assignment-modal__filter-field" htmlFor="exam-assignment-add-targets-code">
                <span>Mã nhân viên</span>
                <input
                  id="exam-assignment-add-targets-code"
                  type="search"
                  value={employeeCodeQuery}
                  onChange={(event) => setEmployeeCodeQuery(event.target.value)}
                  placeholder="Tìm theo tên hoặc mã nhân viên..."
                  disabled={isLoading || isSubmitting}
                />
              </label>
              <label className="exp-assignment-modal__filter-field" htmlFor="exam-assignment-add-targets-department">
                <span>Khoa/phòng</span>
                <select id="exam-assignment-add-targets-department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} disabled={isLoading || isSubmitting}>
                  <option value="">Tất cả khoa/phòng</option>
                  {departmentOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="exp-assignment-modal__filter-field" htmlFor="exam-assignment-add-targets-position">
                <span>Chức danh</span>
                <select id="exam-assignment-add-targets-position" value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)} disabled={isLoading || isSubmitting}>
                  <option value="">Tất cả chức danh</option>
                  {positionOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <div className="exp-assignment-modal__selection-meta">
              <span className="exp-assignment-modal__selection-label">Nhân viên cần giao bổ sung</span>
              <span>{filteredAvailableEmployees.length} nhân viên phù hợp</span>
            </div>
            <div id="exam-assignment-add-targets-select" className="exp-assignment-modal__employee-list" role="listbox" aria-label="Nhân viên chưa được giao">
              {isLoading ? <div className="exp-empty"><LoadingOutlined spin /> Đang tải nhân viên...</div> : filteredAvailableEmployees.length === 0 ? (
                <div className="exp-empty">Không còn nhân viên phù hợp.</div>
              ) : filteredAvailableEmployees.map((employee) => {
                const id = String(employeeId(employee))
                return (
                  <label className="exp-assignment-modal__employee-option" key={id}>
                    <input type="checkbox" checked={validSelectedUserIds.includes(id)} onChange={() => toggleEmployee(employee)} disabled={isSubmitting} />
                    <span><strong>{employee.fullName || employee.name || 'Chưa có tên'}</strong><small>{employee.employeeCode || 'Chưa có mã'}{employee.department ? ` · ${employee.department}` : ''}{employee.position ? ` · ${employee.position}` : ''}</small></span>
                  </label>
                )
              })}
            </div>
            <div className="exp-assignment-modal__footer">
              <span>{validSelectedUserIds.length} nhân viên được chọn</span>
              <button
                className="exp-btn-primary"
                disabled={isLoading || isSubmitting || validSelectedUserIds.length === 0}
                type="submit"
              >
                {isSubmitting ? <LoadingOutlined spin /> : <PlusOutlined />}
                Giao bổ sung
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}

export default ExamAssignmentAddTargetsModal
