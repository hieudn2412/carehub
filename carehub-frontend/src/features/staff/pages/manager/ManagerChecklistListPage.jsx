import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ApartmentOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
import Modal from '../../../../shared/components/Modal.jsx'
import { staffApi } from '../../api/staffApi.js'
import '../../styles/ManagerPages.css'

function getAssignedFormsError(error) {
  const statusCode = error?.response?.status

  if (!error?.response) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend và thử lại.'
  }

  if (statusCode === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  }

  if (statusCode === 403) {
    return 'Tài khoản hiện tại không có quyền xem quy trình được giao.'
  }

  return 'Không thể tải danh sách checklist được phân quyền. Vui lòng thử lại.'
}

function formatDateTime(value) {
  if (!value) {
    return 'Không giới hạn'
  }

  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function getVersionNumber(checklist) {
  return checklist.version?.versionNumber
    || checklist.versionNumber
    || checklist.formVersionNumber
    || null
}

function ManagerChecklistListPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isStaffView = location.pathname.startsWith('/staff/')
  const evaluationBasePath = isStaffView
    ? '/staff/checklists'
    : '/manager/quality/checklists'
  const [search, setSearch] = useState('')
  const [checklists, setChecklists] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedDeptChecklist, setSelectedDeptChecklist] = useState(null)

  const fetchAssignedForms = async () => {
    const response = await staffApi.getAssignedForms({
      page: 0,
      size: 100,
      sort: 'id,desc',
    })

    const content = response.data?.data?.content
    const assignedForms = Array.isArray(content) ? content : []

    // The list endpoint already owns the card data. Fetching every assignment
    // detail here caused an N+1 burst; the evaluation screen loads its own
    // detail only after the user chooses a checklist.
    return assignedForms
  }

  const loadAssignedForms = () => {
    setLoading(true)
    setErrorMessage('')

    fetchAssignedForms()
      .then((enrichedForms) => {
        setChecklists(enrichedForms)
      })
      .catch((error) => {
        setChecklists([])
        setErrorMessage(getAssignedFormsError(error))
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    let alive = true

    fetchAssignedForms()
      .then((enrichedForms) => {
        if (alive) {
          setChecklists(enrichedForms)
        }
      })
      .catch((error) => {
        if (alive) {
          setChecklists([])
          setErrorMessage(getAssignedFormsError(error))
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false)
        }
      })

    return () => {
      alive = false
    }
  }, [])

  const filteredChecklists = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) {
      return checklists
    }

    return checklists.filter((checklist) =>
      [checklist.title, checklist.formCode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    )
  }, [checklists, search])

  return (
    <AppShell title={isStaffView ? 'Thực hiện đánh giá được giao' : 'Quy trình chất lượng'}>
      <div className="mgr-toolbar mgr-toolbar--standard">
        <div className="mgr-search-box">
          <input
            type="text"
            placeholder="Tìm quy trình..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <SearchOutlined />
        </div>
        <button
          className="mgr-toolbar__icon-button"
          onClick={loadAssignedForms}
          type="button"
          title="Tải lại danh sách"
          aria-label="Tải lại danh sách"
        >
          <ReloadOutlined />
        </button>
      </div>

      {errorMessage && (
        <div className="mgr-feedback mgr-feedback--error" role="alert">
          <span>{errorMessage}</span>
          <button onClick={loadAssignedForms} type="button">
            <ReloadOutlined /> Thử lại
          </button>
        </div>
      )}

      {loading ? (
        <div className="mgr-card" style={{ minHeight: 180, display: 'grid', placeItems: 'center', color: '#64748b' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <LoadingOutlined spin /> Đang tải quy trình được giao...
          </span>
        </div>
      ) : filteredChecklists.length === 0 ? (
        <div className="mgr-card" style={{ minHeight: 180, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <FileTextOutlined style={{ fontSize: 32, color: '#94a3b8', marginBottom: 10 }} />
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>Chưa có quy trình được giao</h3>
            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
              Quy trình sẽ xuất hiện ở đây sau khi Admin giao đánh giá.
            </p>
          </div>
        </div>
      ) : (
        <div className="mgr-dashboard-grid mgr-checklist-grid">
          {filteredChecklists.map((checklist) => (
            <div key={checklist.assignmentItemId} className="mgr-card mgr-checklist-card">
              <div>
                <div className="mgr-checklist-card__top">
                  <div className="mgr-checklist-card__badges">
                    <span className="mgr-badge mgr-badge--blue" style={{ fontSize: 11 }}>
                      {checklist.formCode}
                    </span>
                    {getVersionNumber(checklist) && (
                      <span className="mgr-badge mgr-badge--purple" style={{ fontSize: 11 }}>
                        v{getVersionNumber(checklist)}
                      </span>
                    )}
                  </div>
                  <span className="mgr-badge mgr-badge--green" style={{ fontSize: 11 }}>Đang hiệu lực</span>
                </div>

                <h3 className="mgr-checklist-card__title">{checklist.title}</h3>

                <div className="mgr-checklist-card__meta">
                  <div>
                    <CalendarOutlined />
                    <span><strong>Bắt đầu:</strong> {formatDateTime(checklist.validFrom)}</span>
                  </div>
                  <div>
                    <CalendarOutlined />
                    <span><strong>Hết hạn:</strong> {formatDateTime(checklist.validUntil)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <ApartmentOutlined />
                    <span><strong>Khoa/phòng:</strong></span>
                    <button
                      type="button"
                      onClick={() => setSelectedDeptChecklist(checklist)}
                      className="mgr-scope-pill-btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 9px',
                        borderRadius: 6,
                        border: '1px solid #087f6a',
                        background: '#f0fdf9',
                        color: '#087f6a',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        lineHeight: 1.4,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#ccfbf1'; e.currentTarget.style.borderColor = '#0f766e' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#f0fdf9'; e.currentTarget.style.borderColor = '#087f6a' }}
                      title="Nhấn để xem danh sách khoa/phòng"
                    >
                      {checklist.allDepartments || !checklist.allowedDepartments || checklist.allowedDepartments.length === 0
                        ? 'Tất cả khoa/phòng'
                        : `${checklist.allowedDepartments.length} khoa/phòng`}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mgr-checklist-card__footer">
                <button
                  onClick={() => navigate(`${evaluationBasePath}/${checklist.assignmentItemId}/evaluate`)}
                  className="training-button training-button--primary"
                  style={{ height: 36, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                  type="button"
                >
                  <PlayCircleOutlined /> Thực hiện đánh giá
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedDeptChecklist && (
        <Modal
          title={`Khoa/phòng áp dụng: ${selectedDeptChecklist.title}`}
          onClose={() => setSelectedDeptChecklist(null)}
          size="md"
          footer={
            <button
              type="button"
              className="training-button"
              onClick={() => setSelectedDeptChecklist(null)}
            >
              Đóng
            </button>
          }
        >
          {selectedDeptChecklist.allDepartments || !selectedDeptChecklist.allowedDepartments || selectedDeptChecklist.allowedDepartments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px' }}>
              <CheckCircleOutlined style={{ fontSize: 40, color: '#16a34a', marginBottom: 12 }} />
              <h4 style={{ margin: 0, fontSize: 16, color: '#0f172a', fontWeight: 700 }}>Áp dụng cho tất cả khoa/phòng</h4>
              <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
                Bạn được phân quyền thực hiện giám sát đánh giá bảng kiểm này đối với nhân viên của tất cả các khoa/phòng trong toàn viện.
              </p>
            </div>
          ) : (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>
                Danh sách các khoa/phòng bạn được phân quyền thực hiện chấm ({selectedDeptChecklist.allowedDepartments.length} khoa):
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, maxHeight: 320, overflowY: 'auto', padding: 2 }}>
                {selectedDeptChecklist.allowedDepartments.map((dept, idx) => (
                  <div key={dept.departmentId || idx} style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ApartmentOutlined style={{ color: '#087f6a', fontSize: 16 }} />
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{dept.departmentName || `Khoa #${dept.departmentId}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
    </AppShell>
  )
}

export default ManagerChecklistListPage
