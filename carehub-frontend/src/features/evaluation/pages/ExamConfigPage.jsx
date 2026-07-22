import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckOutlined, SendOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { adminApi } from '../../admin/api/adminApi.js'
import { trainingApi } from '../../training/api/trainingApi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examConfigApi } from '../api/examConfigApi.js'
import { examPaperApi } from '../api/examPaperApi.js'
import { examAssignmentApi } from '../api/examAssignmentApi.js'
import { questionSetApi } from '../api/questionSetApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/ExamPaperPages.css'
import '../styles/ExamConfigPage.css'

const DEFAULT_FORM = {
  name: '',
  questionSetId: '',
  professionalFieldId: '',
  totalQuestions: 30,
  timeLimitMinutes: 45,
  passingScore: 70,
  dueAt: '',
  maxAttempts: 1,
  departmentIds: [],
  userIds: [],
}

function listData(response) {
  const data = apiData(response, [])
  if (Array.isArray(data)) return data
  return Array.isArray(data?.content) ? data.content : []
}

function ExamConfigPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [form, setForm] = useState(DEFAULT_FORM)
  const [questionSets, setQuestionSets] = useState([])
  const [professionalFields, setProfessionalFields] = useState([])
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [keyword, setKeyword] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState('')

  useEffect(() => {
    let active = true
    async function loadOptions() {
      setIsLoading(true)
      try {
        const [setResponse, optionResponse, departmentResponse, userResponse] = await Promise.all([
          questionSetApi.listQuestionSets({ status: 'ACTIVE' }),
          trainingApi.getRecordOptions(),
          adminApi.getDepartments(),
          adminApi.getUsers({ page: 0, size: 100, status: 'ACTIVE' }),
        ])
        if (!active) return
        setQuestionSets(listData(setResponse))
        setProfessionalFields(apiData(optionResponse, {}).professionalFields || [])
        setDepartments(listData(departmentResponse))
        setUsers(listData(userResponse))
      } catch (error) {
        if (active) showToast(apiErrorMessage(error), 'error')
      } finally {
        if (active) setIsLoading(false)
      }
    }
    loadOptions()
    return () => { active = false }
  }, [showToast])

  const selectedSet = useMemo(
    () => questionSets.find((item) => String(item.id) === String(form.questionSetId)),
    [form.questionSetId, questionSets],
  )

  const filteredUsers = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return users.filter((user) => {
      const departmentId = user.departmentId || user.department?.id
      const matchesDepartment = !form.departmentIds.length || form.departmentIds.includes(Number(departmentId))
      const matchesKeyword = !normalized
        || (user.employeeCode || '').toLowerCase().includes(normalized)
        || (user.fullName || user.name || '').toLowerCase().includes(normalized)
        || (user.departmentName || user.department?.name || '').toLowerCase().includes(normalized)
      return matchesDepartment && matchesKeyword
    })
  }, [form.departmentIds, keyword, users])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function toggleId(field, value) {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((id) => id !== value)
        : [...current[field], value],
    }))
  }

  function validate() {
    if (!form.name.trim()) return 'Vui lòng nhập tên bài kiểm tra.'
    if (!form.questionSetId) return 'Vui lòng chọn bộ câu hỏi.'
    if (!form.professionalFieldId) return 'Vui lòng chọn lĩnh vực chuyên môn.'
    if (Number(form.totalQuestions) > Number(selectedSet?.questionCount || 0)) {
      return `Bộ câu hỏi chỉ có ${selectedSet?.questionCount || 0} câu.`
    }
    if (!form.departmentIds.length && !form.userIds.length) return 'Vui lòng chọn khoa/phòng hoặc nhân viên nhận bài.'
    return ''
  }

  async function createAndAssign(event) {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      showToast(validationError, 'warning')
      return
    }

    setIsSubmitting(true)
    try {
      setProgress('Đang tạo cấu hình...')
      const configResponse = await examConfigApi.createExamConfig({
        name: form.name.trim(),
        description: null,
        questionSetId: Number(form.questionSetId),
        totalQuestions: Number(form.totalQuestions),
        timeLimitMinutes: Number(form.timeLimitMinutes),
        passingScore: Number(form.passingScore),
        maxRetakes: Math.max(0, Number(form.maxAttempts) - 1),
        shuffleQuestions: true,
        shuffleOptions: true,
        status: 'ACTIVE',
        distributions: [{
          categoryId: null,
          categoryName: null,
          difficulty: null,
          questionCount: Number(form.totalQuestions),
          required: true,
        }],
      })
      const config = apiData(configResponse)

      setProgress('Đang sinh đề...')
      const paperResponse = await examPaperApi.generateExamPapers({
        examConfigId: Number(config.id),
        namePrefix: form.name.trim(),
        variantCount: 1,
        randomSeed: null,
      })
      const paper = listData(paperResponse)[0]
      if (!paper?.id) throw new Error('Không nhận được bộ đề sau khi sinh.')

      setProgress('Đang phát hành đề...')
      await examPaperApi.publishExamPaper(paper.id)

      setProgress('Đang giao bài...')
      await examAssignmentApi.createAssignment({
        name: form.name.trim(),
        description: null,
        examPaperId: Number(paper.id),
        professionalFieldId: Number(form.professionalFieldId),
        dueAt: form.dueAt || null,
        maxAttempts: Number(form.maxAttempts),
        status: 'OPEN',
        resultVisibility: 'SCORE_ONLY',
        userIds: form.userIds,
        departmentIds: form.departmentIds,
        positionIds: [],
        groupIds: [],
        allEmployees: false,
      })

      showToast('Đã tạo đề và giao bài kiểm tra thành công.', 'success')
      navigate('/admin/evaluation/exam-assignments')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setProgress('')
      setIsSubmitting(false)
    }
  }

  const breadcrumbs = [{ label: 'Tạo & giao bài kiểm tra' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <form className="exp-page exam-flow" onSubmit={createAndAssign}>
              <section className="exp-title-card">
                <div>
                  <h1 className="exp-title">Tạo & giao bài kiểm tra</h1>
                  <p className="exp-subtitle">Nhập thông tin một lần, hệ thống sẽ tự cấu hình, sinh đề, phát hành và giao bài.</p>
                </div>
                <button type="submit" className="exp-btn-primary" disabled={isLoading || isSubmitting}>
                  <SendOutlined /> {progress || 'Tạo và giao bài'}
                </button>
              </section>

              <div className="exam-flow__steps" aria-label="Quy trình tạo bài kiểm tra">
                {['Thiết lập bài kiểm tra', 'Chọn người nhận', 'Tự động sinh và giao đề'].map((label, index) => (
                  <div key={label}><span>{index + 1}</span><strong>{label}</strong></div>
                ))}
              </div>

              <section className="exp-form-card exam-flow__section">
                <header><span>1</span><div><h2>Thông tin bài kiểm tra</h2><p>Chỉ giữ lại các thông tin cần thiết khi tổ chức kiểm tra.</p></div></header>
                <div className="exp-form-grid">
                  <label>
                    Tên bài kiểm tra
                    <input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Ví dụ: Kiểm tra an toàn người bệnh tháng 7" required />
                  </label>
                  <label>
                    Lĩnh vực chuyên môn
                    <select value={form.professionalFieldId} onChange={(event) => update('professionalFieldId', event.target.value)} required>
                      <option value="">Chọn lĩnh vực</option>
                      {professionalFields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}
                    </select>
                  </label>
                  <label className="exam-flow__wide">
                    Bộ câu hỏi
                    <select value={form.questionSetId} onChange={(event) => {
                      const nextId = event.target.value
                      const nextSet = questionSets.find((item) => String(item.id) === nextId)
                      setForm((current) => ({
                        ...current,
                        questionSetId: nextId,
                        totalQuestions: nextSet?.questionCount ? Math.min(30, nextSet.questionCount) : current.totalQuestions,
                      }))
                    }} required>
                      <option value="">Chọn bộ câu hỏi đang hoạt động</option>
                      {questionSets.map((set) => <option key={set.id} value={set.id}>{set.name} ({set.questionCount || 0} câu)</option>)}
                    </select>
                  </label>
                  <label>
                    Số câu
                    <input type="number" min="1" max={selectedSet?.questionCount || undefined} value={form.totalQuestions} onChange={(event) => update('totalQuestions', event.target.value)} required />
                  </label>
                  <label>
                    Thời gian làm bài (phút)
                    <input type="number" min="1" value={form.timeLimitMinutes} onChange={(event) => update('timeLimitMinutes', event.target.value)} required />
                  </label>
                  <label>
                    Điểm đạt (%)
                    <input type="number" min="0" max="100" value={form.passingScore} onChange={(event) => update('passingScore', event.target.value)} required />
                  </label>
                  <label>
                    Số lượt làm tối đa
                    <input type="number" min="1" max="10" value={form.maxAttempts} onChange={(event) => update('maxAttempts', event.target.value)} required />
                  </label>
                  <label>
                    Hạn nộp
                    <input type="datetime-local" value={form.dueAt} onChange={(event) => update('dueAt', event.target.value)} />
                  </label>
                </div>
              </section>

              <section className="exp-form-card exam-flow__section">
                <header><span>2</span><div><h2>Người nhận bài</h2><p>Chọn cả khoa/phòng hoặc thêm từng nhân viên cụ thể.</p></div></header>
                <div className="exam-flow__target-columns">
                  <div>
                    <div className="exam-flow__target-title"><strong>Khoa/phòng</strong><span>{form.departmentIds.length} đã chọn</span></div>
                    <div className="exp-target-list exp-target-list--select">
                      {departments.map((department) => {
                        const id = Number(department.id)
                        return (
                          <label key={id} className="exp-target-item exp-target-item--checkbox">
                            <input type="checkbox" checked={form.departmentIds.includes(id)} onChange={() => toggleId('departmentIds', id)} />
                            <span>{department.name}</span>
                            {form.departmentIds.includes(id) && <CheckOutlined />}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="exam-flow__target-title"><strong>Nhân viên cụ thể</strong><span>{form.userIds.length} đã chọn</span></div>
                    <input className="exam-flow__employee-search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm mã, tên nhân viên..." />
                    <div className="exp-target-list exp-target-list--select">
                      {filteredUsers.map((user) => {
                        const id = Number(user.id)
                        return (
                          <label key={id} className="exp-target-item exp-target-item--checkbox">
                            <input type="checkbox" checked={form.userIds.includes(id)} onChange={() => toggleId('userIds', id)} />
                            <strong>{user.employeeCode}</strong>
                            <span>{user.fullName || user.name}</span>
                            <small>{user.departmentName || user.department?.name || 'Chưa có khoa/phòng'}</small>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </section>

              <section className="exam-flow__submit-card">
                <div><strong>Sẵn sàng tạo bài kiểm tra</strong><span>Đề sẽ được sinh, phát hành và gửi tới người nhận ngay sau khi xác nhận.</span></div>
                <button type="submit" className="exp-btn-primary" disabled={isLoading || isSubmitting}>
                  <SendOutlined /> {progress || 'Tạo và giao bài'}
                </button>
              </section>
            </form>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ExamConfigPage
