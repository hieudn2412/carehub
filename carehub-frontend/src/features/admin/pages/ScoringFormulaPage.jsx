import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalculatorOutlined,
  CheckCircleOutlined,
  EditOutlined,
  LoadingOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import AdminHeader from '../components/AdminHeader.jsx'
import AdminSidebar from '../components/AdminSidebar.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { adminApi } from '../api/adminApi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import '../styles/ScoringFormulaPage.css'

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'DRAFT', label: 'Bản nháp' },
  { value: 'PUBLISHED', label: 'Đang hoạt động' },
  { value: 'RETIRED', label: 'Đã retired' },
]
const ACTIVE_JOB_STATUSES = new Set(['PENDING', 'RUNNING'])

function statusLabel(status) {
  if (status === 'PUBLISHED') return 'Đang hoạt động'
  if (status === 'RETIRED') return 'Đã retired'
  return 'Bản nháp'
}

function jobLabel(status) {
  if (status === 'PENDING') return 'Đang chờ'
  if (status === 'RUNNING') return 'Đang tính lại'
  if (status === 'COMPLETED') return 'Đã đồng bộ'
  if (status === 'FAILED') return 'Tính lại thất bại'
  return 'Chưa phát sinh'
}

function displayScore(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toFixed(1) : 'Chưa tính được'
}

function isValidPassingScore(value) {
  const text = String(value).trim()
  const parsed = Number(text)
  return /^\d+(\.\d)?$/.test(text) && parsed >= 0 && parsed <= 10
}

