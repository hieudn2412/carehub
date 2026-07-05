import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SaveOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar.jsx'
import AdminHeader from '../../admin/components/AdminHeader.jsx'
import { adminApi } from '../../admin/api/adminApi.js'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { examAssignmentApi } from '../api/examAssignmentApi.js'
import { examPaperApi } from '../api/examPaperApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/ExamPaperPages.css'

function ExamAssignmentFormPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [papers, setPapers] = useState([])
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    examPaperId: '',
    dueAt: '',
    maxAttempts: 1,
    status: 'OPEN',
    userIds: [],
    departmentIds: [],
    resultVisibility: 'SCORE_ONLY',
  })

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const [paperResponse, userResponse, departmentResponse] = await Promise.all([
          examPaperApi.listExamPapers({ status: 'PUBLISHED' }),
          adminApi.getUsers({ page: 0, size: 100, status: 'ACTIVE' }),
          adminApi.getDepartments(),
        ])
        setPapers(apiData(paperResponse, []))
        const userData = apiData(userResponse, {})
        setUsers(Array.isArray(userData) ? userData : userData.content || [])
        const departmentData = apiData(departmentResponse, [])
        setDepartments(Array.isArray(departmentData) ? departmentData : departmentData.content || [])
      } catch (error) {
        showToast(apiErrorMessage(error), 'error')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [showToast])

  const filteredUsers = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    if (!normalized) return users
    return users.filter((user) => (
      (user.employeeCode || '').toLowerCase().includes(normalized)
      || (user.name || '').toLowerCase().includes(normalized)
      || (user.departmentName || user.department?.name || '').toLowerCase().includes(normalized)
    ))
  }, [keyword, users])

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function toggleUser(userId) {
    setForm((current) => {
      const exists = current.userIds.includes(userId)
      return {
        ...current,
        userIds: exists
          ? current.userIds.filter((id) => id !== userId)
          : [...current.userIds, userId],
      }
    })
  }

  function toggleDepartment(departmentId) {
    setForm((current) => {
      const exists = current.departmentIds.includes(departmentId)
      return {
        ...current,
        departmentIds: exists
          ? current.departmentIds.filter((id) => id !== departmentId)
          : [...current.departmentIds, departmentId],
      }
    })
  }

  async function saveAssignment(event) {
    event.preventDefault()
    setIsSaving(true)
    try {
      await examAssignmentApi.createAssignment({
        name: form.name,
        description: form.description,
        examPaperId: Number(form.examPaperId),
        dueAt: form.dueAt || null,
        maxAttempts: Number(form.maxAttempts),
        status: form.status,
        userIds: form.userIds,
        departmentIds: form.departmentIds,
        resultVisibility: form.resultVisibility,
      })
      showToast('Đã tạo phân công kiểm tra.', 'success')
      navigate('/admin/evaluation/exam-assignments')
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const breadcrumbs = [
    { label: 'Phân công kiểm tra', path: '/admin/evaluation/exam-assignments' },
    { label: 'Tạo phân công' },
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <form className="exp-page" onSubmit={saveAssignment}>
              <div className="exp-title-card">
                <div>
                  <h1 className="exp-title">Tạo phân công kiểm tra</h1>
                  <p className="exp-subtitle">Chọn bộ đề đã phát hành, hạn nộp và danh sách nhân viên nhận bài</p>
                </div>
                <div className="exp-title-actions">
                  <button type="button" className="exp-btn-secondary" onClick={() => navigate('/admin/evaluation/exam-assignments')}>Hủy</button>
                  <button type="submit" className="exp-btn-primary" disabled={isSaving || isLoading}>
                    <SaveOutlined /> Lưu phân công
                  </button>
                </div>
              </div>

              <div className="exp-form-card">
                <label>
                  Tên phân công
                  <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
                </label>
                <label>
                  Mô tả
                  <input value={form.description} onChange={(event) => updateField('description', event.target.value)} />
                </label>
                <label>
                  Bộ đề kiểm tra
                  <select value={form.examPaperId} onChange={(event) => updateField('examPaperId', event.target.value)} required>
                    <option value="">Chọn bộ đề đã phát hành</option>
                    {papers.map((paper) => (
                      <option key={paper.id} value={paper.id}>{paper.code} - {paper.name}</option>
                    ))}
                  </select>
                </label>
                <div className="exp-form-grid">
                  <label>
                    Hạn nộp
                    <input type="datetime-local" value={form.dueAt} onChange={(event) => updateField('dueAt', event.target.value)} />
                  </label>
                  <label>
                    Số lượt tối đa
                    <input type="number" min="1" max="10" value={form.maxAttempts} onChange={(event) => updateField('maxAttempts', event.target.value)} />
                  </label>
                  <label>
                    Trạng thái sau khi tạo
                    <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                      <option value="OPEN">Đang mở</option>
                      <option value="DRAFT">Bản nháp</option>
                    </select>
                  </label>
                  <label>
                    Chế độ xem kết quả
                    <select value={form.resultVisibility} onChange={(event) => updateField('resultVisibility', event.target.value)}>
                      <option value="SCORE_ONLY">Chỉ hiển thị điểm</option>
                      <option value="SCORE_AND_ANSWERS">Hiển thị điểm, đáp án và giải thích</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="exp-form-card">
                <div className="exp-question-head">
                  <strong>Khoa/phòng nhận bài</strong>
                  <span>{form.departmentIds.length} đã chọn</span>
                </div>
                <div className="exp-target-list exp-target-list--select">
                  {departments.map((department) => {
                    const departmentId = Number(department.id)
                    return (
                      <label key={department.id} className="exp-target-item exp-target-item--checkbox">
                        <input
                          type="checkbox"
                          checked={form.departmentIds.includes(departmentId)}
                          onChange={() => toggleDepartment(departmentId)}
                        />
                        <strong>{department.departmentCode || `PB-${department.id}`}</strong>
                        <span>{department.name}</span>
                        <small>{department.description || 'Tất cả nhân viên đang hoạt động trong khoa/phòng này'}</small>
                      </label>
                    )
                  })}
                  {!isLoading && departments.length === 0 && <div className="exp-empty">Chưa có khoa/phòng để chọn.</div>}
                </div>
              </div>

              <div className="exp-form-card">
                <div className="exp-question-head">
                  <strong>Nhân viên nhận bài</strong>
                  <span>{form.userIds.length} đã chọn</span>
                </div>
                <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm mã nhân viên, tên, phòng ban..." />
                <div className="exp-target-list exp-target-list--select">
                  {filteredUsers.map((user) => {
                    const userId = Number(user.id)
                    return (
                      <label key={user.id} className="exp-target-item exp-target-item--checkbox">
                        <input type="checkbox" checked={form.userIds.includes(userId)} onChange={() => toggleUser(userId)} />
                        <strong>{user.employeeCode}</strong>
                        <span>{user.name}</span>
                        <small>{user.departmentName || user.department?.name || 'Chưa có phòng ban'}</small>
                      </label>
                    )
                  })}
                  {!isLoading && filteredUsers.length === 0 && <div className="exp-empty">Không có nhân viên phù hợp.</div>}
                </div>
              </div>
            </form>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ExamAssignmentFormPage
