import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
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
    if (!window.confirm(`Tạm ngưng quy tắc phân loại "${item.name}"?`)) {
      return
    }
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
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
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
                      <th style={{ width: '120px', textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                          Đang tải quy tắc phân loại...
                        </td>
                      </tr>
                    ) : filteredRules.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
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
          </main>
        </div>
      </div>
    </div>
  )
}

export default ClassificationRuleListPage
