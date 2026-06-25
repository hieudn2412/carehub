import React, { useState, useEffect } from 'react'
import AdminSidebar from '../../admin/components/AdminSidebar'
import AdminHeader from '../../admin/components/AdminHeader'
import { EditOutlined, DeleteOutlined, PlusCircleOutlined, CloseOutlined, WarningOutlined } from '@ant-design/icons'
import '../styles/TestConfigPage.css'

const DEFAULT_CONFIG = {
  totalQuestions: 30,
  timeLimit: 45,
  passingScore: 70,
  maxRetakes: 3,
  distributions: [
    { id: 1, category: 'Kiểm soát nhiễm khuẩn', questions: 8 },
    { id: 2, category: 'An toàn sử dụng thuốc', questions: 7 },
    { id: 3, category: 'An toàn người bệnh', questions: 8 },
    { id: 4, category: 'Quy trình lâm sàng', questions: 7 },
  ]
}

const CATEGORIES = ['Kiểm soát nhiễm khuẩn', 'An toàn sử dụng thuốc', 'An toàn người bệnh', 'Quy trình lâm sàng']

function TestConfigPage() {
  // Load configuration from localStorage
  const [totalQuestions, setTotalQuestions] = useState(30)
  const [timeLimit, setTimeLimit] = useState(45)
  const [passingScore, setPassingScore] = useState(70)
  const [maxRetakes, setMaxRetakes] = useState(3)
  const [distributions, setDistributions] = useState([])

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('add') // 'add' or 'edit'
  const [modalIndex, setModalIndex] = useState(null)
  const [modalCategory, setModalCategory] = useState('Kiểm soát nhiễm khuẩn')
  const [modalQuestions, setModalQuestions] = useState(5)

  useEffect(() => {
    const stored = localStorage.getItem('carehub_test_config')
    if (stored) {
      try {
        const config = JSON.parse(stored)
        setTotalQuestions(config.totalQuestions !== undefined ? config.totalQuestions : 30)
        setTimeLimit(config.timeLimit !== undefined ? config.timeLimit : 45)
        setPassingScore(config.passingScore !== undefined ? config.passingScore : 70)
        setMaxRetakes(config.maxRetakes !== undefined ? config.maxRetakes : 3)
        setDistributions(config.distributions || DEFAULT_CONFIG.distributions)
        return
      } catch (e) {
        console.error('Error parsing stored test configuration:', e)
      }
    }
    // Fallback to default
    setTotalQuestions(DEFAULT_CONFIG.totalQuestions)
    setTimeLimit(DEFAULT_CONFIG.timeLimit)
    setPassingScore(DEFAULT_CONFIG.passingScore)
    setMaxRetakes(DEFAULT_CONFIG.maxRetakes)
    setDistributions(DEFAULT_CONFIG.distributions)
    localStorage.setItem('carehub_test_config', JSON.stringify(DEFAULT_CONFIG))
  }, [])

  // Calculate sum of category questions
  const totalDistributionQuestions = distributions.reduce((sum, item) => sum + Number(item.questions), 0)
  const isSumMismatch = totalDistributionQuestions !== Number(totalQuestions)

  // Save changes to localStorage
  const handleSaveConfig = (e) => {
    e.preventDefault()

    const config = {
      totalQuestions: Number(totalQuestions),
      timeLimit: Number(timeLimit),
      passingScore: Number(passingScore),
      maxRetakes: Number(maxRetakes),
      distributions,
    }

    localStorage.setItem('carehub_test_config', JSON.stringify(config))
    alert('Cấu hình bài kiểm tra đã được lưu thành công!')
  }

  // Reset to DEFAULT_CONFIG
  const handleResetDefault = () => {
    if (window.confirm('Bạn có chắc chắn muốn thiết lập lại toàn bộ cấu hình về mặc định?')) {
      setTotalQuestions(DEFAULT_CONFIG.totalQuestions)
      setTimeLimit(DEFAULT_CONFIG.timeLimit)
      setPassingScore(DEFAULT_CONFIG.passingScore)
      setMaxRetakes(DEFAULT_CONFIG.maxRetakes)
      setDistributions(DEFAULT_CONFIG.distributions)
      localStorage.setItem('carehub_test_config', JSON.stringify(DEFAULT_CONFIG))
      alert('Đã khôi phục thiết lập mặc định.')
    }
  }

  // Open modal for adding
  const handleOpenAddModal = () => {
    setModalMode('add')
    // Auto-select a category that is not yet fully distributed if possible
    const existingCats = distributions.map(d => d.category)
    const availableCat = CATEGORIES.find(c => !existingCats.includes(c)) || CATEGORIES[0]
    
    setModalCategory(availableCat)
    setModalQuestions(5)
    setIsModalOpen(true)
  }

  // Open modal for editing
  const handleOpenEditModal = (item, idx) => {
    setModalMode('edit')
    setModalIndex(idx)
    setModalCategory(item.category)
    setModalQuestions(item.questions)
    setIsModalOpen(true)
  }

  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  // Handle modal save rule
  const handleModalSubmit = (e) => {
    e.preventDefault()

    if (!modalQuestions || Number(modalQuestions) <= 0) {
      alert('Số lượng câu hỏi phải lớn hơn 0!')
      return
    }

    if (modalMode === 'add') {
      // Check if category already exists
      const exists = distributions.some(d => d.category === modalCategory)
      if (exists) {
        alert('Danh mục này đã được phân bổ quy tắc. Vui lòng chọn danh mục khác hoặc chỉnh sửa quy tắc có sẵn!')
        return
      }

      const newRule = {
        id: Date.now(),
        category: modalCategory,
        questions: Number(modalQuestions)
      }
      setDistributions(prev => [...prev, newRule])
    } else {
      setDistributions(prev =>
        prev.map((item, idx) =>
          idx === modalIndex
            ? { ...item, category: modalCategory, questions: Number(modalQuestions) }
            : item
        )
      )
    }

    setIsModalOpen(false)
  }

  // Handle deleting a category rule
  const handleDeleteRule = (idx) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa quy tắc phân bổ của danh mục này không?')) {
      setDistributions(prev => prev.filter((_, i) => i !== idx))
    }
  }

  const breadcrumbs = [{ label: 'Cấu hình bài kiểm tra' }]

  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <div className="dashboard-layout__content">
        <AdminHeader breadcrumbs={breadcrumbs} />
        <div className="dashboard-root">
          <main className="dashboard-body">
            <div className="tcf-page">
              {/* Title Card */}
              <div className="tcf-title-card">
                <h1 className="tcf-title">Cấu hình bài kiểm tra</h1>
                <p className="tcf-subtitle">
                  Thiết lập chung cho cấu trúc và hành vi bài thi đánh giá năng lực nhân viên
                </p>
              </div>

              <form onSubmit={handleSaveConfig} className="tcf-form">
                {/* Main Config Container */}
                <div className="tcf-container">
                  
                  {/* EXAM STRUCTURE SECTION */}
                  <div className="tcf-section-header">
                    <span className="tcf-section-title">CẤU TRÚC BÀI KIỂM TRA (EXAM STRUCTURE)</span>
                  </div>

                  <div className="tcf-fields-box">
                    <div className="tcf-field-row">
                      <div className="tcf-field-left">
                        <span className="tcf-field-label">Tổng số câu hỏi mỗi bài thi</span>
                        <span className="tcf-field-subtext">Lấy mặc định từ ngân hàng câu hỏi</span>
                      </div>
                      <input
                        type="number"
                        className="tcf-field-input"
                        min="1"
                        required
                        value={totalQuestions}
                        onChange={(e) => setTotalQuestions(e.target.value)}
                      />
                    </div>

                    <div className="tcf-field-row">
                      <div className="tcf-field-left">
                        <span className="tcf-field-label">Thời gian làm bài (phút)</span>
                      </div>
                      <input
                        type="number"
                        className="tcf-field-input"
                        min="1"
                        required
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(e.target.value)}
                      />
                    </div>

                    <div className="tcf-field-row">
                      <div className="tcf-field-left">
                        <span className="tcf-field-label">Điểm đạt (%)</span>
                      </div>
                      <input
                        type="number"
                        className="tcf-field-input"
                        min="1"
                        max="100"
                        required
                        value={passingScore}
                        onChange={(e) => setPassingScore(e.target.value)}
                      />
                    </div>

                    <div className="tcf-field-row">
                      <div className="tcf-field-left">
                        <span className="tcf-field-label">Số lần thi lại tối đa</span>
                        <span className="tcf-field-subtext">0 = không giới hạn</span>
                      </div>
                      <input
                        type="number"
                        className="tcf-field-input"
                        min="0"
                        required
                        value={maxRetakes}
                        onChange={(e) => setMaxRetakes(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* QUESTION DISTRIBUTION SECTION */}
                  <div className="tcf-section-header" style={{ marginTop: '28px' }}>
                    <span className="tcf-section-title">PHÂN BỔ CÂU HỎI THEO DANH MỤC (QUESTION DISTRIBUTION BY CATEGORY)</span>
                  </div>

                  {/* Warning Banner for mismatch */}
                  {isSumMismatch && (
                    <div className="tcf-warning-banner">
                      <span className="tcf-warning-icon">
                        <WarningOutlined />
                      </span>
                      <span className="tcf-warning-text">
                        Cảnh báo: Tổng số câu hỏi phân bổ ({totalDistributionQuestions} câu) chưa khớp với Tổng số câu hỏi của bài thi ({totalQuestions} câu). Vui lòng điều chỉnh lại.
                      </span>
                    </div>
                  )}

                  {/* Category Table Card */}
                  <div className="tcf-table-card">
                    <table className="tcf-table">
                      <thead>
                        <tr>
                          <th>Danh mục</th>
                          <th style={{ width: '150px' }}>Số câu hỏi</th>
                          <th style={{ width: '150px' }}>% đề thi</th>
                          <th style={{ width: '120px', textAlign: 'center' }}>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {distributions.length === 0 ? (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 0' }}>
                              Chưa có quy tắc phân bổ nào. Vui lòng bấm "+ Thêm phân bổ danh mục".
                            </td>
                          </tr>
                        ) : (
                          distributions.map((item, idx) => {
                            const pct = totalQuestions > 0 ? Math.round((Number(item.questions) / Number(totalQuestions)) * 100) : 0
                            return (
                              <tr key={item.id || idx}>
                                <td style={{ fontWeight: 600, color: '#1e293b' }}>{item.category}</td>
                                <td style={{ fontWeight: 600, color: '#334155' }}>{item.questions}</td>
                                <td style={{ color: '#475569', fontWeight: 500 }}>{pct}%</td>
                                <td>
                                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                    <button
                                      type="button"
                                      className="tcf-action-btn tcf-action-btn--edit"
                                      onClick={() => handleOpenEditModal(item, idx)}
                                      title="Chỉnh sửa"
                                    >
                                      <EditOutlined />
                                    </button>
                                    <button
                                      type="button"
                                      className="tcf-action-btn tcf-action-btn--delete"
                                      onClick={() => handleDeleteRule(idx)}
                                      title="Xóa"
                                    >
                                      <DeleteOutlined />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>

                    {/* Table footer action button */}
                    <div className="tcf-card-footer">
                      <button
                        type="button"
                        className="tcf-btn-add-rule"
                        onClick={handleOpenAddModal}
                      >
                        <PlusCircleOutlined /> Thêm phân bổ danh mục
                      </button>
                    </div>
                  </div>

                </div>

                {/* Form Footer Action Buttons */}
                <div className="tcf-form-actions">
                  <button type="submit" className="tcf-btn-save">
                    Lưu cấu hình
                  </button>
                  <button
                    type="button"
                    className="tcf-btn-reset"
                    onClick={handleResetDefault}
                  >
                    Thiết lập mặc định
                  </button>
                </div>
              </form>

            </div>
          </main>
        </div>
      </div>

      {/* Add / Edit Category Rule Modal Dialog */}
      {isModalOpen && (
        <div className="tcf-modal-backdrop" onClick={handleCloseModal}>
          <div className="tcf-modal" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="tcf-modal-header">
              <div className="tcf-modal-title-wrap">
                <h2 className="tcf-modal-title">
                  {modalMode === 'add' ? 'Thêm phân bổ danh mục' : 'Cập nhật phân bổ danh mục'}
                </h2>
              </div>
              <button className="tcf-modal-close" onClick={handleCloseModal}>
                <CloseOutlined />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleModalSubmit} className="tcf-modal-form">
              
              <div className="tcf-modal-group">
                <label>Danh mục câu hỏi <span className="tcf-required-star">*</span></label>
                <select
                  className="tcf-input-red"
                  required
                  value={modalCategory}
                  onChange={(e) => setModalCategory(e.target.value)}
                  disabled={modalMode === 'edit'} // Disable category editing to prevent duplicate confusion
                >
                  {CATEGORIES.map((cat, idx) => (
                    <option key={idx} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="tcf-modal-group">
                <label>Số lượng câu hỏi phân bổ <span className="tcf-required-star">*</span></label>
                <input
                  type="number"
                  className="tcf-input-green"
                  min="1"
                  required
                  value={modalQuestions}
                  onChange={(e) => setModalQuestions(e.target.value)}
                  placeholder="Ví dụ: 8"
                />
              </div>

              {/* Modal Actions */}
              <div className="tcf-modal-actions">
                <button type="submit" className="tcf-btn-save-modal">
                  Lưu
                </button>
                <button type="button" className="tcf-btn-cancel-modal" onClick={handleCloseModal}>
                  Hủy
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  )
}

export default TestConfigPage
