import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { WarningOutlined } from '@ant-design/icons'
import '../styles/ClassificationRuleFormPage.css'

const COLOR_OPTIONS = [
  { name: 'Xanh lá', hex: '#10b981' },
  { name: 'Xanh dương', hex: '#2563eb' },
  { name: 'Vàng', hex: '#eab308' },
  { name: 'Đỏ', hex: '#ef4444' },
]

function ClassificationRuleFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = Boolean(id)

  // Form State
  const [name, setName] = useState('')
  const [active, setActive] = useState(true)
  const [minOverall, setMinOverall] = useState('')
  const [maxOverall, setMaxOverall] = useState('')
  const [minKnowledge, setMinKnowledge] = useState('')
  const [minPractice, setMinPractice] = useState('')
  const [color, setColor] = useState('Vàng')

  // Load existing rule details if edit mode
  useEffect(() => {
    if (isEditMode) {
      const stored = localStorage.getItem('carehub_classification_rules')
      if (stored) {
        try {
          const list = JSON.parse(stored)
          const found = list.find((r) => r.id === Number(id))
          if (found) {
            setName(found.name || '')
            setActive(found.active !== undefined ? found.active : true)
            setMinOverall(found.minOverall !== null && found.minOverall !== undefined ? found.minOverall : '')
            setMaxOverall(found.maxOverall !== null && found.maxOverall !== undefined ? found.maxOverall : '')
            setMinKnowledge(found.minKnowledge !== null && found.minKnowledge !== undefined ? found.minKnowledge : '')
            setMinPractice(found.minPractice !== null && found.minPractice !== undefined ? found.minPractice : '')
            setColor(found.color || 'Vàng')
          }
        } catch (e) {
          console.error('Error loading classification rule details:', e)
        }
      }
    }
  }, [id, isEditMode])

  const handleSave = (e) => {
    e.preventDefault()

    if (!name.trim()) {
      alert('Vui lòng nhập tên xếp loại!')
      return
    }

    if (minOverall === '') {
      alert('Vui lòng nhập điểm tổng tối thiểu (%)!')
      return
    }

    const stored = localStorage.getItem('carehub_classification_rules')
    let list = []
    if (stored) {
      try {
        list = JSON.parse(stored)
      } catch (err) {
        console.error(err)
      }
    }

    const ruleData = {
      name: name.trim(),
      active,
      minOverall: minOverall !== '' ? Number(minOverall) : 0,
      maxOverall: maxOverall !== '' ? Number(maxOverall) : null,
      minKnowledge: minKnowledge !== '' ? Number(minKnowledge) : null,
      minPractice: minPractice !== '' ? Number(minPractice) : null,
      color,
    }

    if (isEditMode) {
      list = list.map((item) =>
        item.id === Number(id)
          ? {
              ...item,
              ...ruleData,
            }
          : item
      )
    } else {
      const newRule = {
        id: Date.now(),
        ...ruleData,
      }
      list = [...list, newRule]
    }

    localStorage.setItem('carehub_classification_rules', JSON.stringify(list))
    navigate('/admin/evaluation/classification-rules')
  }

  const getBadgeClass = (colorName) => {
    if (colorName === 'Xanh lá') return 'crf-badge--green'
    if (colorName === 'Xanh dương') return 'crf-badge--blue'
    if (colorName === 'Vàng') return 'crf-badge--yellow'
    return 'crf-badge--red'
  }

  const breadcrumbs = [
    { label: 'Quy tắc phân loại', path: '/admin/evaluation/classification-rules' },
    { label: isEditMode ? 'Chỉnh sửa' : 'Tạo mới' },
  ]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="crf-page">
              <div className="crf-container">
                {/* Header */}
                <div className="crf-header">
                  <h2 className="crf-title">
                    {isEditMode ? 'Cập nhật quy tắc phân loại' : 'Thêm quy tắc phân loại'}
                  </h2>
                  <p className="crf-subtitle">
                    Cấu hình ngưỡng điểm và nhãn cho mức xếp loại này
                  </p>
                </div>

                <form onSubmit={handleSave} className="crf-form">
                  {/* Row 1 */}
                  <div className="crf-form-row">
                    <div className="crf-form-group">
                      <label>
                        Tên xếp loại (Classification name) <span className="crf-required-star">*</span>
                      </label>
                      <input
                        type="text"
                        className="crf-input-red"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ví dụ: Xuất sắc, Giỏi..."
                      />
                    </div>
                    <div className="crf-form-group">
                      <label>
                        Trạng thái (Status) <span className="crf-required-star">*</span>
                      </label>
                      <select
                        className="crf-input-red"
                        required
                        value={active.toString()}
                        onChange={(e) => setActive(e.target.value === 'true')}
                      >
                        <option value="true">Hoạt động (Active)</option>
                        <option value="false">Ngưng hoạt động (Inactive)</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="crf-form-row">
                    <div className="crf-form-group">
                      <label>
                        Điểm tổng tối thiểu (%) <span className="crf-required-star">*</span>
                      </label>
                      <input
                        type="number"
                        className="crf-input-red"
                        required
                        min="0"
                        max="100"
                        value={minOverall}
                        onChange={(e) => setMinOverall(e.target.value)}
                        placeholder="Ví dụ: 90"
                      />
                    </div>
                    <div className="crf-form-group">
                      <label>Điểm tổng tối đa (%)</label>
                      <input
                        type="number"
                        className="crf-input-red"
                        min="0"
                        max="100"
                        value={maxOverall}
                        onChange={(e) => setMaxOverall(e.target.value)}
                        placeholder="Bỏ trống đối với bậc cao nhất"
                      />
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div className="crf-form-row">
                    <div className="crf-form-group">
                      <label>Điểm lý thuyết tối thiểu (%)</label>
                      <input
                        type="number"
                        className="crf-input-red"
                        min="0"
                        max="100"
                        value={minKnowledge}
                        onChange={(e) => setMinKnowledge(e.target.value)}
                        placeholder="Ví dụ: 90"
                      />
                    </div>
                    <div className="crf-form-group">
                      <label>Điểm thực hành tối thiểu (%)</label>
                      <input
                        type="number"
                        className="crf-input-red"
                        min="0"
                        max="100"
                        value={minPractice}
                        onChange={(e) => setMinPractice(e.target.value)}
                        placeholder="Ví dụ: 90"
                      />
                    </div>
                  </div>

                  {/* Badge Color Selector */}
                  <div className="crf-section-divider">
                    <span className="crf-divider-title">MÀU SẮC BADGE (BADGE COLOR)</span>
                  </div>

                  <div className="crf-color-selector">
                    {COLOR_OPTIONS.map((opt) => {
                      const isSelected = color === opt.name
                      return (
                        <div
                          key={opt.name}
                          className={`crf-color-card ${isSelected ? 'crf-color-card--selected' : ''}`}
                          onClick={() => setColor(opt.name)}
                        >
                          <div className="crf-color-card-left">
                            <span className="crf-color-card-dot" style={{ backgroundColor: opt.hex }} />
                            <span className="crf-color-card-name">{opt.name}</span>
                          </div>
                          {isSelected && <span className="crf-color-card-check">✓</span>}
                        </div>
                      )
                    })}
                  </div>

                  {/* Preview Area */}
                  <div className="crf-section-divider">
                    <span className="crf-divider-title">XEM TRƯỚC (PREVIEW)</span>
                  </div>

                  <div className="crf-preview-card">
                    <span className="crf-preview-desc">
                      Hiển thị trên các báo cáo năng lực và bảng điều khiển
                    </span>
                    <span className={`crl-badge ${getBadgeClass(color)}`}>
                      {name || 'Xếp loại'}
                    </span>
                  </div>

                  {/* Warning Box */}
                  <div className="crf-warning-card">
                    <span className="crf-warning-icon">
                      <WarningOutlined />
                    </span>
                    <span className="crf-warning-text">
                      Thay đổi chỉ áp dụng cho các đánh giá từ thời điểm lưu trở đi. Dữ liệu cũ không bị tính lại
                    </span>
                  </div>

                  {/* Actions Footer */}
                  <div className="crf-form-actions">
                    <button type="submit" className="crf-btn-save">
                      Lưu quy tắc
                    </button>
                    <button
                      type="button"
                      className="crf-btn-cancel"
                      onClick={() => navigate('/admin/evaluation/classification-rules')}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default ClassificationRuleFormPage
