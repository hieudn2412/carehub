import { useCallback, useEffect, useMemo, useState } from 'react'
import { SearchOutlined, XOutlined } from '@ant-design/icons'
import AppShell from '../../../shared/components/AppShell.jsx'
import DepartmentCombobox from '../../admin/components/DepartmentCombobox.jsx'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { adminApi } from '../../admin/api/adminApi.js'
import { evaluationAudienceApi } from '../api/evaluationAudienceApi.js'

const ALL = JSON.stringify({ version: 1, all: [{ type: 'ALL_EMPLOYEES' }] }, null, 2)
const TENURE = JSON.stringify({ version: 1, all: [{ type: 'SENIORITY_MONTHS_LT', value: 36 }] }, null, 2)
const GROUP = JSON.stringify({ version: 1, all: [{ type: 'GROUP_IN', ids: [] }] }, null, 2)
const FIELD_SCORE = JSON.stringify({
  version: 1,
  all: [{
    type: 'FIELD_SCORE_LT',
    professionalFieldId: null,
    value: 6,
    attemptSelection: 'LATEST',
    assignmentIds: [],
  }],
}, null, 2)

function extract(response) { return response?.data?.data ?? response?.data ?? null }

export default function EvaluationAudiencePage() {
  const { showToast } = useToast()
  const [audiences, setAudiences] = useState([])
  const [name, setName] = useState('')
  const [mode, setMode] = useState('DEPARTMENT')
  const [ruleJson, setRuleJson] = useState(ALL)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState([])
  const [selectedDepartments, setSelectedDepartments] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [userSearchResults, setUserSearchResults] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])

  const load = useCallback(async () => {
    try {
      const auds = extract(await evaluationAudienceApi.list()) || []
      setAudiences(auds)
      if (mode === 'DEPARTMENT') {
        const depts = extract(await adminApi.getDepartments()) || []
        setDepartments(depts)
      }
    } catch (error) {
      showToast(error?.response?.data?.message || 'Không thể tải đối tượng thi', 'error')
    }
  }, [showToast, mode])

  useEffect(() => { load() }, [load])

  const searchUsers = useCallback(async (query) => {
    if (!query.trim()) { setUserSearchResults([]); return }
    try {
      const res = await adminApi.getUsers({ search: query, size: 10 })
      const users = extract(res)?.content || extract(res) || []
      setUserSearchResults(users)
    } catch (error) {
      showToast(error?.response?.data?.message || 'Không thể tìm kiếm nhân viên', 'error')
    }
  }, [showToast])

  useEffect(() => {
    if (mode === 'USER' && userSearch) {
      const timer = setTimeout(() => searchUsers(userSearch), 300)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [userSearch, mode, searchUsers])

  const runPreview = async () => {
    setLoading(true)
    try { setPreview(extract(await evaluationAudienceApi.preview(ruleJson))) } catch (error) { setPreview(null); showToast(error?.response?.data?.message || 'Rule không hợp lệ', 'error') } finally { setLoading(false) }
  }

  const updateRuleForMode = useCallback(() => {
    if (mode === 'DEPARTMENT' && selectedDepartments.length > 0) {
      const ids = selectedDepartments.map(d => d.id)
      setRuleJson(JSON.stringify({ version: 1, all: [{ type: 'DEPARTMENT_IN', ids }] }, null, 2))
    } else if (mode === 'USER' && selectedUsers.length > 0) {
      const ids = selectedUsers.map(u => u.id)
      setRuleJson(JSON.stringify({ version: 1, all: [{ type: 'USER_IN', ids }] }, null, 2))
    }
  }, [mode, selectedDepartments, selectedUsers])

  useEffect(() => {
    updateRuleForMode()
  }, [updateRuleForMode])

  const save = async () => {
    if (!name.trim()) return showToast('Vui lòng nhập tên đối tượng thi', 'error')
    setLoading(true)
    try {
      await evaluationAudienceApi.create({ name: name.trim(), ruleJson })
      setName('')
      setSelectedDepartments([])
      setSelectedUsers([])
      setUserSearch('')
      setMode('DEPARTMENT')
      await load()
      showToast('Đã lưu đối tượng thi dạng nháp', 'success')
    } catch (error) {
      showToast(error?.response?.data?.message || 'Không thể lưu đối tượng thi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const addDepartment = (deptId) => {
    const dept = departments.find(d => String(d.id) === String(deptId))
    if (dept && !selectedDepartments.some(d => d.id === dept.id)) {
      setSelectedDepartments([...selectedDepartments, dept])
    }
  }

  const removeDepartment = (deptId) => {
    setSelectedDepartments(selectedDepartments.filter(d => d.id !== deptId))
  }

  const addUser = (user) => {
    if (!selectedUsers.some(u => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user])
      setUserSearch('')
      setUserSearchResults([])
    }
  }

  const removeUser = (userId) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId))
  }

  const presets = useMemo(() => [
    ['Toàn bệnh viện', ALL], ['Thâm niên dưới 3 năm', TENURE], ['Nhóm đào tạo', GROUP], ['Chưa đạt một lĩnh vực', FIELD_SCORE],
  ], [])

  return (
    <AppShell title="Đối tượng thi">
      <div className="ch-card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Tạo tiêu chí đối tượng</h2>
        <p className="ch-muted">Chọn cách tạo tiêu chí: theo khoa phòng/mã nhân viên (nhanh) hoặc rule JSON (nâng cao).</p>
        <div className="ch-toolbar" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className={`ch-btn ${mode === 'DEPARTMENT' ? 'ch-btn--primary' : 'ch-btn--secondary'}`} onClick={() => setMode('DEPARTMENT')}>Theo khoa phòng</button>
          <button type="button" className={`ch-btn ${mode === 'USER' ? 'ch-btn--primary' : 'ch-btn--secondary'}`} onClick={() => setMode('USER')}>Theo mã nhân viên</button>
          <button type="button" className={`ch-btn ${mode === 'ADVANCED' ? 'ch-btn--primary' : 'ch-btn--secondary'}`} onClick={() => setMode('ADVANCED')}>Nâng cao (JSON)</button>
        </div>

        <label className="ch-form-field"><span>Tên đối tượng</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Nhân viên dưới 3 năm" /></label>

        {mode === 'DEPARTMENT' && (
          <div className="ch-form-field">
            <span>Chọn khoa phòng</span>
            <DepartmentCombobox
              departments={departments}
              value=""
              onChange={addDepartment}
              placeholder="Tìm và chọn khoa phòng"
              emptyValue=""
            />
            {selectedDepartments.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selectedDepartments.map((dept) => (
                  <div key={dept.id} className="ch-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 4 }}>
                    <span>{dept.name}</span>
                    <button type="button" className="ch-icon-btn" onClick={() => removeDepartment(dept.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                      <XOutlined style={{ fontSize: 12 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === 'USER' && (
          <div className="ch-form-field">
            <span>Tìm kiếm nhân viên</span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
              <SearchOutlined style={{ position: 'absolute', left: 12, fontSize: 14, color: '#999' }} />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Nhập mã hoặc tên nhân viên"
                style={{ paddingLeft: 32, flex: 1 }}
              />
            </div>
            {userSearchResults.length > 0 && (
              <div style={{ marginTop: 8, border: '1px solid #d9d9d9', borderRadius: 4, maxHeight: 240, overflowY: 'auto' }}>
                {userSearchResults
                  .filter(u => !selectedUsers.some(su => su.id === u.id))
                  .map((user) => (
                    <div
                      key={user.id}
                      onClick={() => addUser(user)}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span>{user.employeeCode || `USR-${user.id}`} — {user.fullName || user.username}</span>
                    </div>
                  ))}
              </div>
            )}
            {selectedUsers.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selectedUsers.map((user) => (
                  <div key={user.id} className="ch-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
                    <span>{user.employeeCode || `USR-${user.id}`}</span>
                    <button type="button" className="ch-icon-btn" onClick={() => removeUser(user.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                      <XOutlined style={{ fontSize: 12 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === 'ADVANCED' && (
          <>
            <div className="ch-toolbar" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
              {presets.map(([label, value]) => <button key={label} type="button" className="ch-btn ch-btn--secondary" onClick={() => setRuleJson(value)}>{label}</button>)}
            </div>
            <p className="ch-muted">Với "Chưa đạt một lĩnh vực", nhập professionalFieldId, ngưỡng điểm và có thể giới hạn assignmentIds/khoảng fromDate–toDate; attemptSelection nhận LATEST, FIRST hoặc BEST.</p>
            <label className="ch-form-field"><span>Rule JSON version 1</span><textarea rows={10} value={ruleJson} onChange={(event) => setRuleJson(event.target.value)} /></label>
          </>
        )}

        <div className="ch-toolbar"><button className="ch-btn ch-btn--secondary" type="button" onClick={runPreview} disabled={loading}>Xem preview</button><button className="ch-btn ch-btn--primary" type="button" onClick={save} disabled={loading}>Lưu nháp</button></div>
        {preview && <div className="ch-alert ch-alert--info" style={{ marginTop: 12 }}><strong>{preview.count} người phù hợp</strong><div>{preview.explanation}</div>{preview.missingData?.length > 0 && <div>Thiếu dữ liệu: {preview.missingData.join('; ')}</div>}<div>Bị loại: {preview.excludedCount ?? 0}</div>{preview.fieldScoreMatches?.length > 0 && <div style={{ marginTop: 8 }}><strong>Khớp theo kết quả lĩnh vực:</strong>{preview.fieldScoreMatches.slice(0, 10).map((match) => <div key={`${match.attemptId}-${match.professionalFieldId}`}>{match.employeeCode} · {match.professionalFieldName}: {match.score} điểm · {match.submittedAt} — {match.reason}</div>)}</div>}</div>}
      </div>
      <div className="ch-card"><h2 style={{ marginTop: 0 }}>Đối tượng đã lưu</h2>{audiences.length === 0 ? <p className="ch-muted">Chưa có đối tượng thi.</p> : <div className="ch-table-wrap"><table className="ch-table"><thead><tr><th>Tên</th><th>Phiên bản</th><th>Trạng thái</th><th>Số người preview</th><th>Rule</th></tr></thead><tbody>{audiences.map((item) => <tr key={item.id}><td>{item.name}</td><td>v{item.version}</td><td>{item.status}</td><td>{item.preview?.count ?? 0}</td><td><code>{item.ruleJson}</code></td></tr>)}</tbody></table></div>}</div>
    </AppShell>
  )
}
