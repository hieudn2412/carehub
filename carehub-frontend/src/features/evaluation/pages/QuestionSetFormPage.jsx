import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { SearchOutlined, ArrowLeftOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons'
import '../styles/QuestionSetFormPage.css'

const CATEGORIES = ['Kiểm soát nhiễm khuẩn', 'An toàn sử dụng thuốc', 'An toàn người bệnh', 'Quy trình lâm sàng']

const DEFAULT_QUESTIONS = [
  { id: 1, content: 'Correct hand hygiene technique before patient contact?', category: 'Kiểm soát nhiễm khuẩn', difficulty: 'Dễ' },
  { id: 2, content: 'Steps for safe IV medication administration?', category: 'Quy trình lâm sàng', difficulty: 'Khó' },
  { id: 3, content: 'First action when patient shows signs of anaphylaxis?', category: 'Cấp cứu', difficulty: 'Trung bình' },
  { id: 4, content: 'Purpose of patient wristband identification?', category: 'An toàn người bệnh', difficulty: 'Dễ' },
  { id: 5, content: 'Quy trình bàn giao người bệnh trước khi chuyển giao ca phẫu thuật?', category: 'An toàn người bệnh', difficulty: 'Trung bình' },
  { id: 6, content: 'Kỹ thuật đặt ống thông tiểu lưu cho bệnh nhân nam?', category: 'Quy trình lâm sàng', difficulty: 'Khó' },
  { id: 7, content: 'Các bước chăm sóc và thay băng vết thương nhiễm trùng?', category: 'Quy trình lâm sàng', difficulty: 'Trung bình' },
  { id: 8, content: 'Quy định phân loại chất thải y tế nguy hại tại nguồn?', category: 'Kiểm soát nhiễm khuẩn', difficulty: 'Dễ' },
  { id: 9, content: 'Quy trình xử lý dụng cụ y tế tái sử dụng sau phẫu thuật?', category: 'Kiểm soát nhiễm khuẩn', difficulty: 'Khó' },
  { id: 10, content: 'Quy trình nhận diện người bệnh chính xác khi thực hiện tiêm thuốc?', category: 'An toàn người bệnh', difficulty: 'Dễ' },
  { id: 11, content: 'Quy tắc bảo quản các loại thuốc nguy cơ cao (High Alert Medications)?', category: 'Cấp cứu', difficulty: 'Khó' },
]

function QuestionSetFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = Boolean(id)

  // Form State
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Kiểm soát nhiễm khuẩn')
  const [difficulty, setDifficulty] = useState('Dễ')
  const [active, setActive] = useState(true)
  const [description, setDescription] = useState('')
  const [selectedIds, setSelectedIds] = useState([])

  // Question List State from LocalStorage
  const [questionsList, setQuestionsList] = useState(() => {
    const stored = localStorage.getItem('carehub_questions')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.error('Error parsing stored questions in QuestionSetFormPage:', e)
      }
    }
    return DEFAULT_QUESTIONS
  })

  // Question Search/Filter State
  const [qKeyword, setQKeyword] = useState('')
  const [qCategory, setQCategory] = useState('')
  const [qPage, setQPage] = useState(0)

  // Load existing data if edit mode
  useEffect(() => {
    const stored = localStorage.getItem('carehub_question_sets')
    if (stored) {
      try {
        const list = JSON.parse(stored)
        if (isEditMode) {
          const found = list.find((s) => s.id === Number(id))
          if (found) {
            setName(found.name || '')
            setCategory(found.category || 'Kiểm soát nhiễm khuẩn')
            setDifficulty(found.difficulty || 'Dễ')
            setActive(found.active !== undefined ? found.active : true)
            setDescription(found.description || '')
            setSelectedIds(found.questionIds || [])
          }
        }
      } catch (e) {
        console.error('Error loading question set details:', e)
      }
    }
  }, [id, isEditMode])

  // Filter questions
  const filteredQuestions = questionsList.filter((q) => {
    const matchesKeyword = q.content.toLowerCase().includes(qKeyword.toLowerCase())
    const matchesCategory = qCategory === '' ? true : q.category === qCategory
    return matchesKeyword && matchesCategory
  })

  // Question pagination
  const qPageSize = 4
  const qTotalElements = filteredQuestions.length
  const qTotalPages = Math.ceil(qTotalElements / qPageSize) || 1
  const displayQuestions = filteredQuestions.slice(qPage * qPageSize, (qPage + 1) * qPageSize)

  // Selected state handlers
  const toggleQuestion = (qid) => {
    setSelectedIds((prev) =>
      prev.includes(qid) ? prev.filter((x) => x !== qid) : [...prev, qid]
    )
  }

  // Select all currently visible in displayQuestions
  const displayIds = displayQuestions.map((q) => q.id)
  const isAllDisplayChecked = displayIds.length > 0 && displayIds.every((qid) => selectedIds.includes(qid))

  const toggleSelectAllDisplay = () => {
    if (isAllDisplayChecked) {
      setSelectedIds((prev) => prev.filter((qid) => !displayIds.includes(qid)))
    } else {
      setSelectedIds((prev) => {
        const next = [...prev]
        displayIds.forEach((qid) => {
          if (!next.includes(qid)) {
            next.push(qid)
          }
        })
        return next
      })
    }
  }

  // Save handler
  const handleSave = (e) => {
    e.preventDefault()
    if (!name.trim()) {
      alert('Vui lòng nhập tên bộ câu hỏi!')
      return
    }

    const stored = localStorage.getItem('carehub_question_sets')
    let list = []
    if (stored) {
      try {
        list = JSON.parse(stored)
      } catch (err) {
        console.error(err)
      }
    }

    if (isEditMode) {
      list = list.map((item) =>
        item.id === Number(id)
          ? {
              ...item,
              name: name.trim(),
              category,
              difficulty,
              active,
              description: description.trim(),
              questions: selectedIds.length,
              questionIds: selectedIds,
            }
          : item
      )
    } else {
      const newSet = {
        id: Date.now(),
        name: name.trim(),
        category,
        difficulty,
        active,
        description: description.trim(),
        questions: selectedIds.length,
        questionIds: selectedIds,
      }
      list = [newSet, ...list]
    }

    localStorage.setItem('carehub_question_sets', JSON.stringify(list))
    navigate('/admin/evaluation/question-sets')
  }

  const getDifficultyClass = (diff) => {
    if (diff === 'Dễ') return 'qsf-diff-badge--easy'
    if (diff === 'Trung bình') return 'qsf-diff-badge--medium'
    return 'qsf-diff-badge--hard'
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
                {/* Form Header */}
                <div className="qsf-header">
                  <h2 className="qsf-title">
                    {isEditMode ? 'Cập nhật bộ câu hỏi' : 'Tạo bộ câu hỏi'}
                  </h2>
                  <p className="qsf-subtitle">
                    Gom nhóm các câu hỏi theo chủ đề và độ khó
                  </p>
                </div>

                <form onSubmit={handleSave} className="qsf-form">
                  {/* Top form inputs grid */}
                  <div className="qsf-form-row">
                    <div className="qsf-form-group">
                      <label>
                        Tên bộ câu hỏi <span className="qsf-required-star">*</span>
                      </label>
                      <input
                        type="text"
                        className="qsf-input-green"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nhập tên bộ câu hỏi..."
                      />
                    </div>
                    <div className="qsf-form-group">
                      <label>
                        Danh mục <span className="qsf-required-star">*</span>
                      </label>
                      <select
                        className="qsf-input-red"
                        required
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        {CATEGORIES.map((cat, idx) => (
                          <option key={idx} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="qsf-form-row">
                    <div className="qsf-form-group">
                      <label>
                        Độ khó <span className="qsf-required-star">*</span>
                      </label>
                      <select
                        className="qsf-input-red"
                        required
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                      >
                        <option value="Dễ">Dễ (Easy)</option>
                        <option value="Trung bình">Trung bình (Medium)</option>
                        <option value="Khó">Khó (Hard)</option>
                      </select>
                    </div>
                    <div className="qsf-form-group">
                      <label>Trạng thái</label>
                      <select
                        className="qsf-input-red"
                        value={active.toString()}
                        onChange={(e) => setActive(e.target.value === 'true')}
                      >
                        <option value="true">Hoạt động</option>
                        <option value="false">Ngưng hoạt động</option>
                      </select>
                    </div>
                  </div>

                  <div className="qsf-form-group">
                    <label>Mô tả</label>
                    <textarea
                      className="qsf-input-green"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Mô tả tóm tắt về bộ câu hỏi này..."
                    />
                  </div>

                  {/* Section Divider */}
                  <div className="qsf-section-divider">
                    <span className="qsf-divider-title">CÂU HỎI TRONG BỘ</span>
                  </div>

                  {/* Questions Sub-Card */}
                  <div className="qsf-questions-card">
                    {/* Inner filter bar */}
                    <div className="qsf-qfilter-bar">
                      <div className="qsf-qsearch">
                        <span className="qsf-qsearch-icon">
                          <SearchOutlined />
                        </span>
                        <input
                          type="text"
                          className="qsf-qsearch-input"
                          placeholder="Tìm câu hỏi..."
                          value={qKeyword}
                          onChange={(e) => {
                            setQKeyword(e.target.value)
                            setQPage(0)
                          }}
                        />
                      </div>

                      <select
                        className="qsf-qfilter-select"
                        value={qCategory}
                        onChange={(e) => {
                          setQCategory(e.target.value)
                          setQPage(0)
                        }}
                      >
                        <option value="">Danh mục</option>
                        {CATEGORIES.map((cat, idx) => (
                          <option key={idx} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Table */}
                    <table className="qsf-qtable">
                      <thead>
                        <tr>
                          <th style={{ width: '50px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isAllDisplayChecked}
                              onChange={toggleSelectAllDisplay}
                              style={{ transform: 'scale(1.15)', cursor: 'pointer' }}
                            />
                          </th>
                          <th>Nội dung câu hỏi</th>
                          <th>Danh mục</th>
                          <th style={{ width: '130px' }}>Độ khó</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayQuestions.length === 0 ? (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 0' }}>
                              Không tìm thấy câu hỏi nào.
                            </td>
                          </tr>
                        ) : (
                          displayQuestions.map((q) => (
                            <tr key={q.id} onClick={() => toggleQuestion(q.id)} style={{ cursor: 'pointer' }}>
                              <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(q.id)}
                                  onChange={() => toggleQuestion(q.id)}
                                  style={{ transform: 'scale(1.15)', cursor: 'pointer' }}
                                />
                              </td>
                              <td style={{ fontWeight: 500, color: '#1e293b' }}>{q.content}</td>
                              <td style={{ color: '#475569' }}>{q.category}</td>
                              <td>
                                <span className={`qsf-diff-badge ${getDifficultyClass(q.difficulty)}`}>
                                  {q.difficulty}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Table Pagination Footer */}
                    <div className="qsf-qpagination-bar">
                      <div className="qsf-qpagination-info">
                        Hiển thị {displayQuestions.length} trong tổng số {qTotalElements} kết quả ({selectedIds.length} câu hỏi đã chọn)
                      </div>
                      <div className="qsf-qpagination-buttons">
                        <button
                          type="button"
                          className="qsf-page-btn"
                          disabled={qPage <= 0}
                          onClick={() => setQPage(qPage - 1)}
                        >
                          &lt;
                        </button>
                        {Array.from({ length: qTotalPages }).map((_, idx) => (
                          <button
                            type="button"
                            key={idx}
                            className={`qsf-page-btn ${qPage === idx ? 'qsf-page-btn--active' : ''}`}
                            onClick={() => setQPage(idx)}
                          >
                            {idx + 1}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="qsf-page-btn"
                          disabled={qPage + 1 >= qTotalPages}
                          onClick={() => setQPage(qPage + 1)}
                        >
                          &gt;
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Form Footer Actions */}
                  <div className="qsf-form-actions">
                    <button type="submit" className="qsf-btn-save">
                      Lưu bộ câu hỏi
                    </button>
                    <button
                      type="button"
                      className="qsf-btn-cancel"
                      onClick={() => navigate('/admin/evaluation/question-sets')}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default QuestionSetFormPage
