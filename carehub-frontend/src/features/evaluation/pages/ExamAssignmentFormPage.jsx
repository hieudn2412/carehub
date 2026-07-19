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
        const userList = Array.isArray(userData) ? userData : userData.content || []
        setUsers(userList)

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
    const filtered = normalized
      ? users.filter((user) => (
        (user.employeeCode || '').toLowerCase().includes(normalized)
        || (user.fullName || user.name || '').toLowerCase().includes(normalized)
        || (user.departmentName || user.department?.name || '').toLowerCase().includes(normalized)
      ))
      : users
    if (form.departmentIds.length === 0) {
      return filtered
    }
    return filtered.filter((user) => {
      const userDeptId = user.departmentId || user.department?.id
      return userDeptId && form.departmentIds.includes(Number(userDeptId))
    })
  }, [keyword, users, form.departmentIds])

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

  function selectAllFiltered() {
    const ids = filteredUsers.map((u) => Number(u.id))
    setForm((current) => ({ ...current, userIds: [...new Set([...current.userIds, ...ids])] }))
  }

  function deselectAllFiltered() {
    const ids = new Set(filteredUsers.map((u) => Number(u.id)))
    setForm((current) => ({ ...current, userIds: current.userIds.filter((id) => !ids.has(id)) }))
  }

  async function saveAssignment(event) {
    event.preventDefault()
    if (!form.name.trim()) {
      showToast('Vui lòng nhập tên phân công.', 'warning')
      return
    }
    if (!form.examPaperId) {
      showToast('Vui lòng chọn bộ đề kiểm tra.', 'warning')
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description,
        examPaperId: Number(form.examPaperId),
        dueAt: form.dueAt || null,
        maxAttempts: Number(form.maxAttempts),
        status: form.status,
        resultVisibility: form.resultVisibility,
        userIds: form.userIds,
        departmentIds: form.departmentIds,
      }
      await examAssignmentApi.createAssignment(payload)
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
                  <p className="exp-subtitle">Chọn bộ đề đã phát hành, hạn nộp và đối tượng nhận bài</p>
                </div>
                <div className="exp-title-actions">
                  <button type="button" className="exp-btn-secondary" onClick={() => navigate('/admin/evaluation/exam-assignments')}>Hủy</button>
                  <button type="submit" className="exp-btn-primary" disabled={isSaving || isLoading}>
                    <SaveOutlined /> Lưu phân công
                  </button>
                </div>
              </div>

              <div className="exp-form-card">
                <div className="exp-form-grid">
                  <label>
                    Tên phân công
                    <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
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
                  <label>
                    Hạn nộp
                    <input type="datetime-local" value={form.dueAt} onChange={(event) => updateField('dueAt', event.target.value)} />
                  </label>
                  <label>
                    Số lượt tối đa
                    <input type="number" min="1" max="10" value={form.maxAttempts} onChange={(event) => updateField('maxAttempts', event.target.value)} />
                  </label>
                  <label>
                    Trạng thái
                    <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
                      <option value="OPEN">Đang mở</option>
                      <option value="DRAFT">Bản nháp</option>
                    </select>
                  </label>
                  <label>
                    Hiển thị kết quả
                    <select value={form.resultVisibility} onChange={(event) => updateField('resultVisibility', event.target.value)}>
                      <option value="SCORE_ONLY">Chỉ điểm</option>
                      <option value="SCORE_AND_ANSWERS">Điểm + đáp án + giải thích</option>
                    </select>
                  </label>
                </div>
                <label>
                  Mô tả
                  <input value={form.description} onChange={(event) => updateField('description', event.target.value)} />
                </label>
              </div>

              <div className="exp-form-card">
                <div className="exp-question-head">
                  <strong>Khoa/phòng nhận bài</strong>
                  <span>{form.departmentIds.length} đã chọn</span>
                </div>
                <div className="exp-target-list exp-target-list--select">
                  {departments.map((department) => {
                    const deptId = Number(department.id)
                    return (
                      <label key={department.id} className="exp-target-item exp-target-item--checkbox">
                        <input type="checkbox" checked={form.departmentIds.includes(deptId)} onChange={() => toggleDepartment(deptId)} />
                        <strong>{department.departmentCode || `PB-${department.id}`}</strong>
                        <span>{department.name}</span>
                      </label>
                    )
                  })}
                  {!isLoading && departments.length === 0 && <div className="exp-empty">Chưa có khoa/phòng để chọn.</div>}
                </div>
              </div>

              <div className="exp-form-card">
                <div className="exp-question-head">
                  <strong>Nhân viên nhận bài</strong>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span>{form.userIds.length} đã chọn</span>
                    <button type="button" className="exp-btn-secondary" style={{ fontSize: 11, padding: '2px 8px', minHeight: 'auto' }} onClick={selectAllFiltered}>Chọn tất cả</button>
                    <button type="button" className="exp-btn-secondary" style={{ fontSize: 11, padding: '2px 8px', minHeight: 'auto' }} onClick={deselectAllFiltered}>Bỏ tất cả</button>
                  </div>
                </div>
                <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm mã nhân viên, tên, phòng ban" />
                <div className="exp-target-list exp-target-list--select">
                  {filteredUsers.map((user) => {
                    const userId = Number(user.id)
                    return (
                      <label key={user.id} className="exp-target-item exp-target-item--checkbox">
                        <input type="checkbox" checked={form.userIds.includes(userId)} onChange={() => toggleUser(userId)} />
                        <strong>{user.employeeCode}</strong>
                        <span>{user.fullName || user.name}</span>
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
