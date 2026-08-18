import { useEffect, useMemo, useState } from 'react'
import { CloseOutlined, LoadingOutlined, PlusOutlined, UserAddOutlined } from '@ant-design/icons'
import SearchableSelect from '../../../shared/components/SearchableSelect.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examAssignmentApi } from '../api/examAssignmentApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../utils/documentQuestionUi.js'

function employeeId(employee) {
  return employee?.userId
}

function ExamAssignmentAddTargetsModal({ assignment, onClose, onAdded }) {
  const { showToast } = useToast()
  const [detail, setDetail] = useState(null)
  const [employees, setEmployees] = useState([])
  const [selectedUserIds, setSelectedUserIds] = useState([])
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
            <label htmlFor="exam-assignment-add-targets-select">Nhân viên cần giao bổ sung</label>
            <SearchableSelect
              multiple
              ariaLabel="Tìm và chọn nhân viên chưa được giao"
              disabled={isLoading || isSubmitting}
              emptyMessage="Không còn nhân viên phù hợp"
              id="exam-assignment-add-targets-select"
              loading={isLoading}
              onChange={setSelectedUserIds}
              options={availableEmployees.map((employee) => ({
                value: employeeId(employee),
                label: employee.fullName || employee.name || employee.employeeCode,
                description: `${employee.employeeCode || 'Chưa có mã'}${employee.department ? ` · ${employee.department}` : ''}`,
                searchText: `${employee.employeeCode || ''} ${employee.department || ''} ${employee.position || ''}`,
              }))}
              placeholder="Tìm theo tên hoặc mã nhân viên..."
              value={validSelectedUserIds}
            />
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
