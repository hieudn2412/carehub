import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  FilterOutlined,
  HolderOutlined,
  LockOutlined,
  LoadingOutlined,
  PlusOutlined,
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
  const selectedListRef = useRef(null)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [status, setStatus] = useState('DRAFT')
  const [description, setDescription] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [draggedQuestionId, setDraggedQuestionId] = useState(null)
  const [dragOverQuestionId, setDragOverQuestionId] = useState(null)
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
    // Hydrate form and question-bank data when the edited set changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  function handleDragStart(event, questionId) {
    if (isActiveLocked) {
      event.preventDefault()
      return
    }
    setDraggedQuestionId(questionId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(questionId))
    const row = event.currentTarget.closest('.qsf-selected-row')
    if (row) {
      event.dataTransfer.setDragImage(row, 24, Math.min(row.offsetHeight / 2, 32))
    }
  }

  function handleDragOver(event, questionId) {
    if (isActiveLocked || !draggedQuestionId || draggedQuestionId === questionId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverQuestionId((current) => current === questionId ? current : questionId)
  }

  function handleSelectedListDragOver(event) {
    if (isActiveLocked || !draggedQuestionId || !selectedListRef.current) return
    event.preventDefault()

    const list = selectedListRef.current
    const bounds = list.getBoundingClientRect()
    const edgeSize = 64
    const maxSpeed = 22
    let scrollAmount = 0

    if (event.clientY < bounds.top + edgeSize) {
      const intensity = (bounds.top + edgeSize - event.clientY) / edgeSize
      scrollAmount = -Math.ceil(maxSpeed * Math.min(1, intensity))
    } else if (event.clientY > bounds.bottom - edgeSize) {
      const intensity = (event.clientY - (bounds.bottom - edgeSize)) / edgeSize
      scrollAmount = Math.ceil(maxSpeed * Math.min(1, intensity))
    }

    if (scrollAmount !== 0) {
      list.scrollTop += scrollAmount
    }
  }

  function handleDrop(event, targetQuestionId) {
    event.preventDefault()
    event.stopPropagation()
    if (isActiveLocked || !draggedQuestionId || draggedQuestionId === targetQuestionId) {
      handleDragEnd()
      return
    }

    setSelectedIds((current) => {
      const sourceIndex = current.indexOf(draggedQuestionId)
      const targetIndex = current.indexOf(targetQuestionId)
      if (sourceIndex < 0 || targetIndex < 0) return current

      const next = [...current]
      const [movedQuestionId] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, movedQuestionId)
      return next
    })
    handleDragEnd()
  }

  function handleSelectedListDrop(event) {
    if (dragOverQuestionId) {
      handleDrop(event, dragOverQuestionId)
      return
    }
    handleDragEnd()
  }

  function handleDragEnd() {
    setDraggedQuestionId(null)
    setDragOverQuestionId(null)
  }

  function getDragGapClass(questionId) {
    if (!draggedQuestionId || !dragOverQuestionId || questionId !== dragOverQuestionId) return ''
    const sourceIndex = selectedIds.indexOf(draggedQuestionId)
    const targetIndex = selectedIds.indexOf(dragOverQuestionId)
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return ''
    return sourceIndex < targetIndex ? 'qsf-selected-row--gap-after' : 'qsf-selected-row--gap-before'
  }

  function handleDragHandleKeyDown(event, questionId) {
    if (isActiveLocked || !event.altKey) return
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveSelected(questionId, -1)
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveSelected(questionId, 1)
    }
  }

  async function handleSave(event) {
    event.preventDefault()
    if (isActiveLocked) {
      showToast('Bộ câu hỏi đang được sử dụng nên không thể sửa trực tiếp. Hãy tạo một bản sao để chỉnh sửa.', 'warning')
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
      showToast('Bộ câu hỏi đang được sử dụng nên không thể sửa trực tiếp. Hãy tạo một bản sao để chỉnh sửa.', 'warning')
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
      showToast('Đã tạo bản sao để chỉnh sửa.', 'success')
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
  const paginationItems = getPaginationItems(qPage, qTotalPages)
  const activeQuestionFilterCount = [qCategory, qDifficulty, qSource, qType].filter(Boolean).length

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
                  <button type="button" className="qsf-back-btn" onClick={() => navigate('/admin/evaluation/question-sets')}>
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
                          <strong>Bộ câu hỏi này đang được sử dụng</strong>
                          <p>Để bảo toàn các bài kiểm tra hiện có, hãy tạo một bản sao trước khi thay đổi nội dung.</p>
                        </div>
                        <button type="button" className="qsf-btn-save" onClick={createDraftCopy} disabled={isSaving}>
                          {isSaving ? <LoadingOutlined /> : <CopyOutlined />}
                          Tạo bản sao để chỉnh sửa
                        </button>
                      </section>
                    )}
                    <section className="qsf-section-card qsf-metadata-card">
                      <div className="qsf-section-heading">
                        <div>
                          <h3>Thông tin bộ câu hỏi</h3>
                          <p>Thiết lập thông tin nhận diện và nội dung sử dụng.</p>
                        </div>
                        <span className="qsf-selected-count">{selectedIds.length} câu đã chọn</span>
                      </div>

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
                      <label>Mô tả</label>
                      <textarea
                        className="qsf-input-green"
                        rows={3}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Mô tả ngắn để người quản trị khác hiểu mục đích của bộ câu hỏi..."
                        disabled={isActiveLocked}
                      />
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

                    </section>

                    {isEditMode && (
                      <details className="qsf-disclosure qsf-version-card">
                        <summary className="qsf-disclosure__summary">
                          <div>
                            <strong>Thông tin phiên bản</strong>
                            <span>
                              {snapshotInfo.activeVersion
                                ? `Đang hoạt động: v${snapshotInfo.activeVersion}`
                                : 'Chưa có phiên bản hoạt động'}
                            </span>
                          </div>
                          <span>{snapshotInfo.versions.length} phiên bản</span>
                        </summary>
                        <div className="qsf-disclosure__content">
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
                      </details>
                    )}

                    <details className="qsf-disclosure qsf-advanced-tools">
                      <summary className="qsf-disclosure__summary">
                        <div>
                          <strong>Tạo nhanh theo cấu hình</strong>
                          <span>Tự động gợi ý câu hỏi theo độ khó và nguồn tài liệu.</span>
                        </div>
                        <ThunderboltOutlined />
                      </summary>
                      <div className="qsf-disclosure__content qsf-advanced-tools__content">
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
                    </details>

                    <div className="qsf-section-divider">
                      <span className="qsf-divider-title">CÂU HỎI TRONG BỘ</span>
                    </div>

                    <div className="qsf-selected-card">
                      <div className="qsf-card-heading">
                        <div>
                          <h3>Câu đã chọn</h3>
                          <p>Kéo tay nắm để sắp xếp. Danh sách sẽ tự cuộn khi kéo sát mép.</p>
                        </div>
                        <span>{selectedIds.length}</span>
                      </div>
                      {selectedQuestions.length === 0 ? (
                        <p className="qsf-empty-text">Chưa có câu hỏi nào trong bộ.</p>
                      ) : (
                        <div
                          className="qsf-selected-list"
                          ref={selectedListRef}
                          onDragOver={handleSelectedListDragOver}
                          onDrop={handleSelectedListDrop}
                        >
                        {selectedQuestions.map((question, index) => (
                          <div
                            className={`qsf-selected-row ${draggedQuestionId === question.id ? 'qsf-selected-row--dragging' : ''} ${dragOverQuestionId === question.id ? 'qsf-selected-row--drag-over' : ''} ${getDragGapClass(question.id)}`}
                            key={question.id}
                            onDragOver={(event) => handleDragOver(event, question.id)}
                            onDrop={(event) => handleDrop(event, question.id)}
                          >
                            <button
                              type="button"
                              className="qsf-drag-handle"
                              draggable={!isActiveLocked}
                              disabled={isActiveLocked}
                              onDragStart={(event) => handleDragStart(event, question.id)}
                              onDragEnd={handleDragEnd}
                              onKeyDown={(event) => handleDragHandleKeyDown(event, question.id)}
                              aria-label={`Kéo để sắp xếp câu ${index + 1}`}
                              title="Kéo để sắp xếp. Dùng Alt + mũi tên khi thao tác bằng bàn phím."
                            >
                              <HolderOutlined />
                            </button>
                            <span>{index + 1}</span>
                            <strong>{question.stem}</strong>
                            <div>
                              <button type="button" onClick={() => toggleQuestion(question.id)} title="Bỏ khỏi bộ" disabled={isActiveLocked}>
                                <CloseOutlined />
                              </button>
                            </div>
                          </div>
                        ))}
                        </div>
                      )}
                    </div>

                    <div className="qsf-questions-card">
                      <div className="qsf-bank-heading">
                        <div>
                          <h3>Ngân hàng câu hỏi</h3>
                          <p>Tìm và chọn các câu hỏi đã được phê duyệt.</p>
                        </div>
                      </div>
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
                        <details className="qsf-filter-disclosure">
                          <summary>
                            <FilterOutlined /> Bộ lọc
                            {activeQuestionFilterCount > 0 && <span className="qsf-filter-count">{activeQuestionFilterCount}</span>}
                          </summary>
                          <div className="qsf-filter-panel">
                            <select className="qsf-qfilter-select" value={qCategory} onChange={(event) => { setQCategory(event.target.value); setQPage(0) }}>
                              <option value="">Tất cả danh mục</option>
                              {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
                            </select>
                            <select className="qsf-qfilter-select" value={qDifficulty} onChange={(event) => { setQDifficulty(event.target.value); setQPage(0) }}>
                              <option value="">Tất cả độ khó</option>
                              {DIFFICULTY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <select className="qsf-qfilter-select" value={qSource} onChange={(event) => { setQSource(event.target.value); setQPage(0) }}>
                              <option value="">Tất cả nguồn</option>
                              {sources.map((source) => <option key={source} value={source}>{source}</option>)}
                            </select>
                            <select className="qsf-qfilter-select" value={qType} onChange={(event) => { setQType(event.target.value); setQPage(0) }}>
                              <option value="">Tất cả loại câu hỏi</option>
                              <option value="ORIGINAL">Gốc</option>
                              <option value="PARAPHRASE">Diễn đạt lại</option>
                            </select>
                          </div>
                        </details>
                      </div>

                      <div className="qsf-bank-selection-bar">
                        <label>
                          <input
                            type="checkbox"
                            checked={isAllDisplayChecked}
                            onChange={toggleSelectAllDisplay}
                            disabled={isActiveLocked || displayQuestions.length === 0}
                          />
                          Chọn tất cả {displayQuestions.length} câu trên trang này
                        </label>
                        <span>{selectedIds.length} câu trong bộ</span>
                      </div>

                      <div className="qsf-bank-list">
                        {displayQuestions.length === 0 ? (
                          <div className="qsf-bank-empty">
                            <SearchOutlined />
                            <strong>Không tìm thấy câu hỏi phù hợp</strong>
                            <span>Thử thay đổi từ khóa hoặc bộ lọc đang sử dụng.</span>
                          </div>
                        ) : (
                          displayQuestions.map((question) => {
                            const isSelected = selectedIds.includes(question.id)
                            return (
                              <article className={`qsf-bank-item ${isSelected ? 'qsf-bank-item--selected' : ''}`} key={question.id}>
                                <label className="qsf-bank-checkbox" aria-label={isSelected ? 'Bỏ chọn câu hỏi' : 'Chọn câu hỏi'}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleQuestion(question.id)}
                                    disabled={isActiveLocked}
                                  />
                                </label>
                                <div className="qsf-bank-item__content">
                                  <h4>{question.stem}</h4>
                                  <div className="qsf-bank-item__meta">
                                    {question.topic && <span className="qsf-meta-chip">{question.topic}</span>}
                                    <span className={`qsf-diff-badge ${getDifficultyClass(question.difficulty)}`}>
                                      {difficultyText(question.difficulty)}
                                    </span>
                                    <span className="qsf-source-text" title={question.sourceDocument || question.questionType || ''}>
                                      {question.sourceDocument || question.questionType || 'Nguồn nội bộ'}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={`qsf-bank-action ${isSelected ? 'qsf-bank-action--selected' : ''}`}
                                  onClick={() => toggleQuestion(question.id)}
                                  disabled={isActiveLocked}
                                >
                                  {isSelected ? <CheckOutlined /> : <PlusOutlined />}
                                  {isSelected ? 'Đã chọn' : 'Thêm'}
                                </button>
                              </article>
                            )
                          })
                        )}
                      </div>

                      <div className="qsf-qpagination-bar">
                        <div className="qsf-qpagination-info">
                          Hiển thị {displayQuestions.length} trong tổng số {qTotalElements} kết quả ({selectedIds.length} câu hỏi đã chọn)
                        </div>
                        <div className="qsf-qpagination-buttons">
                          <button type="button" className="qsf-page-btn" disabled={qPage <= 0} onClick={() => setQPage(qPage - 1)}>&lt;</button>
                          {paginationItems.map((item, index) => (
                            item === 'ellipsis' ? (
                              <span className="qsf-page-ellipsis" key={`ellipsis-${index}`}>...</span>
                            ) : (
                              <button
                                type="button"
                                key={item}
                                className={`qsf-page-btn ${qPage === item ? 'qsf-page-btn--active' : ''}`}
                                onClick={() => setQPage(item)}
                              >
                                {item + 1}
                              </button>
                            )
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

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index)
  }

  if (currentPage <= 3) {
    return [0, 1, 2, 3, 4, 'ellipsis', totalPages - 1]
  }

  if (currentPage >= totalPages - 4) {
    return [0, 'ellipsis', totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1]
  }

  return [0, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages - 1]
}

export default QuestionSetFormPage
