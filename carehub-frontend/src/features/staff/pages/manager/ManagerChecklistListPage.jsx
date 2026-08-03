import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarOutlined,
  FileTextOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import AppShell from '../../../../shared/components/AppShell.jsx'
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
  const evaluationBasePath = location.pathname.startsWith('/staff/')
    ? '/staff/checklists'
    : '/manager/quality/checklists'
  const [search, setSearch] = useState('')
  const [checklists, setChecklists] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const fetchAssignedForms = async () => {
    const response = await staffApi.getAssignedForms({
      page: 0,
      size: 100,
      sort: 'id,desc',
    })

    const content = response.data?.data?.content
    const assignedForms = Array.isArray(content) ? content : []

    return Promise.all(
      assignedForms.map(async (checklist) => {
        if (getVersionNumber(checklist) || !checklist.assignmentItemId) {
          return checklist
        }

        try {
          const detailResponse = await staffApi.getAssignedForm(checklist.assignmentItemId)
          return {
            ...checklist,
            version: detailResponse.data?.data?.version || checklist.version,
          }
        } catch {
          return checklist
        }
      }),
    )
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
    <AppShell title="Quy trình chất lượng">
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
                    {checklist.version?.passingScore !== undefined && checklist.version?.passingScore !== null && (
                      <span className="mgr-badge" style={{ fontSize: 11, background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0' }}>
                        Sàn: {Number(checklist.version.passingScore).toFixed(1)}/10
                      </span>
                    )}
                    <span className="mgr-badge" style={{ fontSize: 11, background: '#fff7ed', color: '#b45309', border: '1px solid #fed7aa' }}>
                      Mục tiêu: {Number(checklist.complianceTargetPercent ?? 80).toLocaleString('vi-VN')}%
                    </span>
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
    </AppShell>
  )
}

export default ManagerChecklistListPage
