import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PaperClipOutlined,
  SendOutlined,
} from '@ant-design/icons'
import {
  formatTrainingDate,
  formatTrainingHours,
  getTrainingStatusLabel,
  getTrainingStatusTone,
} from '../utils/trainingRecordFormatters.js'

const DEFAULT_COLUMNS = ['date', 'title', 'hours', 'submitted', 'evidence', 'actions']
const DEFAULT_ACTIONS = {
  submit: true,
  view: true,
  edit: true,
  delete: true,
  evidence: true,
}
const COLUMN_DEFINITIONS = {
  date: { header: 'Ngày đào tạo liên tục' },
  title: { header: 'Nội dung đào tạo' },
  hours: { header: 'Số giờ đào tạo', className: 'th-col-num' },
  submitted: { header: 'Ngày nộp', className: 'th-col-submitted' },
  evidence: { header: 'Minh chứng', className: 'th-col-center' },
  actions: { header: 'Hành động', className: 'th-col-actions' },
}

function isConfiguredActionVisible(actions, action, record) {
  if (Array.isArray(actions)) return actions.includes(action)
  const configuredValue = actions[action]
  if (typeof configuredValue === 'function') return configuredValue(record)
  return configuredValue !== false
}

function TrainingRecordTable({
  records = [],
  columns = DEFAULT_COLUMNS,
  actions = DEFAULT_ACTIONS,
  onRowClick,
  onSubmit,
  submittingId,
  onView,
  onEdit,
  onDelete,
  deletingId,
  onEvidence,
  onBodyScroll,
}) {
  const resolvedActions = Array.isArray(actions)
    ? actions
    : { ...DEFAULT_ACTIONS, ...actions }
  const resolvedColumns = columns.filter(column => COLUMN_DEFINITIONS[column])

  const handleRowClick = (record) => {
    onRowClick?.(record)
  }

  const renderCell = (column, record) => {
    switch (column) {
      case 'date':
        return (
          <td key={column} data-label="Ngày bắt đầu">
            <span className="th-training-date">{formatTrainingDate(record.startDate)}</span>
            {record.expired && (
              <span className="th-expired-tag" title={`Hết hạn từ ${formatTrainingDate(record.validUntil)}`}>
                Hết hạn
              </span>
            )}
          </td>
        )
      case 'title':
        return (
          <td key={column} data-label="Khóa đào tạo">
            <span className="th-record-title">{record.title}</span>
            {record.professionalFieldName && (
              <span className="th-record-provider">{record.professionalFieldName}</span>
            )}
          </td>
        )
      case 'hours':
        return (
          <td key={column} className="th-col-num" data-label="Số giờ">
            <strong>{formatTrainingHours(record.declaredHours)}</strong>
          </td>
        )
      case 'submitted':
        return (
          <td key={column} className="th-col-submitted" data-label="Ngày nộp">
            {record.workflowStatus === 'SUBMITTED' ? (
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                {formatTrainingDate(record.submittedAt)}
              </span>
            ) : (
              <span className={`th-badge th-badge--${getTrainingStatusTone(record.workflowStatus)}`}>
                {getTrainingStatusLabel(record.workflowStatus)}
              </span>
            )}
          </td>
        )
      case 'evidence':
        return (
          <td key={column} className="th-col-center" data-label="Minh chứng">
            {record.evidenceCount > 0 ? (
              <span className="th-evidence-count">
                <PaperClipOutlined /> {record.evidenceCount}
              </span>
            ) : (
              <span className="th-evidence-none">-</span>
            )}
          </td>
        )
      case 'actions':
        return (
          <td key={column} className="th-col-actions" data-label="Hành động">
            <div className="th-actions admin-table-actions" onClick={event => event.stopPropagation()}>
              {record.workflowStatus === 'DRAFT'
                && isConfiguredActionVisible(resolvedActions, 'submit', record)
                && onSubmit && (
                <button
                  className="th-action-btn th-action-btn--submit admin-table-action admin-table-action--icon admin-table-action--success"
                  onClick={() => onSubmit(record)}
                  disabled={submittingId === record.id}
                  title="Nộp hồ sơ"
                  aria-label={`Nộp hồ sơ ${record.title}`}
                >
                  <SendOutlined />
                </button>
              )}
              {isConfiguredActionVisible(resolvedActions, 'view', record) && onView && (
                <button
                  className="th-action-btn th-action-btn--view admin-table-action admin-table-action--icon admin-table-action--primary"
                  onClick={() => onView(record)}
                  title="Xem chi tiết"
                  aria-label={`Xem chi tiết ${record.title}`}
                >
                  <EyeOutlined />
                </button>
              )}
              {record.workflowStatus === 'DRAFT'
                && isConfiguredActionVisible(resolvedActions, 'edit', record)
                && onEdit && (
                <button
                  className="th-action-btn th-action-btn--edit admin-table-action admin-table-action--icon"
                  onClick={() => onEdit(record)}
                  title="Chỉnh sửa"
                  aria-label={`Chỉnh sửa ${record.title}`}
                >
                  <EditOutlined />
                </button>
              )}
              {record.workflowStatus === 'DRAFT'
                && isConfiguredActionVisible(resolvedActions, 'delete', record)
                && onDelete && (
                <button
                  className="th-action-btn admin-table-action admin-table-action--icon admin-table-action--danger"
                  onClick={() => onDelete(record)}
                  disabled={deletingId === record.id}
                  title="Xóa hồ sơ"
                  aria-label={`Xóa hồ sơ ${record.title}`}
                >
                  <DeleteOutlined />
                </button>
              )}
              {isConfiguredActionVisible(resolvedActions, 'evidence', record) && onEvidence && (
                <button
                  className="th-action-btn th-action-btn--evidence admin-table-action admin-table-action--icon"
                  onClick={() => onEvidence(record)}
                  title="Minh chứng"
                  aria-label={`Quản lý minh chứng ${record.title}`}
                >
                  <PaperClipOutlined />
                </button>
              )}
            </div>
          </td>
        )
      default:
        return null
    }
  }

  return (
    <table className="th-table admin-table-uppercase">
      <thead>
        <tr>
          {resolvedColumns.map(column => (
            <th key={column} className={COLUMN_DEFINITIONS[column].className}>
              {COLUMN_DEFINITIONS[column].header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody onScroll={onBodyScroll}>
        {records.map(record => (
          <tr
            key={record.id}
            onClick={() => handleRowClick(record)}
            className={onRowClick ? 'th-clickable-row' : undefined}
          >
            {resolvedColumns.map(column => renderCell(column, record))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default TrainingRecordTable
