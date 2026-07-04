import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarOutlined,
  FileTextOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import Sidebar from '../../components/sidebar'
import Header from '../../components/Header'
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
    return 'Tài khoản hiện tại chưa có quyền manager để xem checklist được giao.'
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
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-layout__content">
        <Header title="Bảng kiểm chất lượng" />
        <div className="dashboard-layout__body">
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Bảng kiểm giám sát</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
              Danh sách các checklist đã được admin phân quyền để manager thực hiện giám sát.
            </p>
          </div>

          <div className="mgr-toolbar">
            <div className="mgr-search-box">
              <input
                type="text"
                placeholder="Tìm bảng kiểm..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <SearchOutlined />
            </div>
            <button
              className="training-button"
              onClick={loadAssignedForms}
              style={{ height: 38, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
              type="button"
            >
              <ReloadOutlined /> Tải lại
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
                <LoadingOutlined spin /> Đang tải checklist được giao...
              </span>
            </div>
          ) : filteredChecklists.length === 0 ? (
            <div className="mgr-card" style={{ minHeight: 180, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
              <div>
                <FileTextOutlined style={{ fontSize: 32, color: '#94a3b8', marginBottom: 10 }} />
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16 }}>Chưa có checklist được giao</h3>
                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
                  Checklist sẽ xuất hiện ở đây sau khi admin phân quyền cho manager.
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
                    </div>
                  </div>

                  <div className="mgr-checklist-card__footer">
                    <button
                      onClick={() => navigate(`/manager/quality/checklists/${checklist.assignmentItemId}/evaluate`)}
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
        </div>
      </div>
    </div>
  )
}

export default ManagerChecklistListPage
