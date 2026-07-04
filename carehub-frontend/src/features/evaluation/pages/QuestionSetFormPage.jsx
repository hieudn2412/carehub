import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  CloseOutlined,
  CopyOutlined,
  LockOutlined,
  LoadingOutlined,
  SaveOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { questionBankApi } from '../api/questionBankApi.js'
import { questionSetApi } from '../api/questionSetApi.js'
import { apiData, apiErrorMessage, formatDateTime } from '../utils/documentQuestionUi.js'
import '../styles/QuestionSetFormPage.css'

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Bản nháp' },
  { value: 'ACTIVE', label: 'Hoạt động' },
  { value: 'INACTIVE', label: 'Tạm ngưng' },
]

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Dễ' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'hard', label: 'Khó' },
]

function QuestionSetFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { showToast } = useToast()
  const isEditMode = Boolean(id)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [status, setStatus] = useState('DRAFT')
  const [description, setDescription] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [questionsList, setQuestionsList] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [snapshotInfo, setSnapshotInfo] = useState({
    activeVersion: null,
    snapshotAt: null,
    versions: [],
    activeSnapshotItems: [],
  })

  const [qKeyword, setQKeyword] = useState('')
  const [qCategory, setQCategory] = useState('')
  const [qDifficulty, setQDifficulty] = useState('')
  const [qSource, setQSource] = useState('')
  const [qType, setQType] = useState('')
  const [qPage, setQPage] = useState(0)

  const [previewCounts, setPreviewCounts] = useState({ easy: 0, medium: 10, hard: 0 })
  const [avoidSameSource, setAvoidSameSource] = useState(true)
  const [randomSeed, setRandomSeed] = useState('20260701')
  const [previewResult, setPreviewResult] = useState(null)
  const [isPreviewing, setIsPreviewing] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [questionsResponse, detailResponse] = await Promise.all([
        questionBankApi.listQuestions({ status: 'APPROVED' }),
        isEditMode ? questionSetApi.getQuestionSet(id) : Promise.resolve(null),
      ])
      const questions = apiData(questionsResponse, [])
      setQuestionsList(questions)
      if (detailResponse) {
        const detail = apiData(detailResponse)
        setCode(detail.code || '')
        setName(detail.name || '')
        setCategory(detail.category || '')
        setDifficulty(detail.difficulty || 'medium')
        setStatus(detail.status === 'ARCHIVED' ? 'INACTIVE' : detail.status || 'DRAFT')
        setDescription(detail.description || '')
        setSelectedIds((detail.items || []).map((item) => item.question?.id).filter(Boolean))
        setSnapshotInfo({
          activeVersion: detail.activeVersion || null,
          snapshotAt: detail.snapshotAt || null,
          versions: detail.versions || [],
          activeSnapshotItems: detail.activeSnapshotItems || [],
        })
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [id, isEditMode, showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const topics = useMemo(() => {
    return Array.from(new Set(questionsList.map((question) => question.topic).filter(Boolean))).sort()
  }, [questionsList])

  const sources = useMemo(() => {
    return Array.from(new Set(questionsList.map((question) => question.sourceDocument).filter(Boolean))).sort()
  }, [questionsList])

  const selectedQuestions = useMemo(() => {
    const byId = new Map(questionsList.map((question) => [question.id, question]))
    return selectedIds.map((questionId) => byId.get(questionId)).filter(Boolean)
  }, [questionsList, selectedIds])

  const filteredQuestions = useMemo(() => {
    const keyword = normalize(qKeyword)
    return questionsList.filter((question) => {
      const matchesKeyword = !keyword
        || normalize(question.stem).includes(keyword)
        || normalize(question.topic).includes(keyword)
        || normalize(question.sourceDocument).includes(keyword)
      const matchesCategory = !qCategory || question.topic === qCategory
      const matchesDifficulty = !qDifficulty || normalize(question.difficulty) === normalize(qDifficulty)
      const matchesSource = !qSource || question.sourceDocument === qSource
      const matchesType = !qType || question.questionType === qType
      return matchesKeyword && matchesCategory && matchesDifficulty && matchesSource && matchesType
    })
  }, [qCategory, qDifficulty, qKeyword, qSource, qType, questionsList])

  const qPageSize = 6
  const qTotalElements = filteredQuestions.length
  const qTotalPages = Math.ceil(qTotalElements / qPageSize) || 1
  const displayQuestions = filteredQuestions.slice(qPage * qPageSize, (qPage + 1) * qPageSize)
  const displayIds = displayQuestions.map((question) => question.id)
  const isAllDisplayChecked = displayIds.length > 0 && displayIds.every((questionId) => selectedIds.includes(questionId))
  const isActiveLocked = isEditMode && status === 'ACTIVE'

  function toggleQuestion(questionId) {
    if (isActiveLocked) return
    setSelectedIds((current) => current.includes(questionId)
      ? current.filter((idValue) => idValue !== questionId)
      : [...current, questionId])
  }

  function toggleSelectAllDisplay() {
    if (isActiveLocked) return
    if (isAllDisplayChecked) {
      setSelectedIds((current) => current.filter((questionId) => !displayIds.includes(questionId)))
      return
    }
    setSelectedIds((current) => {
      const next = [...current]
      displayIds.forEach((questionId) => {
        if (!next.includes(questionId)) {
          next.push(questionId)
        }
      })
      return next
    })
  }

  function moveSelected(questionId, direction) {
    if (isActiveLocked) return
    setSelectedIds((current) => {
      const index = current.indexOf(questionId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current
      }
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  async function handleSave(event) {
    event.preventDefault()
    if (isActiveLocked) {
      showToast('Bộ câu hỏi đang hoạt động đã được khóa snapshot. Hãy tạo bản nháp chỉnh sửa.', 'warning')
      return
    }
    if (!name.trim()) {
      showToast('Vui lòng nhập tên bộ câu hỏi.', 'warning')
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        code: code.trim() || null,
        name: name.trim(),
        category: category.trim() || null,
        difficulty,
        status,
        description: description.trim() || null,
        questionIds: selectedIds,
      }
      if (isEditMode) {
        await questionSetApi.updateQuestionSet(id, payload)
        showToast('Cập nhật bộ câu hỏi thành công.', 'success')
      } else {
        await questionSetApi.createQuestionSet(payload)
        showToast('Tạo bộ câu hỏi thành công.', 'success')
      }
      navigate('/admin/evaluation/question-sets')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  async function previewQuestionSet() {
    if (isActiveLocked) {
      showToast('Bộ câu hỏi đang hoạt động đã được khóa snapshot. Hãy tạo bản nháp chỉnh sửa.', 'warning')
      return
    }
    setIsPreviewing(true)
    try {
      const response = await questionSetApi.previewQuestionSet({
        category: category || null,
        difficultyDistribution: Object.fromEntries(
          Object.entries(previewCounts).map(([key, value]) => [key, Number(value) || 0])
        ),
        excludeQuestionIds: selectedIds,
        avoidSameSourceDocument: avoidSameSource,
        randomSeed: Number(randomSeed) || 1,
      })
      setPreviewResult(apiData(response))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsPreviewing(false)
    }
  }

  function applyPreview() {
    if (isActiveLocked) return
    const questionIds = previewResult?.questionIds || []
    if (!questionIds.length) {
      showToast('Không có câu hỏi xem trước để áp dụng.', 'warning')
      return
    }
    setSelectedIds((current) => {
      const next = [...current]
      questionIds.forEach((questionId) => {
        if (!next.includes(questionId)) {
          next.push(questionId)
        }
      })
      return next
    })
    showToast('Đã thêm câu hỏi xem trước vào bộ.', 'success')
  }

  async function createDraftCopy() {
    if (!id) return
    setIsSaving(true)
    try {
      const response = await questionSetApi.duplicateQuestionSet(id)
      const duplicated = apiData(response)
      showToast('Đã tạo bản nháp chỉnh sửa từ bộ đang hoạt động.', 'success')
      if (duplicated?.id) {
        navigate(`/admin/evaluation/question-sets/${duplicated.id}/edit`)
      }
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const breadcrumbs = [
    { label: 'Bộ câu hỏi', path: '/admin/evaluation/question-sets' },
    { label: isEditMode ? 'Chỉnh sửa' : 'Tạo mới' },
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="qsf-page">
              <div className="qsf-container">
                <div className="qsf-header">
                  <button type="button" className="qsf-btn-cancel" onClick={() => navigate('/admin/evaluation/question-sets')}>
                    <ArrowLeftOutlined /> Quay lại
                  </button>
                  <div>
                    <h2 className="qsf-title">{isEditMode ? 'Cập nhật bộ câu hỏi' : 'Tạo bộ câu hỏi'}</h2>
                    <p className="qsf-subtitle">Gom nhóm các câu hỏi theo chủ đề, độ khó và thứ tự sử dụng</p>
                  </div>
                </div>

                {isLoading ? (
                  <section className="qsf-questions-card">Đang tải dữ liệu bộ câu hỏi...</section>
                ) : (
                  <form onSubmit={handleSave} className="qsf-form">
                    {isActiveLocked && (
                      <section className="qsf-lock-banner">
                        <LockOutlined />
                        <div>
                          <strong>Bộ câu hỏi đang hoạt động đã khóa snapshot</strong>
                          <p>Không sửa trực tiếp bản active. Tạo bản nháp chỉnh sửa để thay đổi câu hỏi, thứ tự hoặc metadata rồi kích hoạt thành version mới.</p>
                        </div>
                        <button type="button" className="qsf-btn-save" onClick={createDraftCopy} disabled={isSaving}>
                          {isSaving ? <LoadingOutlined /> : <CopyOutlined />}
                          Tạo bản nháp chỉnh sửa
                        </button>
                      </section>
                    )}
                    <div className="qsf-form-row">
                      <div className="qsf-form-group">
                        <label>Tên bộ câu hỏi <span className="qsf-required-star">*</span></label>
                        <input
                          type="text"
                          className="qsf-input-green"
                          required
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="Nhập tên bộ câu hỏi..."
                          disabled={isActiveLocked}
                        />
                      </div>
                      <div className="qsf-form-group">
                        <label>Mã bộ câu hỏi</label>
                        <input
                          type="text"
                          className="qsf-input-green"
                          value={code}
                          onChange={(event) => setCode(event.target.value)}
                          placeholder="Ví dụ: IC_BASIC_2026"
                          disabled={isActiveLocked}
                        />
                      </div>
                    </div>

                    <div className="qsf-form-row">
                      <div className="qsf-form-group">
                        <label>Danh mục</label>
                        <input
                          className="qsf-input-green"
                          value={category}
                          onChange={(event) => setCategory(event.target.value)}
                          list="question-set-topics"
                          placeholder="Chọn hoặc nhập danh mục..."
                          disabled={isActiveLocked}
                        />
                        <datalist id="question-set-topics">
                          {topics.map((topic) => <option key={topic} value={topic} />)}
                        </datalist>
                      </div>
                      <div className="qsf-form-group">
                        <label>Độ khó</label>
                        <select className="qsf-input-red" value={difficulty} onChange={(event) => setDifficulty(event.target.value)} disabled={isActiveLocked}>
                          {DIFFICULTY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="qsf-form-row">
                      <div className="qsf-form-group">
                        <label>Trạng thái</label>
                        <select className="qsf-input-red" value={status} onChange={(event) => setStatus(event.target.value)} disabled={isActiveLocked}>
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="qsf-form-group">
                        <label>Số câu đã chọn</label>
                        <input className="qsf-input-green" value={`${selectedIds.length} câu hỏi`} readOnly />
                      </div>
                    </div>

                    <div className="qsf-form-group">
                      <label>Mô tả</label>
                      <textarea
                        className="qsf-input-green"
                        rows={3}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Mô tả tóm tắt về bộ câu hỏi này..."
                        disabled={isActiveLocked}
                      />
                    </div>

                    {isEditMode && (
                      <div className="qsf-version-card">
                        <div className="qsf-version-head">
                          <div>
                            <strong>Phiên bản đang hoạt động</strong>
                            <span>
                              {snapshotInfo.activeVersion
                                ? `Version ${snapshotInfo.activeVersion} · ${formatDateTime(snapshotInfo.snapshotAt)}`
                                : 'Chưa có snapshot active'}
                            </span>
                          </div>
                          <span>{snapshotInfo.versions.length} phiên bản</span>
                        </div>

                        {snapshotInfo.versions.length > 0 && (
                          <div className="qsf-version-list">
                            {snapshotInfo.versions.slice(0, 4).map((version) => (
                              <div className="qsf-version-pill" key={version.id || version.version}>
                                <strong>v{version.version}</strong>
                                <span>{version.questionCount} câu · {formatDateTime(version.snapshotAt)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {snapshotInfo.activeSnapshotItems.length > 0 && (
                          <div className="qsf-snapshot-preview">
                            {snapshotInfo.activeSnapshotItems.slice(0, 5).map((item) => (
                              <div className="qsf-snapshot-row" key={item.id || `${item.position}-${item.sourceQuestionId}`}>
                                <span>{item.position}</span>
                                <p>{item.stem}</p>
                                <strong>{item.correctAnswer}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="qsf-section-divider">
                      <span className="qsf-divider-title">TẠO NHANH THEO CẤU HÌNH</span>
                    </div>

                    <div className="qsf-questions-card">
                      <div className="qsf-form-row">
                        {DIFFICULTY_OPTIONS.map((option) => (
                          <div className="qsf-form-group" key={option.value}>
                            <label>{option.label}</label>
                            <input
                              type="number"
                              min="0"
                              className="qsf-input-green"
                              value={previewCounts[option.value]}
                              onChange={(event) => setPreviewCounts((current) => ({
                                ...current,
                                [option.value]: event.target.value,
                              }))}
                              disabled={isActiveLocked}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="qsf-form-row">
                        <label className="qsf-form-group">
                          <span>Mã sinh ngẫu nhiên</span>
                          <input className="qsf-input-green" value={randomSeed} onChange={(event) => setRandomSeed(event.target.value)} disabled={isActiveLocked} />
                        </label>
                        <label className="qsf-form-group">
                          <span>Tránh cùng nguồn</span>
                          <select className="qsf-input-red" value={String(avoidSameSource)} onChange={(event) => setAvoidSameSource(event.target.value === 'true')} disabled={isActiveLocked}>
                            <option value="true">Có</option>
                            <option value="false">Không</option>
                          </select>
                        </label>
                      </div>
                      <div className="qsf-form-actions qsf-form-actions--inline">
                        <button type="button" className="qsf-btn-save" onClick={previewQuestionSet} disabled={isPreviewing || isActiveLocked}>
                          {isPreviewing ? <LoadingOutlined /> : <ThunderboltOutlined />}
                          Xem trước
                        </button>
                        <button type="button" className="qsf-btn-cancel" onClick={applyPreview} disabled={!previewResult?.questionIds?.length || isActiveLocked}>
                          Áp dụng
                        </button>
                      </div>
                      {previewResult && (
                        <div className="qsf-preview-box">
                          <strong>{previewResult.questionIds?.length || 0} câu hỏi gợi ý</strong>
                          {(previewResult.warnings || []).map((warning) => <p key={warning}>{warning}</p>)}
                          {(previewResult.shortage || []).map((item) => (
                            <p key={item.difficulty}>Thiếu {difficultyText(item.difficulty)}: cần {item.requested}, có {item.available}</p>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="qsf-section-divider">
                      <span className="qsf-divider-title">CÂU HỎI TRONG BỘ</span>
                    </div>

                    <div className="qsf-selected-card">
                      <h3>Câu đã chọn</h3>
                      {selectedQuestions.length === 0 ? (
                        <p className="qsf-empty-text">Chưa có câu hỏi nào trong bộ.</p>
                      ) : (
                        selectedQuestions.map((question, index) => (
                          <div className="qsf-selected-row" key={question.id}>
                            <span>{index + 1}</span>
                            <strong>{question.stem}</strong>
                            <div>
                              <button type="button" onClick={() => moveSelected(question.id, -1)} disabled={index === 0 || isActiveLocked} title="Đưa lên">
                                <ArrowUpOutlined />
                              </button>
                              <button type="button" onClick={() => moveSelected(question.id, 1)} disabled={index === selectedQuestions.length - 1 || isActiveLocked} title="Đưa xuống">
                                <ArrowDownOutlined />
                              </button>
                              <button type="button" onClick={() => toggleQuestion(question.id)} title="Bỏ khỏi bộ" disabled={isActiveLocked}>
                                <CloseOutlined />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="qsf-questions-card">
                      <div className="qsf-qfilter-bar">
                        <div className="qsf-qsearch">
                          <span className="qsf-qsearch-icon"><SearchOutlined /></span>
                          <input
                            type="text"
                            className="qsf-qsearch-input"
                            placeholder="Tìm câu hỏi..."
                            value={qKeyword}
                            onChange={(event) => {
                              setQKeyword(event.target.value)
                              setQPage(0)
                            }}
                          />
                        </div>
                        <select className="qsf-qfilter-select" value={qCategory} onChange={(event) => { setQCategory(event.target.value); setQPage(0) }}>
                          <option value="">Danh mục</option>
                          {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
                        </select>
                        <select className="qsf-qfilter-select" value={qDifficulty} onChange={(event) => { setQDifficulty(event.target.value); setQPage(0) }}>
                          <option value="">Độ khó</option>
                          {DIFFICULTY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <select className="qsf-qfilter-select" value={qSource} onChange={(event) => { setQSource(event.target.value); setQPage(0) }}>
                          <option value="">Nguồn</option>
                          {sources.map((source) => <option key={source} value={source}>{source}</option>)}
                        </select>
                        <select className="qsf-qfilter-select" value={qType} onChange={(event) => { setQType(event.target.value); setQPage(0) }}>
                          <option value="">Loại</option>
                          <option value="ORIGINAL">Gốc</option>
                          <option value="PARAPHRASE">Diễn đạt lại</option>
                        </select>
                      </div>

                      <table className="qsf-qtable">
                        <thead>
                          <tr>
                            <th style={{ width: '50px', textAlign: 'center' }}>
                              <input type="checkbox" checked={isAllDisplayChecked} onChange={toggleSelectAllDisplay} disabled={isActiveLocked} />
                            </th>
                            <th>Nội dung câu hỏi</th>
                            <th>Danh mục</th>
                            <th>Độ khó</th>
                            <th>Nguồn</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayQuestions.length === 0 ? (
                            <tr>
                              <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 0' }}>
                                Không tìm thấy câu hỏi nào.
                              </td>
                            </tr>
                          ) : (
                            displayQuestions.map((question) => (
                              <tr key={question.id} onClick={() => toggleQuestion(question.id)} style={{ cursor: isActiveLocked ? 'default' : 'pointer' }}>
                                <td style={{ textAlign: 'center' }} onClick={(event) => event.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(question.id)}
                                    onChange={() => toggleQuestion(question.id)}
                                    disabled={isActiveLocked}
                                  />
                                </td>
                                <td style={{ fontWeight: 500, color: '#1e293b' }}>{question.stem}</td>
                                <td style={{ color: '#475569' }}>{question.topic || '---'}</td>
                                <td>
                                  <span className={`qsf-diff-badge ${getDifficultyClass(question.difficulty)}`}>
                                    {difficultyText(question.difficulty)}
                                  </span>
                                </td>
                                <td style={{ color: '#64748b' }}>{question.sourceDocument || question.questionType || '---'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>

                      <div className="qsf-qpagination-bar">
                        <div className="qsf-qpagination-info">
                          Hiển thị {displayQuestions.length} trong tổng số {qTotalElements} kết quả ({selectedIds.length} câu hỏi đã chọn)
                        </div>
                        <div className="qsf-qpagination-buttons">
                          <button type="button" className="qsf-page-btn" disabled={qPage <= 0} onClick={() => setQPage(qPage - 1)}>&lt;</button>
                          {Array.from({ length: qTotalPages }).map((_, index) => (
                            <button
                              type="button"
                              key={index}
                              className={`qsf-page-btn ${qPage === index ? 'qsf-page-btn--active' : ''}`}
                              onClick={() => setQPage(index)}
                            >
                              {index + 1}
                            </button>
                          ))}
                          <button type="button" className="qsf-page-btn" disabled={qPage + 1 >= qTotalPages} onClick={() => setQPage(qPage + 1)}>&gt;</button>
                        </div>
                      </div>
                    </div>

                    <div className="qsf-form-actions">
                      <button type="submit" className="qsf-btn-save" disabled={isSaving || isActiveLocked}>
                        {isSaving ? <LoadingOutlined /> : <SaveOutlined />}
                        {isActiveLocked ? 'Đã khóa snapshot' : 'Lưu bộ câu hỏi'}
                      </button>
                      <button type="button" className="qsf-btn-cancel" onClick={() => navigate('/admin/evaluation/question-sets')} disabled={isSaving}>
                        Hủy
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

function getDifficultyClass(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'easy' || value === 'Dễ') return 'qsf-diff-badge--easy'
  if (normalized === 'medium' || value === 'Trung bình') return 'qsf-diff-badge--medium'
  return 'qsf-diff-badge--hard'
}

function difficultyText(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'easy') return 'Dễ'
  if (normalized === 'medium') return 'Trung bình'
  if (normalized === 'hard') return 'Khó'
  return value || '---'
}

function normalize(value) {
  return String(value || '').toLowerCase().trim()
}

export default QuestionSetFormPage