function ScoringFormulaPage() {
  const { showToast } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [editing, setEditing] = useState(null)
  const [criticalWeight, setCriticalWeight] = useState(60)
  const [passingMode, setPassingMode] = useState('DEFAULT')
  const [passingScore, setPassingScore] = useState('8.0')
  const [saving, setSaving] = useState(false)
  const [confirmSave, setConfirmSave] = useState(false)

  const loadRows = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      setErrorMessage('')
      const response = await adminApi.getFormScoringConfigurations({
        keyword: search || undefined,
        status: status || undefined,
        page,
        size: 20,
        sort: 'updatedAt,desc',
      })
      const data = response.data?.data
      setRows(Array.isArray(data?.content) ? data.content : [])
      setTotalPages(Math.max(Number(data?.totalPages) || 1, 1))
      setTotalElements(Number(data?.totalElements) || 0)
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Không thể tải cấu hình công thức chỉ số.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => {
    const timer = window.setTimeout(() => loadRows(), 0)
    return () => window.clearTimeout(timer)
  }, [loadRows])

  const hasActiveJobs = useMemo(() => rows.some((row) => (
    ACTIVE_JOB_STATUSES.has(row.latestJob?.status)
  )), [rows])

  useEffect(() => {
    if (!hasActiveJobs) return undefined
    const timer = window.setInterval(() => loadRows({ silent: true }), 3000)
    return () => window.clearInterval(timer)
  }, [hasActiveJobs, loadRows])

  const openEditor = (row) => {
    setEditing(row)
    setCriticalWeight(Number(row.criticalWeightPercent) || 0)
    setPassingMode(row.passingScoreMode || 'DEFAULT')
    setPassingScore(row.passingScoreOverride ?? row.passingScore ?? '8.0')
  }

  const executeSave = async () => {
    if (!editing) return
    const numericCriticalWeight = Number(criticalWeight)
    if (editing.canEditCriticalWeight
      && (!Number.isInteger(numericCriticalWeight) || numericCriticalWeight < 0 || numericCriticalWeight > 100)) {
      setErrorMessage('Tỷ trọng câu trọng yếu phải là số nguyên từ 0 đến 100.')
      return
    }
    if (passingMode === 'CUSTOM' && !isValidPassingScore(passingScore)) {
      setErrorMessage('Điểm sàn phải từ 0 đến 10 và có tối đa một chữ số thập phân.')
      return
    }
    try {
      setSaving(true)
      setErrorMessage('')
      const response = await adminApi.updateFormScoringConfiguration(editing.formId, editing.versionId, {
        ...(editing.canEditCriticalWeight ? { criticalWeightPercent: numericCriticalWeight } : {}),
        passingScore: passingMode === 'CUSTOM'
          ? { mode: 'CUSTOM', value: Number(passingScore) }
          : { mode: 'DEFAULT', value: null },
        lockVersion: editing.lockVersion,
      })
      const result = response.data?.data
      showToast(result?.recalculationScheduled
        ? 'Đã tạo tác vụ tính lại kết quả.'
        : 'Đã cập nhật công thức tính điểm.', 'success')
      setEditing(null)
      await loadRows({ silent: true })
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Không thể cập nhật công thức tính điểm.')
    } finally {
      setSaving(false)
      setConfirmSave(false)
    }
  }

  const requestSave = () => {
    if (editing?.versionStatus !== 'DRAFT') {
      setConfirmSave(true)
      return
    }
    executeSave()
  }

  const retryJob = async (jobId) => {
    try {
      await adminApi.retryFormScoringRecalculationJob(jobId)
      showToast('Đã đưa tác vụ tính lại vào hàng chờ.', 'success')
      await loadRows({ silent: true })
    } catch (error) {
      showToast(error.response?.data?.message || 'Không thể chạy lại tác vụ.', 'error')
    }
  }

  return (
    <div className="dashboard-layout scoring-formula-page">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader
          title="Công thức chỉ số"
          breadcrumbs={[{ label: 'Chất lượng' }, { label: 'Công thức chỉ số' }]}
        />
        <main className="sfp-main">
          <header className="sfp-heading">
            <div>
              <span className="sfp-eyebrow"><CalculatorOutlined /> QUẢN TRỊ CÔNG THỨC</span>
              <h1>Tỷ trọng và điểm sàn theo phiên bản</h1>
              <p>Kiểm soát cách tính kết quả mà không làm thay đổi cấu trúc bảng kiểm đã công bố.</p>
            </div>
            <div className="sfp-count"><strong>{totalElements}</strong><span>phiên bản</span></div>
          </header>

          <section className="sfp-toolbar" aria-label="Bộ lọc công thức">
            <form onSubmit={(event) => { event.preventDefault(); setPage(0); setSearch(keyword.trim()) }}>
              <SearchOutlined />
              <input
                aria-label="Tìm bảng kiểm hoặc phiên bản"
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Tìm theo mã hoặc tên bảng kiểm..."
                value={keyword}
              />
              <button type="submit">Tìm kiếm</button>
            </form>
            <label>
              <span>Trạng thái</span>
              <select value={status} onChange={(event) => { setPage(0); setStatus(event.target.value) }}>
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <button className="sfp-refresh" onClick={() => loadRows()} title="Tải lại dữ liệu" type="button">
              <ReloadOutlined />
            </button>
          </section>

          {errorMessage && <div className="sfp-alert"><WarningOutlined /> {errorMessage}</div>}

          <section className="sfp-table-wrap">
            {loading ? (
              <div className="sfp-state"><LoadingOutlined /> Đang tải công thức...</div>
            ) : rows.length === 0 ? (
              <div className="sfp-state"><CalculatorOutlined /><strong>Không có phiên bản phù hợp</strong></div>
            ) : (
              <table className="sfp-table">
                <thead><tr>
                  <th>Bảng kiểm</th><th>Phiên bản</th><th>Tỷ trọng</th><th>Điểm sàn</th>
                  <th>Bài đã nộp</th><th>Đồng bộ kết quả</th><th aria-label="Hành động" />
                </tr></thead>
                <tbody>{rows.map((row) => {
                  const jobStatus = row.latestJob?.status
                  return (
                    <tr key={row.versionId}>
                      <td><strong>{row.formTitle}</strong><span>{row.formCode}</span></td>
                      <td><b>v{row.versionNumber}</b><span className={`sfp-status is-${row.versionStatus?.toLowerCase()}`}>{statusLabel(row.versionStatus)}</span></td>
                      <td><div className="sfp-ratio"><b>{row.criticalWeightPercent}%</b><i style={{ '--critical-share': `${row.criticalWeightPercent}%` }} /><span>{row.normalWeightPercent}%</span></div><small>Trọng yếu / Thường</small></td>
                      <td><strong>{displayScore(row.passingScore)}/10</strong><span>{row.passingScoreMode === 'CUSTOM' ? 'Tùy chỉnh' : 'Công thức mặc định'}</span></td>
                      <td><strong>{row.submittedCount}</strong><span>kết quả</span></td>
                      <td><span className={`sfp-job is-${(jobStatus || 'none').toLowerCase()}`}>{ACTIVE_JOB_STATUSES.has(jobStatus) && <LoadingOutlined />}{jobStatus === 'COMPLETED' && <CheckCircleOutlined />}{jobStatus === 'FAILED' && <WarningOutlined />}{jobLabel(jobStatus)}</span>{jobStatus === 'FAILED' && <button className="sfp-retry" onClick={() => retryJob(row.latestJob.id)} type="button">Thử lại</button>}</td>
                      <td><button className="sfp-edit" disabled={ACTIVE_JOB_STATUSES.has(jobStatus)} onClick={() => openEditor(row)} title="Chỉnh công thức" type="button"><EditOutlined /></button></td>
                    </tr>
                  )
                })}</tbody>
              </table>
            )}
          </section>

          <nav className="sfp-pagination" aria-label="Phân trang">
            <button disabled={page === 0} onClick={() => setPage((value) => value - 1)} type="button">Trước</button>
            <span>Trang {page + 1} / {totalPages}</span>
            <button disabled={page + 1 >= totalPages} onClick={() => setPage((value) => value + 1)} type="button">Sau</button>
          </nav>
        </main>
      </div>

      {editing && (
        <div className="sfp-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditing(null) }}>
          <section className="sfp-modal" role="dialog" aria-modal="true" aria-labelledby="scoring-modal-title">
            <header><span><SettingOutlined /> CẤU HÌNH VERSION</span><h2 id="scoring-modal-title">{editing.formTitle} · v{editing.versionNumber}</h2><p>{statusLabel(editing.versionStatus)}</p></header>
            <div className={`sfp-setting ${editing.canEditCriticalWeight ? '' : 'is-locked'}`}>
              <div><strong>Tỷ trọng nhóm câu hỏi</strong><p>Nhóm thường tự động nhận phần tỷ trọng còn lại.</p></div>
              <div className="sfp-weight-input"><label>Trọng yếu<input disabled={!editing.canEditCriticalWeight} min="0" max="100" step="1" type="number" value={criticalWeight} onChange={(event) => setCriticalWeight(event.target.value)} /></label><span><small>Thường</small><b>{100 - Number(criticalWeight || 0)}%</b></span></div>
              {!editing.canEditCriticalWeight && <small>Tỷ trọng được khóa sau khi version được công bố.</small>}
            </div>
            <div className="sfp-setting">
              <div><strong>Điểm sàn đạt</strong><p>Kết quả có câu trọng yếu không đạt vẫn bị hard-fail.</p></div>
              <div className="sfp-mode" role="radiogroup" aria-label="Chế độ điểm sàn">
                <button className={passingMode === 'DEFAULT' ? 'is-active' : ''} onClick={() => setPassingMode('DEFAULT')} type="button">Công thức mặc định</button>
                <button className={passingMode === 'CUSTOM' ? 'is-active' : ''} onClick={() => setPassingMode('CUSTOM')} type="button">Tùy chỉnh</button>
              </div>
              {passingMode === 'CUSTOM' && <label className="sfp-score-input"><span>Điểm trên thang 10</span><input min="0" max="10" step="0.1" type="number" value={passingScore} onChange={(event) => setPassingScore(event.target.value)} /><b>/10</b></label>}
              {passingMode === 'DEFAULT' && <div className="sfp-default-value"><span>Điểm sàn hiện tại theo công thức cũ</span><strong>{displayScore(editing.passingScore)}/10</strong></div>}
            </div>
            {editing.versionStatus !== 'DRAFT' && <div className="sfp-recalc-note"><ReloadOutlined /><span><strong>{editing.submittedCount} kết quả sẽ được tính lại.</strong> Cấu hình mới chỉ có hiệu lực khi tác vụ hoàn tất.</span></div>}
            <footer><button onClick={() => setEditing(null)} disabled={saving} type="button">Hủy</button><button className="is-primary" onClick={requestSave} disabled={saving} type="button">{saving ? <LoadingOutlined /> : <CheckCircleOutlined />} Lưu cấu hình</button></footer>
          </section>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmSave}
        title="Tính lại kết quả của phiên bản?"
        message={`Điểm sàn mới sẽ được áp dụng lại cho ${editing?.submittedCount || 0} bài đã nộp. Thao tác chạy nền và không gửi lại thông báo cho nhân viên.`}
        confirmText="Tạo tác vụ"
        onConfirm={executeSave}
        onCancel={() => setConfirmSave(false)}
      />
    </div>
  )
}

export default ScoringFormulaPage
