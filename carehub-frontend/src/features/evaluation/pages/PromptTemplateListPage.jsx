import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EditOutlined, PlusCircleOutlined, CheckCircleOutlined, SearchOutlined } from '@ant-design/icons'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { promptTemplateApi } from '../api/promptTemplateApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/EvaluationDashboardPage.css'

function PromptTemplateListPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [templates, setTemplates] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [activating, setActivating] = useState(null)

  const loadTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await promptTemplateApi.list()
      setTemplates(apiData(response, []))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  const handleActivate = async (id) => {
    setActivating(id)
    try {
      await promptTemplateApi.activate(id)
      showToast('Kích hoạt prompt template thành công!', 'success')
      loadTemplates()
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setActivating(null)
    }
  }

  const filteredTemplates = templates.filter((t) => {
    if (!keyword.trim()) return true
    const kw = keyword.toLowerCase()
    return (t.name || '').toLowerCase().includes(kw)
      || (t.provider || '').toLowerCase().includes(kw)
      || (t.model || '').toLowerCase().includes(kw)
  })

  const breadcrumbs = [{ label: 'Prompt Templates' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="evd-page">
              <section className="evd-title-card">
                <div>
                  <h1>Prompt Templates</h1>
                  <p>Quản lý các phiên bản prompt template cho AI generation</p>
                </div>
                <button type="button" className="evd-btn" onClick={() => navigate('/admin/evaluation/prompt-templates/new')} style={{ background: '#1e293b', color: '#fff', borderColor: '#1e293b' }}>
                  <PlusCircleOutlined /> Tạo mới
                </button>
              </section>

              {/* Filter bar */}
              <section className="evd-panel" style={{ padding: 16 }}>
                <div style={{ position: 'relative', maxWidth: 320 }}>
                  <SearchOutlined style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    type="text"
                    placeholder="Tìm kiếm prompt template..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px 8px 36px',
                      border: '1px solid #e5e7eb', borderRadius: 8,
                      fontSize: 13, outline: 'none',
                    }}
                  />
                </div>
              </section>

              {isLoading ? (
                <section className="evd-panel evd-empty">Đang tải dữ liệu...</section>
              ) : (
                <section className="evd-panel" style={{ padding: 0, overflow: 'hidden' }}>
                  <table className="evd-table">
                    <thead>
                      <tr>
                        <th>Tên</th>
                        <th>Provider</th>
                        <th>Model</th>
                        <th>Phiên bản</th>
                        <th>Trạng thái</th>
                        <th>Mô tả</th>
                        <th style={{ width: 140 }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTemplates.length === 0 ? (
                        <tr><td colSpan="7" className="evd-empty">Chưa có prompt template nào.</td></tr>
                      ) : filteredTemplates.map((t) => (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 600 }}>{t.name}</td>
                          <td><code>{t.provider}</code></td>
                          <td><code>{t.model}</code></td>
                          <td>v{t.version}</td>
                          <td>
                            {t.active ? (
                              <span style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircleOutlined /> Đang hoạt động
                              </span>
                            ) : (
                              <span style={{ color: '#9ca3af' }}>Không hoạt động</span>
                            )}
                          </td>
                          <td style={{ color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.description || '--'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className="evd-btn"
                                onClick={() => navigate(`/admin/evaluation/prompt-templates/${t.id}/edit`)}
                                title="Chỉnh sửa"
                              >
                                <EditOutlined />
                              </button>
                              {!t.active && (
                                <button
                                  type="button"
                                  className="evd-btn evd-btn--primary"
                                  onClick={() => handleActivate(t.id)}
                                  disabled={activating === t.id}
                                  title="Kích hoạt"
                                  style={{ fontSize: 12 }}
                                >
                                  <CheckCircleOutlined /> Kích hoạt
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default PromptTemplateListPage
