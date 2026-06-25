import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { EditOutlined, DeleteOutlined, PlusCircleOutlined } from '@ant-design/icons'
import '../styles/ClassificationRuleListPage.css'

const INITIAL_RULES = [
  { id: 1, name: 'Xuất sắc', minOverall: 90, maxOverall: null, minKnowledge: 90, minPractice: 90, color: 'Xanh lá', active: true },
  { id: 2, name: 'Giỏi', minOverall: 75, maxOverall: 89, minKnowledge: 75, minPractice: 75, color: 'Xanh dương', active: true },
  { id: 3, name: 'Trung bình', minOverall: 60, maxOverall: 74, minKnowledge: 60, minPractice: 60, color: 'Vàng', active: true },
  { id: 4, name: 'Không đạt', minOverall: 0, maxOverall: 59, minKnowledge: null, minPractice: null, color: 'Đỏ', active: true },
]

function ClassificationRuleListPage() {
  const navigate = useNavigate()
  
  const [rules, setRules] = useState(() => {
    const stored = localStorage.getItem('carehub_classification_rules')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.error('Error parsing stored classification rules:', e)
      }
    }
    localStorage.setItem('carehub_classification_rules', JSON.stringify(INITIAL_RULES))
    return INITIAL_RULES
  })

  // Sync back to localStorage
  useEffect(() => {
    localStorage.setItem('carehub_classification_rules', JSON.stringify(rules))
  }, [rules])

  const handleDelete = (item) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa quy tắc phân loại "${item.name}" không?`)) {
      return
    }
    setRules((prev) => prev.filter((r) => r.id !== item.id))
  }

  // Format Overall Score Range
  const formatScoreRange = (rule) => {
    const min = Number(rule.minOverall)
    const max = rule.maxOverall !== null && rule.maxOverall !== '' ? Number(rule.maxOverall) : null

    if (max === null) {
      return `≥ ${min}%`
    }
    if (min === 0) {
      return `< ${max + 1}%`
    }
    return `${min}–${max}%`
  }

  // Format Sub Score minimums
  const formatMinScore = (val) => {
    if (val === null || val === undefined || val === '') {
      return '—'
    }
    return `≥ ${val}%`
  }

  // Get Color Indicator Dots & Labels
  const getColorDot = (colorName) => {
    let dotColor = '#10b981' // Xanh lá
    let textColor = '#10b981'
    if (colorName === 'Xanh dương') {
      dotColor = '#2563eb'
      textColor = '#2563eb'
    } else if (colorName === 'Vàng') {
      dotColor = '#eab308'
      textColor = '#d97706'
    } else if (colorName === 'Đỏ') {
      dotColor = '#ef4444'
      textColor = '#ef4444'
    }

    return (
      <span className="crl-color-wrap" style={{ color: textColor }}>
        <span className="crl-color-dot" style={{ backgroundColor: dotColor }} />
        {colorName}
      </span>
    )
  }

  const getBadgeClass = (colorName) => {
    if (colorName === 'Xanh lá') return 'crl-badge--green'
    if (colorName === 'Xanh dương') return 'crl-badge--blue'
    if (colorName === 'Vàng') return 'crl-badge--yellow'
    return 'crl-badge--red'
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
                <h1 className="crl-title">Quy tắc phân loại năng lực</h1>
                <p className="crl-subtitle">
                  Định nghĩa ngưỡng điểm và các mức xếp loại năng lực của nhân viên
                </p>
              </div>

              {/* Table Card */}
              <div className="crl-table-card">
                <table className="crl-table">
                  <thead>
                    <tr>
                      <th>Xếp loại</th>
                      <th>Score range</th>
                      <th>Knowledge min</th>
                      <th>Practice min</th>
                      <th>Color</th>
                      <th>Trạng thái</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                          Chưa có quy tắc phân loại nào được tạo.
                        </td>
                      </tr>
                    ) : (
                      rules.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <span className={`crl-badge ${getBadgeClass(item.color)}`}>
                              {item.name}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: '#334155' }}>
                            {formatScoreRange(item)}
                          </td>
                          <td style={{ color: '#475569' }}>
                            {formatMinScore(item.minKnowledge)}
                          </td>
                          <td style={{ color: '#475569' }}>
                            {formatMinScore(item.minPractice)}
                          </td>
                          <td>
                            {getColorDot(item.color)}
                          </td>
                          <td>
                            <span className={`crl-status-badge ${item.active ? 'crl-status-badge--active' : 'crl-status-badge--inactive'}`}>
                              {item.active ? 'Hoạt động' : 'Ngưng'}
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
                                title="Xóa"
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

                {/* Footer action button directly inside the table card */}
                <div className="crl-card-footer">
                  <button 
                    className="crl-btn-add" 
                    onClick={() => navigate('/admin/evaluation/classification-rules/new')}
                  >
                    <PlusCircleOutlined /> Thêm phân loại
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ClassificationRuleListPage
