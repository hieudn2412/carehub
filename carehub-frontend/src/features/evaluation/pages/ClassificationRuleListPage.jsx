import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../../shared/components/AppShell.jsx'
import ConfirmModal from '../../admin/components/ConfirmModal.jsx'
import { EditOutlined, DeleteOutlined, PlusCircleOutlined, SearchOutlined } from '@ant-design/icons'
import { useToast } from '../../../shared/context/ToastContext.jsx'
import { classificationRuleApi } from '../api/classificationRuleApi.js'
import { apiData, apiErrorMessage } from '../utils/documentQuestionUi.js'
import '../styles/ClassificationRuleListPage.css'

function ClassificationRuleListPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [rules, setRules] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [enabledFilter, setEnabledFilter] = useState('')
  const [pendingDisable, setPendingDisable] = useState(null)
  
  const loadRules = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await classificationRuleApi.listRules({})
      setRules(apiData(response, []))
    } catch (error) {
      showToast(apiErrorMessage(error), 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    // Hydrate classification rules when the screen mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRules()
  }, [loadRules])

  const filteredRules = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    return rules.filter((rule) => {
      const matchesKeyword = !normalized
        || (rule.name || '').toLowerCase().includes(normalized)
        || (rule.categoryName || '').toLowerCase().includes(normalized)
        || (rule.keywords || '').toLowerCase().includes(normalized)
        || (rule.sourcePattern || '').toLowerCase().includes(normalized)
      const matchesStatus = enabledFilter === ''
        || (enabledFilter === 'true' ? rule.enabled : !rule.enabled)
      return matchesKeyword && matchesStatus
    })
  }, [enabledFilter, keyword, rules])

  const handleDelete = (item) => {
    setPendingDisable(item)
  }

  const confirmDisable = () => {
    if (!pendingDisable) return
    const item = pendingDisable
    setPendingDisable(null)
    classificationRuleApi.disableRule(item.id)
      .then(() => {
        showToast('Đã tạm ngưng quy tắc phân loại.', 'success')
        loadRules()
      })
      .catch((error) => showToast(apiErrorMessage(error), 'error'))
  }

  const firstKeywords = (value) => {
    const list = String(value || '')
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
    return list.length <= 3 ? list.join(', ') : `${list.slice(0, 3).join(', ')}...`
  }

  const breadcrumbs = [{ label: 'Quy tắc phân loại' }]

  return (
    <AppShell breadcrumbs={breadcrumbs}>
      <div className="crl-page">
        {/* Title Card */}
        <div className="crl-title-card">
          <h1 className="crl-title">Quy tắc phân loại câu hỏi</h1>
          <p className="crl-subtitle">
            Tự động gán danh mục cho câu hỏi theo từ khóa, nguồn tài liệu và mức ưu tiên
          </p>
        </div>

        <div className="crl-filter-bar">
          <div className="crl-filter-left">
            <div className="crl-search">
              <span className="crl-search-icon">
                <SearchOutlined />
              </span>
              <input
                type="text"
                className="crl-search-input"
                placeholder="Tìm quy tắc..."
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>
            <select
              className="crl-filter-select"
              value={enabledFilter}
              onChange={(event) => setEnabledFilter(event.target.value)}
            >
              <option value="">Trạng thái</option>
              <option value="true">Hoạt động</option>
              <option value="false">Tạm ngưng</option>
            </select>
          </div>
          <button 
            className="crl-btn-add" 
            onClick={() => navigate('/admin/evaluation/classification-rules/new')}
          >
            <PlusCircleOutlined /> Thêm quy tắc
          </button>
        </div>

        {/* Table Card */}
        <div className="crl-table-card">
          <table className="crl-table">
            <thead>
              <tr>
                <th>Tên quy tắc</th>
                <th>Danh mục</th>
                <th>Từ khóa</th>
                <th>Nguồn</th>
                <th>Ưu tiên</th>
                <th>Trạng thái</th>
                <th className="crl-th-actions">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="ch-empty">
                    Đang tải quy tắc phân loại...
                  </td>
                </tr>
              ) : filteredRules.length === 0 ? (
                <tr>
                  <td colSpan="7" className="ch-empty">
                    Chưa có quy tắc phân loại nào được tạo.
                  </td>
                </tr>
              ) : (
                filteredRules.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="crl-badge crl-badge--blue">
                        {item.name}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#334155' }}>{item.categoryName}</td>
                    <td style={{ color: '#475569' }}>{firstKeywords(item.keywords)}</td>
                    <td style={{ color: '#475569' }}>{item.sourcePattern || '-'}</td>
                    <td style={{ fontWeight: 600, color: '#334155' }}>{item.priority || 0}</td>
                    <td>
                      <span className={`crl-status-badge ${item.enabled ? 'crl-status-badge--active' : 'crl-status-badge--inactive'}`}>
                        {item.statusText || (item.enabled ? 'Hoạt động' : 'Tạm ngưng')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="crl-action-btn crl-action-btn--edit"
                          onClick={() => navigate(`/admin/evaluation/classification-rules/${item.id}/edit`)}
                          title="Chỉnh sửa"
                        >
                          <EditOutlined />
                        </button>
                        <button
                          type="button"
                          className="crl-action-btn crl-action-btn--delete"
                          onClick={() => handleDelete(item)}
                          title="Tạm ngưng"
                          disabled={!item.enabled}
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmModal
        isOpen={Boolean(pendingDisable)}
        title="Tạm ngưng quy tắc?"
        message={pendingDisable ? `Quy tắc “${pendingDisable.name}” sẽ dừng tự động gán danh mục cho các câu hỏi mới.` : ''}
        confirmText="Tạm ngưng quy tắc"
        danger
        onCancel={() => setPendingDisable(null)}
        onConfirm={confirmDisable}
      />
    </AppShell>
  )
}

export default ClassificationRuleListPage
