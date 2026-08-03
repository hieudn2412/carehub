export function formatTrainingDate(dateValue) {
  if (!dateValue) return '-'

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return '-'

  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

export function formatTrainingHours(hours) {
  if (hours == null || hours === '') return '-'
  return `${hours}h`
}

export function getTrainingStatusLabel(workflowStatus) {
  return {
    DRAFT: 'Bản nháp',
    SUBMITTED: 'Đã nộp',
    CANCELLED: 'Đã hủy',
  }[workflowStatus] || workflowStatus || '-'
}

export function getTrainingStatusTone(workflowStatus) {
  return workflowStatus === 'CANCELLED' ? 'danger' : 'warning'
}
