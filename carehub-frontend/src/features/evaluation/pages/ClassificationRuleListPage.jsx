import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../../shared/components/AppShell.jsx'
import AdminFilterDisclosure from '../../../shared/components/AdminFilterDisclosure.jsx'
import ConfirmModal from '../../../shared/components/ConfirmModal.jsx'
import FilterSelectField from '../../../shared/components/FilterSelectField.jsx'
import FilterActionButtons from '../../../shared/components/FilterActionButtons.jsx'
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
            <AdminFilterDisclosure activeCount={enabledFilter ? 1 : 0}>
              <FilterSelectField
                label="Trạng thái"
                value={enabledFilter}
                onChange={(value) => setEnabledFilter(value)}
                options={[
                  { value: '', label: 'Trạng thái' },
                  { value: 'true', label: 'Hoạt động' },
                  { value: 'false', label: 'Tạm ngưng' },
                ]}
              />
              <FilterActionButtons
                onApply={() => {}}
                onReset={() => {
                  setKeyword('')
                  setEnabledFilter('')
                }}
              />
            </AdminFilterDisclosure>
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
          <table className="crl-table admin-table-uppercase">
            <colgroup>
              <col className="crl-col-name" />
              <col className="crl-col-category" />
              <col className="crl-col-keywords" />
              <col className="crl-col-source" />
              <col className="crl-col-priority" />
              <col className="crl-col-status" />
              <col className="crl-col-actions" />
            </colgroup>
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
                      <strong className="crl-rule-name">
                        {item.name}
                      </strong>
                    </td>
                    <td><span className="crl-category-name">{item.categoryName}</span></td>
                    <td><span className="crl-cell-muted">{firstKeywords(item.keywords)}</span></td>
                    <td><span className="crl-cell-muted crl-cell-ellipsis">{item.sourcePattern || '-'}</span></td>
                    <td><span className="crl-priority">{item.priority || 0}</span></td>
                    <td>
                      <span className={`crl-status-badge ${item.enabled ? 'crl-status-badge--active' : 'crl-status-badge--inactive'}`}>
                        {item.statusText || (item.enabled ? 'Hoạt động' : 'Tạm ngưng')}
                      </span>
                    </td>
                    <td>
                      <div className="admin-table-actions">
                        <button
                          type="button"
                          className="crl-action-btn crl-action-btn--edit admin-table-action admin-table-action--icon admin-table-action--primary"
                          onClick={() => navigate(`/admin/evaluation/classification-rules/${item.id}/edit`)}
                          title="Chỉnh sửa"
                          aria-label={`Chỉnh sửa quy tắc ${item.name}`}
                        >
                          <EditOutlined />
                        </button>
                        <button
                          type="button"
                          className="crl-action-btn crl-action-btn--delete admin-table-action admin-table-action--icon admin-table-action--danger"
                          onClick={() => handleDelete(item)}
                          title="Tạm ngưng"
                          aria-label={`Tạm ngưng quy tắc ${item.name}`}
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
