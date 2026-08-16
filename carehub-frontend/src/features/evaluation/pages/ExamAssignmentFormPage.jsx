import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeftOutlined, CheckCircleOutlined, SendOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AppShell from '../../../shared/components/AppShell.jsx'
import { examAssignmentApi } from '../api/examAssignmentApi.js'
import { evaluationAudienceApi } from '../api/evaluationAudienceApi.js'
import { examPaperApi } from '../api/examPaperApi.js'
import ExamDeliveryFlow from '../components/ExamDeliveryFlow.jsx'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import DateTimePicker24h from '../../../shared/components/DateTimePicker24h.jsx'
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
  const paperIdParam = searchParams.get('paperId') || ''

  const [form, setForm] = useState(() => ({ ...initialForm, examPaperId: paperIdParam }))
  const [papers, setPapers] = useState([])
  const [audiences, setAudiences] = useState([])
  const [draftPaper, setDraftPaper] = useState(null)
  const [publishing, setPublishing] = useState(false)
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

      const allPapers = apiData(paperResponse, [])
      let publishedPapers = allPapers.filter((paper) => paper.status === 'PUBLISHED')
      setAudiences(apiData(audienceResponse, []).filter((audience) => audience.status === 'ACTIVE'))

      // Nếu có paperId trong URL
      if (paperIdParam) {
        let targetPaper = allPapers.find((p) => String(p.id) === String(paperIdParam))
        if (!targetPaper) {
          try {
            const singleRes = await examPaperApi.getExamPaper(paperIdParam)
            targetPaper = apiData(singleRes, null)
          } catch {
            // bỏ qua nếu không tìm thấy
          }
        }

        if (targetPaper) {
          if (targetPaper.status === 'PUBLISHED') {
            if (!publishedPapers.some((p) => String(p.id) === String(targetPaper.id))) {
              publishedPapers = [targetPaper, ...publishedPapers]
            }
            setForm((current) => ({
              ...current,
              examPaperId: String(targetPaper.id),
              name: current.name || `Đợt kiểm tra: ${targetPaper.name}`,
            }))
            setDraftPaper(null)
          } else {
            setDraftPaper(targetPaper)
          }
        }
      }

      setPapers(publishedPapers)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }, [paperIdParam, showToast])

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
    setForm((current) => {
      const next = { ...current, [name]: value }
      if (name === 'examPaperId' && value) {
        const paper = papers.find((p) => String(p.id) === String(value))
        if (paper && !current.name) {
          next.name = `Đợt kiểm tra: ${paper.name}`
        }
      }
      return next
    })
  }

  async function handlePublishDraftPaper() {
    if (!draftPaper?.id) return
    setPublishing(true)
    try {
      await examPaperApi.publishExamPaper(draftPaper.id)
      showToast(`Đã phát hành đề kiểm tra "${draftPaper.name}".`, 'success')
      const published = { ...draftPaper, status: 'PUBLISHED' }
      setPapers((prev) => [published, ...prev.filter((p) => String(p.id) !== String(published.id))])
      setForm((current) => ({
        ...current,
        examPaperId: String(published.id),
        name: current.name || `Đợt kiểm tra: ${published.name}`,
      }))
      setDraftPaper(null)
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setPublishing(false)
    }
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
    <AppShell
      breadcrumbs={[
        { label: 'Quản lý bài kiểm tra', link: '/admin/evaluation/exam-management?view=assignments' },
        { label: 'Giao đề kiểm tra' },
      ]}
    >
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
            <button
              type="button"
              className="exp-btn-secondary"
              onClick={() => navigate('/admin/evaluation/exam-management?view=assignments')}
            >
              <ArrowLeftOutlined /> Quay lại danh sách
            </button>
          </div>

          {loading ? (
            <div className="exp-empty">Đang tải đề đã phát hành và nhóm nhận...</div>
          ) : (
            <form className="exp-assignment-form" onSubmit={submit}>
              <section className="exp-form-section">
                <div className="exp-form-section__heading">
                  <span className="exp-form-section__number">01</span>
                  <div>
                    <h3>Chọn đề và nhóm nhận</h3>
                    <p>Chỉ đề đã phát hành và nhóm nhận đang hoạt động mới được dùng để giao.</p>
                  </div>
                </div>

                {draftPaper && (
                  <div className="exp-draft-alert">
                    <div>
                      <strong>Đề #{draftPaper.id} ({draftPaper.code} — {draftPaper.name}) đang ở trạng thái Bản nháp (DRAFT)</strong>
                      <span>Đề kiểm tra cần được phát hành (PUBLISHED) trước khi có thể giao cho nhân viên làm bài.</span>
                    </div>
                    <button
                      type="button"
                      className="exp-btn-primary"
                      disabled={publishing}
                      onClick={handlePublishDraftPaper}
                    >
                      <CheckCircleOutlined /> {publishing ? 'Đang phát hành...' : 'Phát hành đề ngay'}
                    </button>
                  </div>
                )}

                <div className="exp-form-grid exp-form-grid--2col">
                  <label className="exp-form-grid__wide">
                    <span>Tên đợt giao đề <b>*</b></span>
                    <input
                      required
                      value={form.name}
                      onChange={(event) => update('name', event.target.value)}
                      placeholder="Ví dụ: Kiểm tra định kỳ điều dưỡng 08/2026"
                    />
                  </label>
                  <label>
                    <span>Đề kiểm tra đã phát hành <b>*</b></span>
                    <select
                      required
                      value={form.examPaperId}
                      onChange={(event) => update('examPaperId', event.target.value)}
                    >
                      <option value="">Chọn đề kiểm tra đã phát hành</option>
                      {papers.map((paper) => (
                        <option key={paper.id} value={paper.id}>
                          {paper.code} — {paper.name} ({paper.totalQuestions} câu{paper.generationBatchId ? `, mã ${paper.variantIndex || 1}` : ''})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Nhóm nhận đề <b>*</b></span>
                    <select
                      required
                      value={form.audienceId}
                      onChange={(event) => update('audienceId', event.target.value)}
                    >
                      <option value="">Chọn nhóm nhận đang hoạt động</option>
                      {audiences.map((audience) => (
                        <option key={audience.id} value={audience.id}>
                          {audience.name}{audienceMemberCount(audience) != null ? ` · ${audienceMemberCount(audience)} nhân viên` : ''}
                        </option>
                      ))}
                    </select>
                    <small className="exp-field-hint">
                      Chưa có nhóm phù hợp? <a href="/admin/evaluation/audiences" target="_blank" rel="noreferrer">Tạo nhóm nhận đề mới</a> (theo khoa phòng hoặc mã nhân viên).
                    </small>
                  </label>
                </div>

                {selectedPaper && (
                  <div className="exp-selection-card">
                    <div className="exp-selection-card__main">
                      <span className="exp-selection-card__eyebrow">ĐỀ ĐÃ PHÁT HÀNH</span>
                      <strong>{selectedPaper.code} · {selectedPaper.name}</strong>
                      <small>{selectedPaper.examConfigName || 'Cấu hình chuẩn'} · phiên bản mã đề {selectedPaper.variantIndex || 1}</small>
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
                    {audiencePreviewInvalid ? (
                      <span className="exp-audience-card__status is-warning">Preview chưa hợp lệ</span>
                    ) : (
                      <span className="exp-audience-card__status">Snapshot khi mở giao</span>
                    )}
                  </div>
                )}

                {audiencePreviewInvalid && (
                  <div className="ch-alert ch-alert--error">
                    Nhóm nhận đề chưa đủ điều kiện. Hãy quay lại <a href="/admin/evaluation/audiences" target="_blank" rel="noreferrer">Đối tượng thi</a> để cập nhật preview trước khi giao.
                  </div>
                )}
              </section>

              <section className="exp-form-section">
                <div className="exp-form-section__heading">
                  <span className="exp-form-section__number">02</span>
                  <div>
                    <h3>Thiết lập thời gian và lượt làm</h3>
                    <p>Để trống thời gian nếu đề được mở và đóng thủ công.</p>
                  </div>
                </div>
                <div className="exp-schedule-card">
                  <div className="exp-schedule-row">
                    <div className="exp-schedule-field">
                      <label className="exp-schedule-label">Mở đề lúc (tùy chọn)</label>
                      <DateTimePicker24h
                        value={form.availableFrom}
                        onChange={(val) => update('availableFrom', val)}
                      />
                    </div>
                    <div className="exp-schedule-field">
                      <label className="exp-schedule-label">Hạn nộp bài (tùy chọn)</label>
                      <DateTimePicker24h
                        value={form.dueAt}
                        onChange={(val) => update('dueAt', val)}
                      />
                    </div>
                    <div className="exp-schedule-field exp-schedule-field--compact">
                      <label className="exp-schedule-label">Số lượt làm tối đa</label>
                      <div className="exp-number-stepper">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          className="exp-num-input"
                          value={form.maxAttempts}
                          onChange={(event) => update('maxAttempts', event.target.value)}
                        />
                        <span className="exp-stepper-unit">lần</span>
                      </div>
                    </div>
                  </div>
                </div>
                {scheduleInvalid && (
                  <div className="ch-alert ch-alert--error">Thời điểm mở đề phải sớm hơn hạn hoàn thành.</div>
                )}
              </section>

              <section className="exp-form-section">
                <div className="exp-form-section__heading">
                  <span className="exp-form-section__number">03</span>
                  <div>
                    <h3>Cách làm bài và công bố kết quả</h3>
                    <p>Các tùy chọn này áp dụng cho toàn bộ người nhận trong đợt giao.</p>
                  </div>
                </div>
                <div className="exp-form-grid exp-form-grid--2col">
                  <label>
                    <span>Công bố kết quả</span>
                    <select
                      value={form.resultVisibility}
                      onChange={(event) => update('resultVisibility', event.target.value)}
                    >
                      <option value="SCORE_ONLY">Hiển thị điểm sau khi nộp</option>
                      <option value="AFTER_DUE_DATE">Chỉ hiển thị sau hạn hoàn thành</option>
                      <option value="HIDDEN">Không hiển thị cho nhân viên</option>
                    </select>
                  </label>
                  <label>
                    <span>Cách mở đề</span>
                    <select
                      value={form.status}
                      onChange={(event) => update('status', event.target.value)}
                    >
                      <option value="DRAFT">Lưu nháp để kiểm tra</option>
                      <option value="OPEN">Mở giao ngay</option>
                    </select>
                  </label>
                  <label>
                    <span>Phân phối mã đề</span>
                    <select
                      value={form.variantPolicy}
                      disabled={!hasMultipleVariants}
                      onChange={(event) => update('variantPolicy', event.target.value)}
                    >
                      <option value="STABLE_USER_HASH">Ổn định theo từng nhân viên</option>
                      <option value="FIXED_PAPER">Dùng một mã đề</option>
                    </select>
                    <small className="exp-field-hint">
                      {hasMultipleVariants
                        ? 'Hệ thống tự chọn mã đề ổn định cho từng nhân viên.'
                        : 'Đề này chỉ có một mã đề.'}
                    </small>
                  </label>
                  <label>
                    <span>Khi làm lại</span>
                    <select
                      value={form.retakeVariantPolicy}
                      onChange={(event) => update('retakeVariantPolicy', event.target.value)}
                    >
                      <option value="KEEP_VARIANT">Giữ nguyên mã đề</option>
                      <option value="ROTATE_VARIANT">Đổi sang mã đề kế tiếp</option>
                    </select>
                  </label>
                  <label className="exp-form-grid__wide">
                    <span>Ghi chú cho đợt giao</span>
                    <textarea
                      rows="3"
                      value={form.description}
                      onChange={(event) => update('description', event.target.value)}
                      placeholder="Ví dụ: Hoàn thành trong ca trực, liên hệ điều phối nếu có sự cố."
                    />
                  </label>
                </div>
              </section>

              <div className="exp-assignment-submit">
                <div className="exp-assignment-submit__info">
                  <div className="exp-status-indicator">
                    <span className={`exp-status-dot ${form.status === 'OPEN' ? 'is-open' : 'is-draft'}`} />
                    <strong>{form.status === 'OPEN' ? 'Sẵn sàng mở giao đề' : 'Lưu đợt giao để kiểm tra trước'}</strong>
                  </div>
                  <span>
                    {form.status === 'OPEN'
                      ? 'Người nhận sẽ thấy đề theo lịch và trạng thái đã chọn.'
                      : 'Bạn có thể mở đợt giao sau khi rà soát lại cấu hình.'}
                  </span>
                </div>
                <div className="exp-actions-group">
                  <button
                    type="button"
                    className="exp-btn-secondary"
                    onClick={() => navigate('/admin/evaluation/exam-management?view=assignments')}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="exp-btn-primary"
                    disabled={saving || !papers.length || !audiences.length || audiencePreviewInvalid}
                  >
                    <SendOutlined /> {saving ? 'Đang lưu...' : form.status === 'OPEN' ? 'Giao đề kiểm tra' : 'Lưu đợt giao nháp'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </section>
      </div>
    </AppShell>
  )
}
