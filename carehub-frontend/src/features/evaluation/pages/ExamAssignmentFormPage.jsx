import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeftOutlined, SendOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { examAssignmentApi } from '../api/examAssignmentApi.js'
import { evaluationAudienceApi } from '../api/evaluationAudienceApi.js'
import { examPaperApi } from '../api/examPaperApi.js'
import ExamDeliveryFlow from '../components/ExamDeliveryFlow.jsx'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import '../styles/ExamPaperPages.css'

const initialForm = {
  name: '',
  description: '',
  examPaperId: '',
  audienceId: '',
  availableFrom: '',
  dueAt: '',
  maxAttempts: 1,
  shuffleQuestions: true,
  shuffleOptions: true,
  resultVisibility: 'SCORE_ONLY',
  status: 'DRAFT',
  variantPolicy: 'STABLE_USER_HASH',
  retakeVariantPolicy: 'KEEP_VARIANT',
}

function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `assignment-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function audienceMemberCount(audience) {
  return audience?.preview?.count ?? audience?.preview?.matchedUserCount
}

export default function ExamAssignmentFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { showToast } = useToast()
  const [form, setForm] = useState(() => ({ ...initialForm, examPaperId: searchParams.get('paperId') || '' }))
  const [papers, setPapers] = useState([])
  const [audiences, setAudiences] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [paperResponse, audienceResponse] = await Promise.all([
        examPaperApi.listExamPapers({}),
        evaluationAudienceApi.list(),
      ])
      setPapers(apiData(paperResponse, []).filter((paper) => paper.status === 'PUBLISHED'))
      setAudiences(apiData(audienceResponse, []).filter((audience) => audience.status === 'ACTIVE'))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const selectedPaper = useMemo(
    () => papers.find((paper) => String(paper.id) === String(form.examPaperId)),
    [form.examPaperId, papers],
  )
  const selectedAudience = useMemo(
    () => audiences.find((audience) => String(audience.id) === String(form.audienceId)),
    [audiences, form.audienceId],
  )
  const hasMultipleVariants = Boolean(selectedPaper?.generationBatchId)
  const scheduleInvalid = Boolean(form.availableFrom && form.dueAt && form.availableFrom >= form.dueAt)
  const audiencePreviewInvalid = selectedAudience?.preview?.valid === false

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim() || !form.examPaperId || !form.audienceId) {
      showToast('Vui lòng nhập tên đợt giao, chọn đề đã phát hành và nhóm nhận đề.', 'error')
      return
    }
    if (audiencePreviewInvalid) {
      showToast('Nhóm nhận đề chưa có preview hợp lệ, không thể giao đề.', 'error')
      return
    }
    if (scheduleInvalid) {
      showToast('Thời điểm mở bài phải sớm hơn hạn nộp.', 'error')
      return
    }
    setSaving(true)
    try {
      const response = await examAssignmentApi.createAssignment({
        name: form.name.trim(),
        description: form.description.trim() || null,
        examPaperId: Number(form.examPaperId),
        audienceId: Number(form.audienceId),
        availableFrom: form.availableFrom || null,
        dueAt: form.dueAt || null,
        maxAttempts: Number(form.maxAttempts),
        shuffleQuestions: form.shuffleQuestions,
        shuffleOptions: form.shuffleOptions,
        resultVisibility: form.resultVisibility,
        status: form.status,
        variantPolicy: hasMultipleVariants ? form.variantPolicy : 'FIXED_PAPER',
        retakeVariantPolicy: form.retakeVariantPolicy,
        idempotencyKey,
      })
      const assignment = apiData(response, null)
      showToast(form.status === 'OPEN' ? 'Đã giao đề kiểm tra.' : 'Đã lưu đợt giao đề ở trạng thái nháp.', 'success')
      navigate(`/admin/evaluation/exam-management?view=assignments${assignment?.id ? `&assignmentId=${assignment.id}` : ''}`)
    } catch (error) {
      setIdempotencyKey(newIdempotencyKey())
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleFlowStep(step) {
    if (step === 'matrix') navigate('/admin/evaluation/exam-management/new')
    if (step === 'papers') navigate('/admin/evaluation/exam-management?view=papers')
  }

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={[{ label: 'Quản lý bài kiểm tra', link: '/admin/evaluation/exam-management?view=assignments' }, { label: 'Giao đề kiểm tra' }]} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="exp-page">
              <ExamDeliveryFlow
                activeStep="assignments"
                title="Giao đề kiểm tra"
                description="Chọn một đề đã phát hành, chốt nhóm nhận, thiết lập lịch làm rồi mở giao đề."
                onStepChange={handleFlowStep}
              />

              <section className="exp-assignment-shell">
                <div className="exp-assignment-toolbar">
                  <div>
                    <span className="exp-section-kicker">BƯỚC 3 · CHỐT ĐỢT GIAO</span>
                    <h2>Thông tin giao đề</h2>
                    <p>Đề và nhóm nhận sẽ được chụp snapshot tại thời điểm mở giao.</p>
                  </div>
                  <button type="button" className="exp-btn-secondary" onClick={() => navigate('/admin/evaluation/exam-management?view=assignments')}><ArrowLeftOutlined /> Quay lại danh sách</button>
                </div>

                {loading ? <div className="exp-empty">Đang tải đề đã phát hành và nhóm nhận...</div> : (
                  <form className="exp-assignment-form" onSubmit={submit}>
                    <section className="exp-form-section">
                      <div className="exp-form-section__heading">
                        <span className="exp-form-section__number">01</span>
                        <div><h3>Chọn đề và nhóm nhận</h3><p>Chỉ đề đã phát hành và nhóm nhận đang hoạt động mới được dùng để giao.</p></div>
                      </div>
                      <div className="exp-form-grid">
                        <label className="exp-form-grid__wide"><span>Tên đợt giao đề <b>*</b></span><input required value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Ví dụ: Kiểm tra định kỳ điều dưỡng 08/2026" /></label>
                        <label><span>Đề kiểm tra đã phát hành <b>*</b></span><select required value={form.examPaperId} onChange={(event) => update('examPaperId', event.target.value)}><option value="">Chọn đề kiểm tra</option>{papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.code} — {paper.name}{paper.generationBatchId ? ` (mã ${paper.variantIndex || 1})` : ''}</option>)}</select></label>
                        <label><span>Nhóm nhận đề <b>*</b></span><select required value={form.audienceId} onChange={(event) => update('audienceId', event.target.value)}><option value="">Chọn nhóm nhận đang hoạt động</option>{audiences.map((audience) => <option key={audience.id} value={audience.id}>{audience.name}{audienceMemberCount(audience) != null ? ` · ${audienceMemberCount(audience)} nhân viên` : ''}</option>)}</select><small className="exp-field-hint">Chưa có nhóm phù hợp? <a href="/admin/evaluation/audiences" target="_blank" rel="noreferrer">Tạo nhóm nhận đề mới</a> (theo khoa phòng hoặc mã nhân viên).</small></label>
                      </div>

                      {selectedPaper && (
                        <div className="exp-selection-card">
                          <div className="exp-selection-card__main">
                            <span className="exp-selection-card__eyebrow">ĐỀ ĐÃ PHÁT HÀNH</span>
                            <strong>{selectedPaper.code} · {selectedPaper.name}</strong>
                            <small>{selectedPaper.examConfigName || 'Không có tên ma trận'} · phiên bản mã đề {selectedPaper.variantIndex || 1}</small>
                          </div>
                          <div className="exp-selection-card__stats">
                            <span><strong>{selectedPaper.totalQuestions}</strong> câu</span>
                            <span><strong>{selectedPaper.timeLimitMinutes}</strong> phút</span>
                            <span>Đạt <strong>{selectedPaper.passingScore}/10</strong></span>
                          </div>
                        </div>
                      )}

                      {selectedAudience && (
                        <div className={`exp-audience-card${audiencePreviewInvalid ? ' is-warning' : ''}`}>
                          <div>
                            <strong>{selectedAudience.name}</strong>
                            <span>{audienceMemberCount(selectedAudience) != null ? `${audienceMemberCount(selectedAudience)} nhân viên sẽ nhận đề` : 'Chưa có số lượng preview'}</span>
                          </div>
                          {audiencePreviewInvalid ? <span className="exp-audience-card__status is-warning">Preview chưa hợp lệ</span> : <span className="exp-audience-card__status">Snapshot khi mở giao</span>}
                        </div>
                      )}
                      {audiencePreviewInvalid && <div className="ch-alert ch-alert--error">Nhóm nhận đề chưa đủ điều kiện. Hãy quay lại <a href="/admin/evaluation/audiences" target="_blank" rel="noreferrer">Đối tượng thi</a> để cập nhật preview trước khi giao.</div>}
                    </section>

                    <section className="exp-form-section">
                      <div className="exp-form-section__heading">
                        <span className="exp-form-section__number">02</span>
                        <div><h3>Thiết lập thời gian và lượt làm</h3><p>Để trống thời gian nếu đề được mở và đóng thủ công.</p></div>
                      </div>
                      <div className="exp-form-grid">
                        <label><span>Số lượt làm tối đa</span><input type="number" min="1" max="10" value={form.maxAttempts} onChange={(event) => update('maxAttempts', event.target.value)} /></label>
                        <label><span>Mở đề lúc</span><input type="datetime-local" value={form.availableFrom} onChange={(event) => update('availableFrom', event.target.value)} /></label>
                        <label><span>Hạn hoàn thành</span><input type="datetime-local" value={form.dueAt} onChange={(event) => update('dueAt', event.target.value)} /></label>
                      </div>
                      {scheduleInvalid && <div className="ch-alert ch-alert--error">Thời điểm mở đề phải sớm hơn hạn hoàn thành.</div>}
                    </section>

                    <section className="exp-form-section">
                      <div className="exp-form-section__heading">
                        <span className="exp-form-section__number">03</span>
                        <div><h3>Cách làm bài và công bố kết quả</h3><p>Các tùy chọn này áp dụng cho toàn bộ người nhận trong đợt giao.</p></div>
                      </div>
                      <div className="exp-form-grid">
                        <label><span>Công bố kết quả</span><select value={form.resultVisibility} onChange={(event) => update('resultVisibility', event.target.value)}><option value="SCORE_ONLY">Hiển thị điểm sau khi nộp</option><option value="AFTER_DUE_DATE">Chỉ hiển thị sau hạn hoàn thành</option><option value="HIDDEN">Không hiển thị cho nhân viên</option></select></label>
                        <label><span>Cách mở đề</span><select value={form.status} onChange={(event) => update('status', event.target.value)}><option value="DRAFT">Lưu nháp để kiểm tra</option><option value="OPEN">Mở giao ngay</option></select></label>
                        <label><span>Phân phối mã đề</span><select value={form.variantPolicy} disabled={!hasMultipleVariants} onChange={(event) => update('variantPolicy', event.target.value)}><option value="STABLE_USER_HASH">Ổn định theo từng nhân viên</option><option value="FIXED_PAPER">Dùng một mã đề</option></select><small className="exp-field-hint">{hasMultipleVariants ? 'Hệ thống tự chọn mã đề ổn định cho từng nhân viên.' : 'Đề này chỉ có một mã đề.'}</small></label>
                        <label><span>Khi làm lại</span><select value={form.retakeVariantPolicy} onChange={(event) => update('retakeVariantPolicy', event.target.value)}><option value="KEEP_VARIANT">Giữ nguyên mã đề</option><option value="ROTATE_VARIANT">Đổi sang mã đề kế tiếp</option></select></label>
                        <label className="exp-form-grid__wide"><span>Ghi chú cho đợt giao</span><textarea rows="3" value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Ví dụ: Hoàn thành trong ca trực, liên hệ điều phối nếu có sự cố." /></label>
                      </div>
                    </section>

                    <div className="exp-assignment-submit">
                      <div><strong>{form.status === 'OPEN' ? 'Sẵn sàng mở giao đề' : 'Lưu đợt giao để kiểm tra trước'}</strong><span>{form.status === 'OPEN' ? 'Người nhận sẽ thấy đề theo lịch và trạng thái đã chọn.' : 'Bạn có thể mở đợt giao sau khi rà soát lại cấu hình.'}</span></div>
                      <button type="submit" className="exp-btn-primary" disabled={saving || !papers.length || !audiences.length || audiencePreviewInvalid}><SendOutlined /> {saving ? 'Đang lưu...' : form.status === 'OPEN' ? 'Giao đề kiểm tra' : 'Lưu đợt giao nháp'}</button>
                    </div>
                  </form>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
